import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

"""Habits tracker: habits, daily logs, streaks and honest correlations."""

import re
from datetime import date, datetime, timedelta

from core.db import get_conn


DEFAULT_EMOJI = "●"
DEFAULT_COLOR = "#8b5cf6"
VALID_STATUSES = {"done", "skipped"}

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def _today():
    return date.today()


def _safe_date(year, month, day):
    try:
        return date(int(year), int(month), int(day))
    except (TypeError, ValueError):
        return None


def _parse_date(value):
    """Accept ISO dates plus the short phrases the UI and ask bar use."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = (value or "").strip()
    if not text:
        return _today()

    lower = text.lower()
    today = _today()

    if lower in ("today", "now"):
        return today
    if lower == "yesterday":
        return today - timedelta(days=1)
    if lower == "day before yesterday":
        return today - timedelta(days=2)

    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        parsed = _safe_date(*match.groups())
        if parsed:
            return parsed

    match = re.fullmatch(r"(\d{1,2})\s+days?\s+ago", lower)
    if match:
        return today - timedelta(days=int(match.group(1)))

    match = re.fullmatch(r"last\s+(\w+)", lower)
    if match and match.group(1) in WEEKDAYS:
        target = WEEKDAYS[match.group(1)]
        days = (today.weekday() - target) % 7
        if days == 0:
            days = 7
        return today - timedelta(days=days)

    match = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?", text)
    if match:
        first, second = int(match.group(1)), int(match.group(2))
        year = int(match.group(3)) if match.group(3) else today.year
        if year < 100:
            year += 2000
        day, month = first, second
        if month > 12 and day <= 12:
            day, month = second, first
        parsed = _safe_date(year, month, day)
        if parsed:
            return parsed

    match = re.fullmatch(
        r"(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?", lower
    )
    if match and match.group(2) in MONTHS:
        year = int(match.group(3)) if match.group(3) else today.year
        parsed = _safe_date(year, MONTHS[match.group(2)], int(match.group(1)))
        if parsed:
            return parsed

    match = re.fullmatch(
        r"([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?", lower
    )
    if match and match.group(1) in MONTHS:
        year = int(match.group(3)) if match.group(3) else today.year
        parsed = _safe_date(year, MONTHS[match.group(1)], int(match.group(2)))
        if parsed:
            return parsed

    return today


def _clamp_target(value):
    try:
        target = int(value)
    except (TypeError, ValueError):
        target = 7
    return max(1, min(7, target))


def _clean_color(value):
    if isinstance(value, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", value.strip()):
        return value.strip()
    return DEFAULT_COLOR


def _clean_name(value):
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_name(value):
    return re.sub(r"[^a-z0-9 ]", "", (value or "").lower()).strip()


def _habit_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "emoji": row["emoji"] or DEFAULT_EMOJI,
        "color": row["color"] or DEFAULT_COLOR,
        "target_per_week": row["target_per_week"] or 7,
        "created_at": row["created_at"],
        "archived": bool(row["archived"]),
    }


def _find_habit(conn, name_or_id):
    value = name_or_id
    if isinstance(value, int) or (isinstance(value, str) and value.strip().isdigit()):
        return conn.execute(
            'SELECT * FROM context.habits WHERE id = %s', (int(value),)
        ).fetchone()
    name = _clean_name(str(value or ""))
    if not name:
        return None
    return conn.execute(
        'SELECT * FROM context.habits WHERE lower(name) = lower(%s)', (name,)
    ).fetchone()


def _create_habit(conn, name, emoji=None, color=None, target_per_week=7):
    now = datetime.now().isoformat(timespec="seconds")
    cur = conn.execute(
        'INSERT INTO context.habits (name, emoji, color, target_per_week, created_at, archived) VALUES (%s, %s, %s, %s, %s, 0) RETURNING id',
        (
            _clean_name(name),
            (emoji or DEFAULT_EMOJI).strip() or DEFAULT_EMOJI,
            _clean_color(color),
            _clamp_target(target_per_week),
            now,
        ),
    )
    conn.commit()
    return cur.fetchone()[0]


def add_habit(name, emoji=None, color=None, target_per_week=7):
    clean = _clean_name(name)
    if not clean:
        raise ValueError("habit name is required")

    conn = get_conn()
    existing = _find_habit(conn, clean)
    if existing:
        next_emoji = (emoji or existing["emoji"] or DEFAULT_EMOJI).strip() or DEFAULT_EMOJI
        next_color = _clean_color(color or existing["color"])
        next_target = _clamp_target(
            target_per_week if target_per_week is not None else existing["target_per_week"]
        )
        conn.execute(
            'UPDATE context.habits SET emoji = %s, color = %s, target_per_week = %s, archived = 0 WHERE id = %s',
            (next_emoji, next_color, next_target, existing["id"]),
        )
        conn.commit()
        habit_id = existing["id"]
    else:
        habit_id = _create_habit(conn, clean, emoji, color, target_per_week)
    conn.close()
    return get_habit(habit_id)


def archive_habit(name_or_id):
    conn = get_conn()
    row = _find_habit(conn, name_or_id)
    if not row:
        conn.close()
        return False
    conn.execute('UPDATE context.habits SET archived = 1 WHERE id = %s', (row["id"],))
    conn.commit()
    conn.close()
    return True


def update_habit(name_or_id, new_name=None, emoji=None, color=None, target_per_week=None):
    conn = get_conn()
    row = _find_habit(conn, name_or_id)
    if not row:
        conn.close()
        return None

    habit_id = row["id"]
    next_name = _clean_name(new_name) if new_name is not None else row["name"]
    if not next_name:
        conn.close()
        raise ValueError("habit name is required")

    if next_name.lower() != (row["name"] or "").lower():
        clash = conn.execute(
            'SELECT id FROM context.habits WHERE lower(name) = lower(%s) AND id != %s',
            (next_name, habit_id),
        ).fetchone()
        if clash:
            conn.close()
            raise ValueError("a habit with that name already exists")

    next_emoji = (emoji if emoji is not None else row["emoji"] or DEFAULT_EMOJI).strip() or DEFAULT_EMOJI
    next_color = _clean_color(color if color is not None else row["color"])
    next_target = _clamp_target(
        target_per_week if target_per_week is not None else row["target_per_week"]
    )

    conn.execute(
        'UPDATE context.habits SET name = %s, emoji = %s, color = %s, target_per_week = %s WHERE id = %s',
        (next_name, next_emoji, next_color, next_target, habit_id),
    )
    conn.commit()
    conn.close()
    return get_habit(habit_id)


def log_habit(name_or_id, date_value, status, note=None):
    if status not in VALID_STATUSES:
        raise ValueError("status must be 'done' or 'skipped'")

    day = _parse_date(date_value).isoformat()
    conn = get_conn()
    row = _find_habit(conn, name_or_id)

    if not row:
        clean = _clean_name(str(name_or_id or ""))
        if not clean:
            conn.close()
            raise ValueError("habit name is required")
        habit_id = _create_habit(conn, clean)
    else:
        habit_id = row["id"]
        if row["archived"]:
            conn.execute('UPDATE context.habits SET archived = 0 WHERE id = %s', (habit_id,))
            conn.commit()

    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        'INSERT INTO context.habit_logs (habit_id, date, status, note, created_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT(user_id, habit_id, date) DO UPDATE SET status = excluded.status, note = excluded.note',
        (habit_id, day, status, note or "", now),
    )
    conn.commit()
    conn.close()
    return get_habit(habit_id)


def clear_habit_log(name_or_id, date_value):
    day = _parse_date(date_value).isoformat()
    conn = get_conn()
    row = _find_habit(conn, name_or_id)
    if not row:
        conn.close()
        return get_habit(name_or_id)
    conn.execute(
        'DELETE FROM context.habit_logs WHERE habit_id = %s AND date = %s',
        (row["id"], day),
    )
    conn.commit()
    conn.close()
    return get_habit(row["id"])


def _log_map(conn, habit_id, start, end):
    rows = conn.execute(
        'SELECT date, status, note FROM context.habit_logs WHERE habit_id = %s AND date BETWEEN %s AND %s ORDER BY date',
        (habit_id, start.isoformat(), end.isoformat()),
    ).fetchall()
    return {row["date"]: {"date": row["date"], "status": row["status"], "note": row["note"]} for row in rows}


def _last_days(conn, habit_id, days):
    today = _today()
    start = today - timedelta(days=days - 1)
    logs = _log_map(conn, habit_id, start, today)
    result = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).isoformat()
        result.append({
            "date": day,
            "status": logs.get(day, {}).get("status"),
        })
    return result


def _window_count(conn, habit_id, start, end):
    return conn.execute(
        "SELECT COUNT(*) FROM context.habit_logs WHERE habit_id = %s AND status = 'done' AND date BETWEEN %s AND %s",
        (habit_id, start.isoformat(), end.isoformat()),
    ).fetchone()[0]


def _completion_week(conn, habit_id):
    today = _today()
    start = today - timedelta(days=6)
    return _window_count(conn, habit_id, start, today)


def _completion_month(conn, habit_id):
    today = _today()
    start = today - timedelta(days=29)
    return _window_count(conn, habit_id, start, today)


def habit_streak(habit_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT date, status FROM context.habit_logs WHERE habit_id = %s AND status IN ('done', 'skipped') ORDER BY date DESC LIMIT 1000",
        (habit_id,),
    ).fetchall()
    conn.close()

    statuses = {date.fromisoformat(row["date"]): row["status"] for row in rows}
    today = _today()
    if statuses.get(today) == "skipped":
        return 0
    cursor = today if statuses.get(today) == "done" else today - timedelta(days=1)

    streak = 0
    while statuses.get(cursor) == "done":
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def habit_longest_streak(habit_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT date FROM context.habit_logs WHERE habit_id = %s AND status = 'done' ORDER BY date",
        (habit_id,),
    ).fetchall()
    conn.close()

    longest = 0
    current = 0
    previous = None
    for row in rows:
        day = date.fromisoformat(row["date"])
        if previous and day == previous + timedelta(days=1):
            current += 1
        else:
            current = 1
        longest = max(longest, current)
        previous = day
    return longest


def get_habit(name_or_id):
    conn = get_conn()
    row = _find_habit(conn, name_or_id)
    if not row:
        conn.close()
        return None

    habit = _habit_dict(row)
    today = _today()
    logs = _log_map(
        conn,
        habit["id"],
        today - timedelta(days=29),
        today,
    )
    habit.update({
        "streak": habit_streak(habit["id"]),
        "longest_streak": habit_longest_streak(habit["id"]),
        "completion_this_week": _completion_week(conn, habit["id"]),
        "completion_this_month": _completion_month(conn, habit["id"]),
        "last_7_days": _last_days(conn, habit["id"], 7),
        "today_status": logs.get(today.isoformat(), {}).get("status"),
        "logs": [logs[key] for key in sorted(logs)],
    })
    conn.close()
    return habit


def list_habits():
    conn = get_conn()
    rows = conn.execute(
        'SELECT * FROM context.habits WHERE archived = 0 ORDER BY created_at, lower(name)'
    ).fetchall()

    habits = []
    for row in rows:
        habit = _habit_dict(row)
        habit.update({
            "streak": habit_streak(habit["id"]),
            "longest_streak": habit_longest_streak(habit["id"]),
            "completion_this_week": _completion_week(conn, habit["id"]),
            "completion_this_month": _completion_month(conn, habit["id"]),
            "last_7_days": _last_days(conn, habit["id"], 7),
            "today_status": None,
        })
        today = _today().isoformat()
        habit["today_status"] = next(
            (item["status"] for item in habit["last_7_days"] if item["date"] == today),
            None,
        )
        habits.append(habit)

    conn.close()
    return habits


# ── Insights ─────────────────────────────────────────────────────────────────

def _table_exists(conn, table):
    row = conn.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'context' AND table_name = %s",
        (table,),
    ).fetchone()
    return bool(row)


def _table_columns(conn, table):
    try:
        return {row["name"].lower() for row in conn.execute(
            "SELECT column_name AS name FROM information_schema.columns "
            "WHERE table_schema = 'context' AND table_name = %s", (table,)
        )}
    except Exception:
        return set()


def _find_habit_row(conn, names):
    rows = conn.execute('SELECT * FROM context.habits WHERE archived = 0').fetchall()
    wanted = {_normalize_name(name) for name in names}
    for row in rows:
        if _normalize_name(row["name"]) in wanted:
            return row
    for row in rows:
        normalized = _normalize_name(row["name"])
        if any(name in normalized or normalized in name for name in wanted):
            return row
    return None


def _spend_insight(conn):
    habit = _find_habit_row(conn, ["no sugar", "nosugar", "sugar free", "sugarfree"])
    if not habit:
        return None

    logs = conn.execute(
        "SELECT date, status FROM context.habit_logs WHERE habit_id = %s AND status IN ('done', 'skipped') AND date >= %s ORDER BY date",
        (habit["id"], (_today() - timedelta(days=89)).isoformat()),
    ).fetchall()
    if len(logs) < 7:
        return None

    start = logs[0]["date"]
    end = logs[-1]["date"]
    spend_rows = conn.execute(
        'SELECT spent_at, SUM(amount) AS total FROM context.spends WHERE spent_at BETWEEN %s AND %s GROUP BY spent_at',
        (start, end),
    ).fetchall()
    spends = {row["spent_at"]: float(row["total"] or 0) for row in spend_rows}

    done = [spends.get(row["date"], 0.0) for row in logs if row["status"] == "done"]
    skipped = [spends.get(row["date"], 0.0) for row in logs if row["status"] == "skipped"]
    if len(done) < 3 or len(skipped) < 3:
        return None

    avg_done = sum(done) / len(done)
    avg_skipped = sum(skipped) / len(skipped)
    if avg_done <= 0:
        return None

    ratio = avg_skipped / avg_done
    if ratio < 1.5:
        return None

    return {
        "habit_id": habit["id"],
        "habit_name": habit["name"],
        "kind": "spend",
        "message": f"You spend {ratio:.1f}x more on days you skip {habit['name']}",
        "data_points": len(logs),
    }


def _sleep_insight(conn):
    if not _table_exists(conn, "sleep"):
        return None
    columns = _table_columns(conn, "sleep")
    value_col = next(
        (name for name in ("hours", "duration", "sleep_hours", "value") if name in columns),
        None,
    )
    if "date" not in columns or not value_col:
        return None

    habit = _find_habit_row(conn, ["gym", "workout", "exercise"])
    if not habit:
        return None

    logs = conn.execute(
        "SELECT date, status FROM context.habit_logs WHERE habit_id = %s AND status IN ('done', 'skipped') AND date >= %s ORDER BY date",
        (habit["id"], (_today() - timedelta(days=89)).isoformat()),
    ).fetchall()
    if len(logs) < 7:
        return None

    sleep_rows = conn.execute(
        f"SELECT date, {value_col} AS hours FROM sleep"
    ).fetchall()
    sleep = {row["date"]: float(row["hours"] or 0) for row in sleep_rows}

    paired = []
    for row in logs:
        day = date.fromisoformat(row["date"])
        hours = sleep.get((day - timedelta(days=1)).isoformat())
        if hours is not None:
            paired.append((hours, row["status"]))
    if len(paired) < 7:
        return None

    short = [status for hours, status in paired if hours < 6]
    normal = [status for hours, status in paired if hours >= 6]
    if len(short) < 3 or len(normal) < 3:
        return None

    short_rate = short.count("skipped") / len(short)
    normal_rate = normal.count("skipped") / len(normal)
    if short_rate <= 0:
        return None
    if normal_rate <= 0:
        message = f"You skip {habit['name']} on days after <6h sleep, but rarely otherwise"
    else:
        ratio = short_rate / normal_rate
        if ratio < 1.5:
            return None
        message = f"You skip {habit['name']} {ratio:.1f}x more on days after <6h sleep"

    return {
        "habit_id": habit["id"],
        "habit_name": habit["name"],
        "kind": "sleep",
        "message": message,
        "data_points": len(paired),
    }


def _mood_insight(conn):
    table = next((name for name in ("moods", "mood") if _table_exists(conn, name)), None)
    if not table:
        return None
    columns = _table_columns(conn, table)
    value_col = next(
        (name for name in ("mood", "score", "value", "rating") if name in columns),
        None,
    )
    if "date" not in columns or not value_col:
        return None

    habit = _find_habit_row(conn, ["reading", "read", "books"])
    if not habit:
        return None

    logs = conn.execute(
        "SELECT date, status FROM context.habit_logs WHERE habit_id = %s AND status IN ('done', 'skipped') AND date >= %s ORDER BY date",
        (habit["id"], (_today() - timedelta(days=89)).isoformat()),
    ).fetchall()
    if len(logs) < 7:
        return None

    mood_rows = conn.execute(
        f"SELECT date, {value_col} AS mood FROM {table}"
    ).fetchall()
    moods = {row["date"]: float(row["mood"] or 0) for row in mood_rows}

    done = [moods[row["date"]] for row in logs if row["status"] == "done" and row["date"] in moods]
    skipped = [moods[row["date"]] for row in logs if row["status"] == "skipped" and row["date"] in moods]
    if len(done) < 3 or len(skipped) < 3:
        return None

    avg_done = sum(done) / len(done)
    avg_skipped = sum(skipped) / len(skipped)
    if avg_skipped <= 0:
        return None

    change = (avg_done - avg_skipped) / avg_skipped
    if change < 0.1:
        return None

    return {
        "habit_id": habit["id"],
        "habit_name": habit["name"],
        "kind": "mood",
        "message": f"Mood +{change * 100:.0f}% on days you {habit['name']}",
        "data_points": len(done) + len(skipped),
    }


def habit_insights():
    conn = get_conn()
    insights = []
    for builder in (_spend_insight, _sleep_insight, _mood_insight):
        try:
            insight = builder(conn)
        except Exception:
            insight = None
        if insight:
            insights.append(insight)
    conn.close()
    return insights
