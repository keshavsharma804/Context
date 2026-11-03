import re
from datetime import datetime, timedelta
from db import get_conn


FACT_CATEGORY_HINTS = {
    "work": ["job", "work", "promoted", "promotion", "manager", "team", "office",
             "company", "joined", "resigned", "quit", "internship"],
    "health": ["sick", "hospital", "surgery", "recovering", "ill", "unwell",
               "doctor", "diagnosis"],
    "life": ["birthday", "anniversary", "married", "engaged", "moved", "moving",
             "born", "graduated"],
    "plans": ["trip", "travel", "vacation", "visiting", "going to",
              "planning", "next week", "next month"],
    "family": ["mom", "dad", "mother", "father", "sister", "brother", "wife",
               "husband", "son", "daughter"],
}


def _infer_category(fact):
    text = (fact or "").lower()
    for cat, hints in FACT_CATEGORY_HINTS.items():
        if any(h in text for h in hints):
            return cat
    return "other"


def get_or_create_person(name, source="manual"):
    name = (name or "").strip().title()
    if not name or len(name) < 2:
        return None
    conn = get_conn()
    row = conn.execute("SELECT id FROM people WHERE name = ? COLLATE NOCASE", (name,)).fetchone()
    if row:
        conn.close()
        return row["id"]
    cur = conn.execute(
        "INSERT INTO people (name, source, created_at) VALUES (?, ?, ?)",
        (name, source, datetime.now().isoformat(timespec="seconds")),
    )
    pid = cur.lastrowid
    conn.commit()
    conn.close()
    return pid


def add_fact(person_name, fact, category=None, source="manual"):
    pid = get_or_create_person(person_name)
    if not pid:
        return False
    category = category or _infer_category(fact)
    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()
    conn.execute(
        "INSERT INTO person_facts (person_id, fact, category, source, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (pid, fact, category, source, now),
    )
    if category == "contact":
        conn.execute("UPDATE people SET last_contacted = ? WHERE id = ?", (now, pid))
    conn.commit()
    conn.close()

    try:
        from rag import add_chunk
        p = get_person(person_name)
        title = f"{person_name}"
        content = f"{person_name}: {fact} [{category}]"
        add_chunk("person", str(pid), title, content,
                  {"person": person_name, "category": category})
    except Exception:
        pass
    return True


def set_birthday(person_name, birthday):
    pid = get_or_create_person(person_name)
    if not pid:
        return False
    conn = get_conn()
    conn.execute("UPDATE people SET birthday = ? WHERE id = ?", (birthday.strip(), pid))
    conn.commit()
    conn.close()
    return True


def mark_contacted(person_name):
    pid = get_or_create_person(person_name)
    if not pid:
        return False
    conn = get_conn()
    conn.execute("UPDATE people SET last_contacted = ? WHERE id = ?",
                 (datetime.now().isoformat(timespec="seconds"), pid))
    conn.commit()
    conn.close()
    return True


def extract_people_from_emails():
    """Auto-create people from senders you've emailed with."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT from_name FROM emails "
        "WHERE source = 'inbox' AND from_name != '' "
        "AND from_addr NOT LIKE '%noreply%' AND from_addr NOT LIKE '%no-reply%' "
        "AND from_addr NOT LIKE '%notification%'"
    ).fetchall()
    conn.close()
    count = 0
    for r in rows:
        if r["from_name"]:
            get_or_create_person(r["from_name"], source="email")
            count += 1
    return count


def upcoming_birthdays(days=30):
    conn = get_conn()
    rows = conn.execute(
        "SELECT name, birthday FROM people WHERE birthday IS NOT NULL AND birthday != ''"
    ).fetchall()
    conn.close()
    today = datetime.now().date()
    out = []
    for r in rows:
        try:
            parts = r["birthday"].split("-")
            if len(parts) == 2:
                month, day = int(parts[0]), int(parts[1])
            elif len(parts) == 3:
                month, day = int(parts[1]), int(parts[2])
            else:
                continue
            this_year = today.replace(month=month, day=day)
            if this_year < today:
                this_year = today.replace(year=today.year + 1, month=month, day=day)
            delta = (this_year - today).days
            if 0 <= delta <= days:
                out.append({"name": r["name"], "birthday": r["birthday"], "in_days": delta})
        except Exception:
            continue
    out.sort(key=lambda x: x["in_days"])
    return out


def people_needing_contact(days=14, limit=10):
    conn = get_conn()
    rows = conn.execute(
        "SELECT p.name, p.last_contacted, "
        "(SELECT MAX(received_at) FROM emails WHERE from_name = p.name COLLATE NOCASE) as last_email "
        "FROM people p"
    ).fetchall()
    conn.close()
    now = datetime.now()
    out = []
    for r in rows:
        candidates = [x for x in (r["last_contacted"], r["last_email"]) if x]
        if not candidates:
            continue
        try:
            latest = max(datetime.fromisoformat(c) for c in candidates)
        except Exception:
            continue
        age = (now - latest).days
        if age >= days:
            out.append({
                "name": r["name"],
                "days_since": age,
                "last": latest.isoformat(timespec="minutes"),
            })
    out.sort(key=lambda x: -x["days_since"])
    return out[:limit]


def get_person(name):
    conn = get_conn()
    p = conn.execute("SELECT * FROM people WHERE name = ? COLLATE NOCASE", (name,)).fetchone()
    if not p:
        conn.close()
        return None
    facts = conn.execute(
        "SELECT fact, category, created_at FROM person_facts "
        "WHERE person_id = ? AND resolved = 0 ORDER BY created_at DESC",
        (p["id"],),
    ).fetchall()
    conn.close()
    return {
        "id": p["id"],
        "name": p["name"],
        "birthday": p["birthday"],
        "last_contacted": p["last_contacted"],
        "facts": [dict(f) for f in facts],
    }


def people_brief():
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM people").fetchone()[0]
    conn.close()
    return {
        "total": total,
        "upcoming_birthdays": upcoming_birthdays(30),
        "needing_contact": people_needing_contact(14, limit=5),
    }