"""Live in-app reminders with durable, account-scoped actions."""

from datetime import datetime, time, timedelta, timezone
import hashlib
import json
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from core.db import get_conn


def _zone(name):
    if not isinstance(name, str) or len(name) > 80:
        raise HTTPException(422, 'Choose a valid time zone')
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, 'Choose a valid time zone') from None


def _timestamp(value, zone):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=zone)
    return parsed.astimezone(timezone.utc)


def _identity(kind, source_id, occurrence):
    value = json.dumps([kind, str(source_id), occurrence], separators=(',', ':'))
    return hashlib.sha256(value.encode()).hexdigest()


def _reminder(kind, source_id, occurrence, title, body, due, href, severity):
    return {
        'id': _identity(kind, source_id, occurrence), 'kind': kind,
        'title': title, 'body': body, 'due_at': due.isoformat(),
        'href': href, 'severity': severity,
    }


def _candidates(conn, zone, now):
    local = now.astimezone(zone)
    start = local.date().isoformat()
    # UTC arithmetic keeps a 30-minute window correct across a DST jump.
    until = max(
        (local + timedelta(minutes=31)).replace(tzinfo=None),
        (now + timedelta(minutes=31)).astimezone(zone).replace(tzinfo=None),
    ).isoformat(timespec='seconds')
    payment_end = (local.date() + timedelta(days=2)).isoformat()
    events = conn.execute(
        'SELECT id, title, start_at, end_at, category, company FROM context.events '
        'WHERE start_at >= %s AND start_at < %s ORDER BY start_at DESC, id LIMIT 100',
        (start, until),
    ).fetchall()
    interviews = conn.execute(
        'SELECT id, company, scheduled_at FROM context.interviews '
        'WHERE scheduled_at >= %s AND scheduled_at < %s ORDER BY scheduled_at DESC, id LIMIT 100',
        (start, until),
    ).fetchall()
    subscriptions = conn.execute(
        "SELECT id, name, amount, next_renewal FROM context.subscriptions "
        "WHERE next_renewal != '' AND next_renewal < %s ORDER BY next_renewal DESC, id LIMIT 100",
        (payment_end,),
    ).fetchall()
    debts = conn.execute(
        "SELECT id, person, direction, amount, due_date FROM context.debts "
        "WHERE settled = 0 AND due_date != '' AND due_date < %s ORDER BY due_date DESC, id LIMIT 100",
        (payment_end,),
    ).fetchall()
    result = {}
    appointments = [(row, row['start_at'], row['title'], row['end_at'], row['category'] == 'interview') for row in events]
    appointments += [(row, row['scheduled_at'], f"Interview: {row['company']}", None, True) for row in interviews]
    for row, value, title, end_value, interview in appointments:
        try:
            due = _timestamp(value, zone)
            end = _timestamp(end_value, zone) if end_value else due + timedelta(hours=1)
        except (ValueError, TypeError):
            continue
        if due - now > timedelta(minutes=30) or max(end, due + timedelta(minutes=1)) <= now:
            continue
        kind = 'interview' if interview else 'event'
        # A scheduled interview can also have a linked Calendar event.
        source = ((row['company'] or '').strip().casefold() or f"{row['id']}:{title}") if interview else row['id']
        occurrence = due.replace(second=0, microsecond=0).isoformat()
        minutes = max(1, int((due - now).total_seconds() // 60))
        timing = f'Starts in {minutes} min' if due > now else 'In progress'
        item = _reminder(kind, source, occurrence, title, timing, due,
                         '/jobs' if interview else '/calendar', 'warning')
        result[item['id']] = item
    for kind, rows, field in (('subscription', subscriptions, 'next_renewal'), ('debt', debts, 'due_date')):
        for row in rows:
            try:
                day = datetime.fromisoformat(row[field]).date()
                due = datetime.combine(day, time.min, tzinfo=zone).astimezone(timezone.utc)
            except (ValueError, TypeError):
                continue
            if day > local.date() + timedelta(days=1):
                continue
            overdue = day < local.date()
            timing = 'Overdue' if overdue else 'Due today' if day == local.date() else 'Due tomorrow'
            if kind == 'subscription':
                title, detail, href = row['name'], 'Subscription renewal', '/subscriptions'
            else:
                title, detail, href = row['person'], 'You owe' if row['direction'] == 'borrowed' else 'Owed to you', '/debts'
            item = _reminder(kind, row['id'], day.isoformat(), title, f'{detail} · {timing}',
                             due, href, 'danger' if overdue else 'warning' if day == local.date() else 'info')
            item['amount'] = row['amount']
            result[item['id']] = item
    return list(result.values())


def _visible(items, states, now):
    result = []
    for item in items:
        state = states.get(item['id'], {})
        if state.get('dismissed_at'):
            continue
        snoozed = state.get('snoozed_until')
        if snoozed and _timestamp(str(snoozed), timezone.utc) > now:
            continue
        result.append({**item, 'read': bool(state.get('read_at'))})
    rank = {'danger': 0, 'warning': 1, 'info': 2}
    return sorted(result, key=lambda item: (rank[item['severity']], item['due_at'], item['id']))


def get_reminders(timezone_name, now=None):
    zone = _zone(timezone_name)
    now = now or datetime.now(timezone.utc)
    with get_conn() as conn:
        items = _candidates(conn, zone, now)
        states = {}
        if items:
            placeholders = ','.join(['%s'] * len(items))
            rows = conn.execute(
                'SELECT reminder_id, read_at, dismissed_at, snoozed_until FROM context.reminder_states '
                f'WHERE reminder_id IN ({placeholders})', tuple(item['id'] for item in items),
            ).fetchall()
            states = {row['reminder_id']: dict(row) for row in rows}
    visible = _visible(items, states, now)
    return {'notifications': visible, 'unread_count': sum(not item['read'] for item in visible),
            'checked_at': now.isoformat(), 'timezone': timezone_name}


def update_reminder(reminder_id, action, timezone_name, minutes=15, now=None):
    zone = _zone(timezone_name)
    now = now or datetime.now(timezone.utc)
    if not re.fullmatch(r'[0-9a-f]{64}', reminder_id) or action not in {'read', 'snooze', 'dismiss'} or not 5 <= minutes <= 10080:
        raise HTTPException(422, 'Invalid reminder action')
    with get_conn() as conn:
        if reminder_id not in {item['id'] for item in _candidates(conn, zone, now)}:
            raise HTTPException(404, 'This reminder is no longer active')
        if action == 'read':
            column, value, extra = 'read_at', now, ''
        elif action == 'dismiss':
            column, value, extra = 'dismissed_at', now, ''
        else:
            column, value, extra = 'snoozed_until', now + timedelta(minutes=minutes), ', read_at = NULL'
        # The column is selected only from the fixed allowlist above.
        conn.execute(
            f'INSERT INTO context.reminder_states (reminder_id, {column}) VALUES (%s, %s) '
            f'ON CONFLICT (user_id, reminder_id) DO UPDATE SET {column} = EXCLUDED.{column}{extra}',
            (reminder_id, value),
        )


def mark_all_read(timezone_name, now=None):
    now = now or datetime.now(timezone.utc)
    ids = [item['id'] for item in get_reminders(timezone_name, now)['notifications'] if not item['read']]
    if ids:
        with get_conn() as conn:
            placeholders = ','.join(['(%s, %s)'] * len(ids))
            params = tuple(value for reminder_id in ids for value in (reminder_id, now))
            conn.execute(
                f'INSERT INTO context.reminder_states (reminder_id, read_at) VALUES {placeholders} '
                'ON CONFLICT (user_id, reminder_id) DO UPDATE SET read_at = EXCLUDED.read_at', params,
            )
    return len(ids)
