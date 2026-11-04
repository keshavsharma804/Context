import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

import os, re
from datetime import datetime, timedelta, timezone
from icalendar import Calendar
from core.db import get_conn


# ---------- Category detection ----------

ACADEMIC_PATTERNS = re.compile(
    r"\b(class|lecture|lab|seminar|assignment|exam|test|quiz|submission|viva|tutorial|course|coursework|thesis|project review)\b",
    re.I,
)
OFFICE_PATTERNS = re.compile(
    r"\b(standup|stand-up|sprint|retro|retrospective|planning|1:1|1-on-1|one-on-one|review|sync|kickoff|demo|meeting|call|interview|onboarding|all-hands)\b",
    re.I,
)
INTERVIEW_PATTERNS = re.compile(
    r"\b(interview|screening|technical round|hr round|final round|panel)\b",
    re.I,
)

KNOWN_COMPANIES = [
    "Infosys", "TCS", "Wipro", "Accenture", "Cognizant", "Capgemini", "HCL",
    "Amazon", "Google", "Microsoft", "Meta", "Apple", "Netflix",
    "Flipkart", "Swiggy", "Zomato", "Razorpay", "CRED", "Paytm", "PhonePe",
    "Picklix", "Freshworks", "Zoho", "Atlassian", "Adobe", "Uber", "Ola",
    "Meesho", "Nykaa", "Groww", "Zerodha", "Postman", "BrowserStack",
    "PayPal", "Salesforce", "Oracle", "SAP", "IBM", "Deloitte", "PwC", "EY", "KPMG",
]


def classify_event(title, description=""):
    """Return (category, company_or_None)."""
    text = f"{title} {description}"
    company = None
    for c in KNOWN_COMPANIES:
        if re.search(rf"\b{re.escape(c)}", text, re.I):
            company = c
            break

    if INTERVIEW_PATTERNS.search(text) and company:
        return "interview", company
    if OFFICE_PATTERNS.search(text):
        return "office", company
    if ACADEMIC_PATTERNS.search(text):
        return "academic", company
    return "personal", company


# ---------- ICS parsing ----------

def _dt_to_iso(dt):
    """Return local wall-clock ISO string WITHOUT timezone suffix.
    Naive datetimes are assumed to be local. Tz-aware datetimes are converted to local."""
    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            dt = dt.astimezone()          # convert to local tz
        return dt.replace(tzinfo=None).isoformat(timespec="minutes")
    # all-day event (date object)
    return datetime(dt.year, dt.month, dt.day).isoformat(timespec="minutes")


def parse_ics(path, source_name=None):
    """Yield dicts for each VEVENT in the file."""
    with open(path, "rb") as f:
        cal = Calendar.from_ical(f.read())

    for component in cal.walk("VEVENT"):
        try:
            uid = str(component.get("UID", "")) or None
            title = str(component.get("SUMMARY", "")).strip()
            start = component.get("DTSTART")
            end = component.get("DTEND") or start
            if not title or not start:
                continue
            dtstart = start.dt
            dtend = end.dt if end else dtstart
            location = str(component.get("LOCATION", "")).strip()
            description = str(component.get("DESCRIPTION", "")).strip()

            category, company = classify_event(title, description)

            yield {
                "uid": uid,
                "title": title,
                "start_at": _dt_to_iso(dtstart),
                "end_at": _dt_to_iso(dtend),
                "location": location[:200],
                "description": description[:500],
                "category": category,
                "company": company,
                "source": source_name or os.path.basename(path),
            }
        except Exception as e:
            print(f"  [event parse fail] {e}")
            continue


# ---------- Index ----------

def index_ics(path, source_name=None):
    """Parse an ICS file and upsert every event into DB. Returns count."""
    conn = get_conn()
    count = 0
    now = datetime.now().isoformat(timespec="seconds")

    for ev in parse_ics(path, source_name):
        if ev["uid"]:
            conn.execute('DELETE FROM context.events WHERE uid = %s', (ev["uid"],))
        conn.execute(
            'INSERT INTO context.events (uid, title, start_at, end_at, location, description, category, company, source, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
            (ev["uid"], ev["title"], ev["start_at"], ev["end_at"], ev["location"],
             ev["description"], ev["category"], ev["company"], ev["source"], now),
        )
        count += 1

    conn.commit()
    conn.close()
    print(f"  indexed {count} events from {source_name or path}")
    return count


def clear_events():
    conn = get_conn()
    conn.execute('DELETE FROM context.events')
    conn.commit()
    conn.close()


# ---------- Query for brief ----------

def events_on(date_str):
    next_day = (datetime.fromisoformat(date_str).date() + timedelta(days=1)).isoformat()
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, title, start_at, end_at, category, company, location FROM context.events WHERE start_at >= %s AND start_at < %s ORDER BY start_at',
        (date_str, next_day),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def upcoming_events(days=7):
    from datetime import datetime as dt, timedelta
    now = dt.now().replace(tzinfo=None).isoformat(timespec="minutes")
    until = (dt.now() + timedelta(days=days)).replace(tzinfo=None).isoformat(timespec="minutes")
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, title, start_at, end_at, category, company, location FROM context.events WHERE substr(start_at, 1, 16) >= %s AND substr(start_at, 1, 16) <= %s ORDER BY start_at',
        (now, until),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def detect_collisions(date_str, events=None):
    """Return pairs of overlapping events on a given day."""
    if events is None:
        events = events_on(date_str)
    out = []
    for i, a in enumerate(events):
        for b in events[i+1:]:
            try:
                a_start = datetime.fromisoformat(a["start_at"])
                a_end = datetime.fromisoformat(a["end_at"])
                b_start = datetime.fromisoformat(b["start_at"])
                b_end = datetime.fromisoformat(b["end_at"])
            except Exception:
                continue
            if a_start < b_end and b_start < a_end:
                out.append({
                    "a": a["title"],
                    "a_start": a["start_at"],
                    "b": b["title"],
                    "b_start": b["start_at"],
                })
    return out


def free_slots(date_str, min_minutes=30, events=None):
    """Gaps between events on a day, 8am–10pm window."""
    if events is None:
        events = events_on(date_str)
    day = datetime.fromisoformat(f"{date_str}T08:00")
    end_of_day = datetime.fromisoformat(f"{date_str}T22:00")

    busy = []
    for e in events:
        try:
            s = datetime.fromisoformat(e["start_at"])
            t = datetime.fromisoformat(e["end_at"])
            busy.append((max(s, day), min(t, end_of_day)))
        except Exception:
            continue

    busy.sort()
    slots = []
    cur = day
    for s, t in busy:
        if (s - cur).total_seconds() >= min_minutes * 60:
            slots.append({"start": cur.isoformat(timespec="minutes"),
                          "end": s.isoformat(timespec="minutes")})
        cur = max(cur, t)
    if (end_of_day - cur).total_seconds() >= min_minutes * 60:
        slots.append({"start": cur.isoformat(timespec="minutes"),
                      "end": end_of_day.isoformat(timespec="minutes")})
    return slots


# ---------- Brief bundle ----------

def events_between(start_date, end_date):
    """All events whose start date falls within an inclusive date range."""
    end_exclusive = (datetime.fromisoformat(end_date).date() + timedelta(days=1)).isoformat()
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, title, start_at, end_at, category, company, location FROM context.events WHERE start_at >= %s AND start_at < %s ORDER BY start_at',
        (start_date, end_exclusive),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def collisions_in_range(start_date, end_date, events=None):
    start = datetime.fromisoformat(start_date).date()
    end = datetime.fromisoformat(end_date).date()
    if start > end:
        return []
    if events is None:
        events = events_between(start_date, end_date)
    by_day = {}
    for event in events:
        day = event["start_at"][:10]
        if start.isoformat() <= day <= end.isoformat():
            by_day.setdefault(day, []).append(event)
    out = []
    for day, day_events in sorted(by_day.items()):
        for collision in detect_collisions(day, events=day_events):
            collision["date"] = day
            out.append(collision)
    return out


def calendar_brief():
    today = datetime.now().date().isoformat()
    today_events = events_on(today)
    return {
        "today": today_events,
        "upcoming": upcoming_events(days=7),
        "collisions": detect_collisions(today, events=today_events),
        "free_slots": free_slots(today, events=today_events),
    }


def add_event(title, start_at, end_at=None, category="personal", location="", description="", company=None):
    """Add a manual calendar event."""
    conn = get_conn()
    now = datetime.now().isoformat(timespec="seconds")
    if not end_at:
        try:
            st = datetime.fromisoformat(start_at)
            end_at = (st + timedelta(hours=1)).isoformat()
        except Exception:
            end_at = start_at
    uid = f"manual-{datetime.now().timestamp()}"
    cur = conn.execute(
        "INSERT INTO context.events (uid, title, start_at, end_at, location, description, category, company, source, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'manual', %s) RETURNING id",
        (uid, title, start_at, end_at, location or "", description or "", category or "personal", company, now),
    )
    event_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return {"id": event_id, "uid": uid, "title": title, "start_at": start_at, "end_at": end_at, "category": category, "location": location}


def delete_event(event_id):
    """Delete a calendar event by ID."""
    conn = get_conn()
    cur = conn.execute('DELETE FROM context.events WHERE id = %s', (event_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
