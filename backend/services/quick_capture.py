"""Preview short entries without writes; save a reviewed draft exactly once."""

from datetime import date as Date, datetime, time, timedelta, timezone
import hashlib
import json
import re
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator

from core.db import get_conn
from services import capture
from services.manual import _infer_spend_category
from services.calendar_import import classify_event
from services.reminders import _zone


class CaptureDraft(BaseModel):
    kind: Literal['expense', 'event', 'note', 'debt', 'subscription', 'contact']
    title: str = Field(default='', max_length=200)
    content: str = Field(default='', max_length=10000)
    amount: float | None = Field(default=None, gt=0, le=1_000_000_000, allow_inf_nan=False)
    merchant: str = Field(default='', max_length=120)
    category: str = Field(default='other', max_length=40)
    date: Date = Field(default_factory=Date.today)
    start_at: datetime | None = None
    end_at: datetime | None = None
    location: str = Field(default='', max_length=200)
    company: str = Field(default='', max_length=120)
    person: str = Field(default='', max_length=120)
    direction: Literal['lent', 'borrowed'] = 'lent'
    billing_cycle: Literal['monthly', 'yearly', 'quarterly', 'weekly'] = 'monthly'
    due_date: Date | None = None

    @model_validator(mode='after')
    def validate_record(self):
        for field in ('title', 'content', 'merchant', 'category', 'location', 'company', 'person'):
            setattr(self, field, getattr(self, field).strip())
        if self.kind in {'expense', 'debt', 'subscription'} and self.amount is None:
            raise ValueError('Enter a positive amount')
        if self.kind in {'event', 'subscription'} and not self.title:
            raise ValueError('Enter a title')
        if self.kind == 'note' and not self.content:
            raise ValueError('Enter a note')
        if self.kind in {'debt', 'contact'} and len(self.person) < 2:
            raise ValueError('Enter a person’s name')
        if self.kind == 'subscription' and self.due_date is None:
            raise ValueError('Choose the next renewal date')
        if self.kind == 'event':
            if self.start_at is None:
                raise ValueError('Choose the event date and time')
            if self.start_at.tzinfo is not None or (self.end_at and self.end_at.tzinfo is not None):
                raise ValueError('Use a local date and time')
            self.end_at = self.end_at or self.start_at + timedelta(hours=1)
            self.date = self.start_at.date()
            if self.end_at <= self.start_at:
                raise ValueError('The end must be after the start')
        return self


def _future_day(text, today):
    match = re.search(r'\b(\d{4}-\d{2}-\d{2}|today|tomorrow|(?:next\s+)?monday|(?:next\s+)?tuesday|(?:next\s+)?wednesday|(?:next\s+)?thursday|(?:next\s+)?friday|(?:next\s+)?saturday|(?:next\s+)?sunday)\b', text, re.I)
    if not match:
        return today, text, False
    word = match.group().lower()
    if word == 'today':
        day = today
    elif word == 'tomorrow':
        day = today + timedelta(days=1)
    elif word.removeprefix('next ') in capture.WEEKDAYS:
        offset = (capture.WEEKDAYS[word.removeprefix('next ')] - today.weekday()) % 7
        day = today + timedelta(days=offset or 7)
    else:
        try:
            day = Date.fromisoformat(word)
        except ValueError:
            raise HTTPException(422, 'That date is not valid') from None
    return day, (text[:match.start()] + ' ' + text[match.end():]).strip(), True


def preview_capture(text, timezone_name, now=None):
    local = (now or datetime.now(timezone.utc)).astimezone(_zone(timezone_name))
    today = local.date()
    line = text.strip()
    if not line:
        raise HTTPException(422, 'Enter something to capture')
    draft = {'kind': 'note', 'content': line, 'date': today.isoformat(), 'category': 'other'}
    warnings = []
    note = capture.NOTE_RE.match(line)
    if not note:
        for value in re.findall(r'\b\d{4}-\d{2}-\d{2}\b', line):
            try:
                Date.fromisoformat(value)
            except ValueError:
                raise HTTPException(422, 'That date is not valid') from None
    if note:
        draft['content'] = note.group(1).strip()
    elif re.match(r'^(?:interview|meeting|event|appointment|call)\b', line, re.I):
        day, cleaned, explicit_day = _future_day(line, today)
        clock = re.search(r'\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2}))?\b', cleaned, re.I)
        start = None
        if clock:
            hour = int(clock.group(1) or clock.group(4))
            minute = int(clock.group(2) or clock.group(5) or 0)
            meridiem = clock.group(3)
            if meridiem and 1 <= hour <= 12:
                hour = hour % 12 + (12 if meridiem.lower() == 'pm' else 0)
            elif meridiem:
                hour = 99
            if hour > 23 or minute > 59:
                warnings.append('Choose a valid time below.')
            else:
                start = datetime.combine(day, time(hour, minute))
            cleaned = (cleaned[:clock.start()] + cleaned[clock.end():]).strip(' .,:')
            if not meridiem and hour <= 12:
                warnings.append('Check AM/PM: the time below uses the 24-hour clock.')
        else:
            warnings.append('Choose a start time before saving.')
        title = re.sub(r'^(?:event|appointment)\s*:?\s*', '', cleaned, flags=re.I).strip() or 'New event'
        category, company = classify_event(title)
        if re.match(r'^interview\b', title, re.I):
            category = 'interview'
        draft = {'kind': 'event', 'title': title, 'date': day.isoformat(), 'start_at': start.isoformat(timespec='minutes') if start else '',
                 'end_at': (start + timedelta(hours=1)).isoformat(timespec='minutes') if start else '', 'category': category, 'company': company or ''}
        if not explicit_day:
            warnings.append('No date specified; today is selected.')
    else:
        spent_day, cleaned = capture._extract_date(line, today=today)
        base_day = spent_day or today
        draft['date'] = base_day.isoformat()
        debt_patterns = [
            (capture.LENT_TO_RE, 'lent', False), (capture.BORROWED_FROM_RE, 'borrowed', False),
            (capture.LENT_PERSON_RE, 'lent', True), (capture.OWES_ME_RE, 'lent', True), (capture.I_OWE_RE, 'borrowed', True),
        ]
        for pattern, direction, person_first in debt_patterns:
            match = pattern.search(cleaned)
            if match:
                amount, person = (match.group(2), match.group(1)) if person_first else (match.group(1), match.group(2))
                draft = {'kind': 'debt', 'person': person.strip(), 'amount': capture._amount(amount), 'direction': direction,
                         'content': (match.group(3) or '').strip(), 'date': base_day.isoformat()}
                break
        else:
            sub = capture.SUB_RE.match(cleaned)
            contact = capture.CONTACTED_RE.match(cleaned)
            spend = capture.SPEND_RE.search(cleaned) or capture.ADD_SPEND_RE.match(cleaned) or capture.BARE_SPEND_RE.match(cleaned)
            bought = capture.BOUGHT_RE.search(cleaned)
            if sub:
                cycle = (sub.group(3) or 'monthly').lower()
                days = {'weekly': 7, 'monthly': 30, 'quarterly': 90, 'yearly': 365}[cycle]
                draft = {'kind': 'subscription', 'title': sub.group(1).strip(), 'amount': capture._amount(sub.group(2)),
                         'billing_cycle': cycle, 'due_date': (today + timedelta(days=days)).isoformat(), 'date': today.isoformat(), 'category': 'other'}
                warnings.append('Check the estimated next renewal date before saving.')
            elif contact:
                draft = {'kind': 'contact', 'person': contact.group(1).strip(), 'date': base_day.isoformat()}
            elif (spend or bought) and not capture._looks_like_question(line):
                amount = capture._amount(spend.group(1) if spend else bought.group(2))
                merchant = capture._clean_merchant(spend.group(2) if spend else bought.group(1))
                draft = {'kind': 'expense', 'amount': amount, 'merchant': merchant, 'category': _infer_spend_category(merchant), 'date': base_day.isoformat()}
            else:
                warnings.append('Saved as a note unless you change the type below.')
    return {'draft': draft, 'warnings': warnings}


def save_capture(draft: CaptureDraft, request_id: UUID):
    payload = json.dumps(draft.model_dump(mode='json'), sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(payload.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    request_id = str(request_id)
    with get_conn() as conn:
        claimed = conn.execute(
            'INSERT INTO context.capture_receipts(request_id,payload_hash) VALUES (%s,%s) '
            'ON CONFLICT(user_id,request_id) DO NOTHING RETURNING request_id', (request_id, digest),
        ).fetchone()
        if not claimed:
            receipt = conn.execute('SELECT payload_hash,result FROM context.capture_receipts WHERE request_id=%s', (request_id,)).fetchone()
            if not receipt or receipt['payload_hash'] != digest:
                raise HTTPException(409, 'This save was already used for a different entry. Review again.')
            return receipt['result'] if isinstance(receipt['result'], dict) else json.loads(receipt['result'])
        if draft.kind == 'expense':
            row = conn.execute('INSERT INTO context.spends(amount,merchant,category,spent_at,created_at) VALUES (%s,%s,%s,%s,%s) RETURNING id',
                               (draft.amount, draft.merchant, draft.category.lower(), draft.date.isoformat(), now)).fetchone()
            href = '/money'
        elif draft.kind == 'event':
            row = conn.execute("INSERT INTO context.events(uid,title,start_at,end_at,location,description,category,company,source,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'manual',%s) RETURNING id",
                               ('capture-' + request_id, draft.title, draft.start_at.isoformat(), draft.end_at.isoformat(), draft.location, draft.content, draft.category, draft.company or None, now)).fetchone()
            href = f'/calendar?date={draft.start_at.date().isoformat()}'
        elif draft.kind == 'note':
            row = conn.execute("INSERT INTO context.manual(kind,payload,created_at) VALUES ('note',%s,%s) RETURNING id",
                               (json.dumps({'content': draft.content, 'summary': draft.content[:80]}), now)).fetchone()
            href = None
        elif draft.kind == 'debt':
            row = conn.execute('INSERT INTO context.debts(person,direction,amount,description,due_date,taken_at,settled,notes,created_at) VALUES (%s,%s,%s,%s,%s,%s,0,%s,%s) RETURNING id',
                               (draft.person, draft.direction, draft.amount, draft.content, draft.due_date.isoformat() if draft.due_date else None, draft.date.isoformat(), '', now)).fetchone()
            href = '/debts'
        elif draft.kind == 'subscription':
            row = conn.execute('INSERT INTO context.subscriptions(name,amount,billing_cycle,category,next_renewal,auto_renew,created_at) VALUES (%s,%s,%s,%s,%s,1,%s) RETURNING id',
                               (draft.title, draft.amount, draft.billing_cycle, draft.category, draft.due_date.isoformat(), now)).fetchone()
            href = '/subscriptions'
        else:
            name = draft.person.title()
            row = conn.execute("INSERT INTO context.people(name,last_contacted,source,created_at) VALUES (%s,%s,'manual',%s) ON CONFLICT(user_id,lower(name)) DO UPDATE SET last_contacted=EXCLUDED.last_contacted RETURNING id",
                               (name, draft.date.isoformat() + 'T12:00:00', now)).fetchone()
            from urllib.parse import quote
            href = '/people/' + quote(name, safe='')
        record_id = row['id']
        if draft.kind == 'event' and draft.category == 'interview' and draft.company:
            conn.execute('INSERT INTO context.interviews(company,scheduled_at,created_at) VALUES (%s,%s,%s)',
                         (draft.company, draft.start_at.isoformat(), now))
        from services.rag import add_chunk
        source = {'expense': 'spend', 'note': 'manual', 'event': 'event', 'debt': 'debt', 'subscription': 'subscription', 'contact': 'person'}[draft.kind]
        if draft.kind != 'contact':
            add_chunk(source, record_id, draft.title or draft.merchant or draft.person or draft.content[:80],
                      payload, {'kind': draft.kind}, conn=conn)
        if href is None:
            href = f'/notes/{record_id}'
        elif draft.kind in {'expense', 'debt', 'subscription'}:
            href = f'/records/{draft.kind}/{record_id}'
        result = {'kind': draft.kind, 'id': record_id, 'href': href, 'message': 'Entry saved'}
        conn.execute('UPDATE context.capture_receipts SET result=%s WHERE request_id=%s', (json.dumps(result), request_id))
    return result
