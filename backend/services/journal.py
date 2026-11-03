import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

"""Daily Journal and 30-Day Mood Matrix.

Enables quick daily reflection, 5-point mood rating, tag tracking,
and a visual 30-day mood heatmap.
"""

from datetime import datetime, date, timedelta
from typing import Optional, Union, List
from core.db import get_conn


MOOD_LABELS = {
    1: "Awful",
    2: "Low",
    3: "Neutral",
    4: "Good",
    5: "Radiant",
}

MOOD_EMOJIS = {
    1: "😫",
    2: "🙁",
    3: "😐",
    4: "🙂",
    5: "🤩",
}


def _clean_tags(tags: Union[str, List[str], None]) -> str:
    if not tags:
        return ""
    if isinstance(tags, list):
        items = [t.strip().lower() for t in tags if t and t.strip()]
        return ",".join(items)
    return ",".join([t.strip().lower() for t in tags.split(",") if t.strip()])


def get_entry(date_str: Optional[str] = None) -> Optional[dict]:
    d = (date_str or "").strip() or date.today().isoformat()
    conn = get_conn()
    row = conn.execute('SELECT * FROM context.journal WHERE date = %s', (d,)).fetchone()
    conn.close()
    if not row:
        return None
    item = dict(row)
    item["tags_list"] = [t.strip() for t in (item["tags"] or "").split(",") if t.strip()]
    item["mood_label"] = MOOD_LABELS.get(item["mood"], "Neutral")
    item["mood_emoji"] = MOOD_EMOJIS.get(item["mood"], "😐")
    return item


def save_entry(
    date_str: Optional[str] = None,
    mood: int = 3,
    headline: str = "",
    content: str = "",
    tags: Union[str, List[str], None] = "",
) -> dict:
    d = (date_str or "").strip() or date.today().isoformat()
    # Validate mood
    m = max(1, min(5, int(mood)))
    clean_h = (headline or "").strip()
    clean_c = (content or "").strip()
    clean_t = _clean_tags(tags)
    now = datetime.now().isoformat(timespec="seconds")

    conn = get_conn()
    conn.execute(
        '\n        INSERT INTO context.journal (date, mood, headline, content, tags, created_at, updated_at)\n        VALUES (%s, %s, %s, %s, %s, %s, %s)\n        ON CONFLICT(date) DO UPDATE SET\n            mood = excluded.mood,\n            headline = excluded.headline,\n            content = excluded.content,\n            tags = excluded.tags,\n            updated_at = excluded.updated_at\n        ',
        (d, m, clean_h, clean_c, clean_t, now, now),
    )
    conn.commit()
    conn.close()

    return get_entry(d)


def delete_entry(date_str: str) -> bool:
    d = (date_str or "").strip()
    if not d:
        return False
    conn = get_conn()
    cur = conn.execute('DELETE FROM context.journal WHERE date = %s', (d,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def list_entries(limit: int = 30) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        'SELECT * FROM context.journal ORDER BY date DESC LIMIT %s', (limit,)
    ).fetchall()
    conn.close()

    results = []
    for r in rows:
        item = dict(r)
        item["tags_list"] = [t.strip() for t in (item["tags"] or "").split(",") if t.strip()]
        item["mood_label"] = MOOD_LABELS.get(item["mood"], "Neutral")
        item["mood_emoji"] = MOOD_EMOJIS.get(item["mood"], "😐")
        results.append(item)
    return results


def mood_matrix(days: int = 30) -> dict:
    """Generate a 30-day consecutive calendar timeline with mood scores and stats."""
    today = date.today()
    start_day = today - timedelta(days=days - 1)

    conn = get_conn()
    rows = conn.execute(
        'SELECT * FROM context.journal WHERE date >= %s AND date <= %s ORDER BY date ASC',
        (start_day.isoformat(), today.isoformat()),
    ).fetchall()
    conn.close()

    by_date = {r["date"]: dict(r) for r in rows}

    matrix = []
    moods_recorded = []
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    tag_counts = {}

    for i in range(days):
        cur_date = start_day + timedelta(days=i)
        cur_iso = cur_date.isoformat()
        entry = by_date.get(cur_iso)

        if entry:
            m = entry["mood"]
            moods_recorded.append(m)
            distribution[m] = distribution.get(m, 0) + 1
            raw_tags = [t.strip() for t in (entry["tags"] or "").split(",") if t.strip()]
            for t in raw_tags:
                tag_counts[t] = tag_counts.get(t, 0) + 1

            matrix.append({
                "date": cur_iso,
                "day_of_week": cur_date.strftime("%a"),
                "day_number": cur_date.day,
                "month": cur_date.strftime("%b"),
                "has_entry": True,
                "mood": m,
                "mood_label": MOOD_LABELS.get(m, "Neutral"),
                "mood_emoji": MOOD_EMOJIS.get(m, "😐"),
                "headline": entry.get("headline", ""),
                "tags": raw_tags,
            })
        else:
            matrix.append({
                "date": cur_iso,
                "day_of_week": cur_date.strftime("%a"),
                "day_number": cur_date.day,
                "month": cur_date.strftime("%b"),
                "has_entry": False,
                "mood": None,
                "mood_label": None,
                "mood_emoji": None,
                "headline": "",
                "tags": [],
            })

    # Calculate current journal streak
    streak = 0
    check_day = today
    while True:
        if check_day.isoformat() in by_date:
            streak += 1
            check_day -= timedelta(days=1)
        elif check_day == today:
            # If not yet journaled today, check if yesterday was done
            check_day -= timedelta(days=1)
            continue
        else:
            break

    avg_mood = round(sum(moods_recorded) / len(moods_recorded), 1) if moods_recorded else 3.0

    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:6]

    return {
        "matrix": matrix,
        "days_count": days,
        "entries_count": len(moods_recorded),
        "average_mood": avg_mood,
        "streak": streak,
        "distribution": distribution,
        "top_tags": [{"tag": k, "count": v} for k, v in top_tags],
    }
