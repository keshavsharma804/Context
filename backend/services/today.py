"""Small, owner-scoped action lists for the Today home page."""

from datetime import date, timedelta

from core.db import get_conn


def today_brief(day: date):
    start = day.isoformat()
    tomorrow = (day + timedelta(days=1)).isoformat()
    horizon = (day + timedelta(days=7)).isoformat()
    contact_cutoff = (day - timedelta(days=14)).isoformat()
    # One scoped lease; no monthly summaries, full-table counts, or per-item queries.
    with get_conn() as conn:
        events = conn.execute(
            'SELECT id, title, start_at, end_at, location, category, company FROM context.events '
            'WHERE start_at >= %s AND start_at < %s ORDER BY start_at, id LIMIT 100',
            (start, tomorrow),
        ).fetchall()
        interviews = conn.execute(
            'SELECT id, company, scheduled_at FROM context.interviews '
            'WHERE scheduled_at >= %s AND scheduled_at < %s ORDER BY scheduled_at, id LIMIT 100',
            (start, tomorrow),
        ).fetchall()
        subscriptions = conn.execute(
            "SELECT id, name, amount, next_renewal FROM context.subscriptions "
            "WHERE next_renewal != '' AND next_renewal <= %s ORDER BY next_renewal, id LIMIT 8",
            (horizon,),
        ).fetchall()
        debts = conn.execute(
            "SELECT id, person, direction, amount, due_date FROM context.debts "
            "WHERE settled = 0 AND due_date != '' AND due_date <= %s ORDER BY due_date, id LIMIT 8",
            (horizon,),
        ).fetchall()
        emails = conn.execute(
            "SELECT id, from_name, from_addr, subject, received_at FROM context.emails "
            "WHERE source = 'inbox' AND needs_reply = 1 AND replied = 0 "
            "ORDER BY received_at DESC, id DESC LIMIT 5"
        ).fetchall()
        contacts = conn.execute(
            "WITH latest_email AS ("
            " SELECT lower(from_name) AS name, MAX(received_at) AS latest FROM context.emails"
            " WHERE source = 'inbox' AND from_name != '' GROUP BY lower(from_name)"
            ") SELECT p.id, p.name, GREATEST(NULLIF(p.last_contacted, ''), e.latest) AS last_contact "
            "FROM context.people p LEFT JOIN latest_email e ON e.name = lower(p.name) "
            "WHERE GREATEST(NULLIF(p.last_contacted, ''), e.latest) <= %s "
            "ORDER BY last_contact, p.id LIMIT 5",
            (contact_cutoff,),
        ).fetchall()
        journal = conn.execute(
            'SELECT mood, headline FROM context.journal WHERE date = %s', (start,),
        ).fetchone()

    schedule = [{
        'id': f"event:{row['id']}", 'title': row['title'],
        'start_at': row['start_at'], 'end_at': row['end_at'],
        'location': row['location'],
        'kind': 'interview' if row['category'] == 'interview' else 'event',
    } for row in events]
    linked_interviews = {
        ((row['company'] or '').casefold(), row['start_at'][:16])
        for row in events if row['category'] == 'interview'
    }
    for row in interviews:
        if ((row['company'] or '').casefold(), row['scheduled_at'][:16]) not in linked_interviews:
            schedule.append({
                'id': f"interview:{row['id']}", 'title': f"Interview: {row['company']}",
                'start_at': row['scheduled_at'], 'end_at': None,
                'location': None, 'kind': 'interview',
            })
    schedule.sort(key=lambda item: (item['start_at'], item['id']))
    return {
        'date': start,
        'schedule': schedule,
        'subscriptions': [dict(row) for row in subscriptions],
        'debts': [dict(row) for row in debts],
        'emails': [dict(row) for row in emails],
        'contacts': [dict(row) for row in contacts],
        'journal': dict(journal) if journal else None,
    }
