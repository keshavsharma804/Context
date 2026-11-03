from datetime import datetime, timedelta
from db import get_conn


def detect_all():
    patterns = []
    patterns.extend(detect_late_opening())
    patterns.extend(detect_browse_apply())
    patterns.extend(detect_spend_deadline())
    patterns.extend(detect_silent_threads())
    patterns.extend(detect_contact_droughts())
    patterns.extend(detect_weekend_spend())
    save_patterns(patterns)
    return patterns


def detect_late_opening(days=30):
    conn = get_conn()
    rows = conn.execute(
        "SELECT name, downloaded, last_opened FROM files "
        "WHERE category IN ('academic', 'report') AND downloaded > ? LIMIT 100",
        ((datetime.now() - timedelta(days=days)).isoformat(),),
    ).fetchall()
    conn.close()
    late = 0
    for r in rows:
        try:
            dl = datetime.fromisoformat(r["downloaded"])
            lo = datetime.fromisoformat(r["last_opened"])
            if (lo - dl).total_seconds() / 3600 > 48:
                late += 1
        except Exception:
            continue
    if late >= 3:
        return [{
            "kind": "late_open",
            "title": "You open assignment briefs late",
            "detail": f"{late} briefs this month were opened >48h after download. "
                     f"That's a common cause of late submissions.",
            "severity": "warn",
        }]
    return []


def detect_browse_apply(days=14):
    conn = get_conn()
    since = (datetime.now() - timedelta(days=days)).isoformat(timespec="minutes")
    browses = conn.execute(
        "SELECT COUNT(*) FROM history WHERE "
        "(url LIKE '%linkedin.com/jobs%' OR url LIKE '%naukri%' OR url LIKE '%instahyre%' "
        "OR url LIKE '%wellfound%' OR url LIKE '%/careers%' OR url LIKE '%internshala%') "
        "AND last_visit > ?",
        (since,),
    ).fetchone()[0]
    apps = conn.execute(
        "SELECT COUNT(*) FROM applications WHERE applied_at > ?",
        ((datetime.now() - timedelta(days=days)).date().isoformat(),),
    ).fetchone()[0]
    conn.close()
    if browses >= 5 and apps * 3 < browses:
        return [{
            "kind": "browse_apply",
            "title": "You browse jobs but don't apply",
            "detail": f"{browses} job listings browsed in {days}d, only {apps} applications. "
                     f"You're researching instead of applying.",
            "severity": "warn",
        }]
    return []


def detect_spend_deadline(days=30):
    conn = get_conn()
    since = (datetime.now() - timedelta(days=days)).date().isoformat()
    deadlines = conn.execute(
        "SELECT DISTINCT substr(start_at, 1, 10) FROM events "
        "WHERE (title LIKE '%deadline%' OR title LIKE '%submission%' "
        "OR title LIKE '%due%' OR title LIKE '%exam%' OR title LIKE '%assignment%') "
        "AND start_at > ?",
        (since,),
    ).fetchall()
    deadline_set = {r[0] for r in deadlines}
    if not deadline_set:
        conn.close()
        return []

    spends = conn.execute(
        "SELECT amount, spent_at FROM spends WHERE spent_at > ?", (since,)
    ).fetchall()
    conn.close()
    if not spends:
        return []

    dl_spends, other = [], []
    for s in spends:
        try:
            d = datetime.fromisoformat(s["spent_at"]).date()
            week = d - timedelta(days=d.weekday())
            if any((week + timedelta(days=i)).isoformat() in deadline_set for i in range(7)):
                dl_spends.append(s["amount"])
            else:
                other.append(s["amount"])
        except Exception:
            continue

    if len(dl_spends) < 3 or len(other) < 3:
        return []
    d_avg = sum(dl_spends) / len(dl_spends)
    o_avg = sum(other) / len(other)
    if d_avg > o_avg * 1.5:
        return [{
            "kind": "deadline_spend",
            "title": "Deadline weeks cost you more",
            "detail": f"Avg spend on deadline weeks: ₹{d_avg:.0f} vs ₹{o_avg:.0f} otherwise "
                     f"({round((d_avg/o_avg-1)*100)}% more).",
            "severity": "info",
        }]
    return []


def detect_silent_threads(days=7):
    conn = get_conn()
    since = (datetime.now() - timedelta(days=days)).isoformat()
    silent = conn.execute(
        "SELECT from_name, from_addr, subject, received_at FROM emails "
        "WHERE needs_reply = 1 AND received_at < ? ORDER BY received_at",
        (since,),
    ).fetchall()
    conn.close()
    if len(silent) >= 3:
        o = silent[0]
        return [{
            "kind": "silent_threads",
            "title": f"{len(silent)} emails unanswered for over a week",
            "detail": f"Oldest: {o['from_name'] or o['from_addr']} — '{o['subject'][:60]}'",
            "severity": "warn",
        }]
    return []


def detect_contact_droughts(days=14):
    try:
        from people import people_needing_contact
        drifting = people_needing_contact(days, limit=3)
        if len(drifting) >= 2:
            names = ", ".join(d["name"] for d in drifting)
            return [{
                "kind": "contact_drought",
                "title": f"{len(drifting)} relationships drifting",
                "detail": f"Haven't contacted {names} in {days}+ days.",
                "severity": "info",
            }]
    except Exception:
        pass
    return []


def detect_weekend_spend(days=30):
    conn = get_conn()
    since = (datetime.now() - timedelta(days=days)).date().isoformat()
    rows = conn.execute(
        "SELECT amount, spent_at FROM spends WHERE spent_at > ?", (since,)
    ).fetchall()
    conn.close()
    wk, wd = [], []
    for r in rows:
        try:
            if datetime.fromisoformat(r["spent_at"]).weekday() >= 5:
                wk.append(r["amount"])
            else:
                wd.append(r["amount"])
        except Exception:
            continue
    if len(wk) >= 3 and len(wd) >= 3:
        a, b = sum(wk) / len(wk), sum(wd) / len(wd)
        if a > b * 1.5:
            return [{
                "kind": "weekend_spend",
                "title": "You overspend on weekends",
                "detail": f"Weekend avg ₹{a:.0f} vs weekday ₹{b:.0f} "
                         f"({round((a/b-1)*100)}% more).",
                "severity": "info",
            }]
    return []


def save_patterns(patterns):
    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()
    conn.execute(
        "DELETE FROM patterns_detected WHERE detected_at < ?",
        ((datetime.now() - timedelta(days=2)).isoformat(),),
    )
    for p in patterns:
        existing = conn.execute(
            "SELECT id FROM patterns_detected WHERE kind = ? AND detected_at > ?",
            (p["kind"], (datetime.now() - timedelta(hours=6)).isoformat()),
        ).fetchone()
        if existing:
            continue
        conn.execute(
            "INSERT INTO patterns_detected (kind, title, detail, severity, detected_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (p["kind"], p["title"], p["detail"], p["severity"], now),
        )
    conn.commit()
    conn.close()


def get_patterns(limit=10):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, kind, title, detail, severity, detected_at "
        "FROM patterns_detected WHERE dismissed = 0 "
        "GROUP BY title HAVING MAX(detected_at) "
        "ORDER BY detected_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def dismiss_pattern(pattern_id):
    conn = get_conn()
    conn.execute("UPDATE patterns_detected SET dismissed = 1 WHERE id = ?", (pattern_id,))
    conn.commit()
    conn.close()


def patterns_brief():
    p = get_patterns(8)
    return {"patterns": p, "count": len(p)}