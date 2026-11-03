import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

"""Weekly Review & Retrospective Generator.

Aggregates the user's past 7 days across spending, habits, people touchpoints,
and file activity into an insightful personal retrospective report with a shareable card.
"""

from datetime import datetime, date, timedelta
from core.db import get_conn
from services.habits import list_habits, habit_insights
from services.spends import summary as spends_summary


def get_week_range() -> tuple[date, date]:
    """Return Monday to Sunday of the current week."""
    today = date.today()
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    return start, end


def generate_weekly_review() -> dict:
    start_date, end_date = get_week_range()
    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()
    today_iso = date.today().isoformat()

    conn = get_conn()

    # 1. Spends this week
    spend_rows = conn.execute(
        """
        SELECT amount, category, merchant, spent_at
        FROM spends
        WHERE spent_at >= ? AND spent_at <= ?
        ORDER BY amount DESC
        """,
        (start_iso, end_iso),
    ).fetchall()

    total_spent = sum(r["amount"] for r in spend_rows)
    by_category = {}
    for r in spend_rows:
        cat = r["category"] or "other"
        by_category[cat] = by_category.get(cat, 0.0) + r["amount"]

    top_categories = [
        {"category": k, "amount": round(v, 2), "percent": round(v / total_spent * 100) if total_spent else 0}
        for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
    ]

    # Prior week spend for comparison
    prev_start_iso = (start_date - timedelta(days=7)).isoformat()
    prev_end_iso = (start_date - timedelta(days=1)).isoformat()
    prev_rows = conn.execute(
        "SELECT amount FROM spends WHERE spent_at >= ? AND spent_at <= ?",
        (prev_start_iso, prev_end_iso),
    ).fetchall()
    prev_spent = sum(r["amount"] for r in prev_rows)
    spend_change_pct = (
        round(((total_spent - prev_spent) / prev_spent) * 100, 1) if prev_spent > 0 else 0.0
    )

    # 2. Habits this week
    habits = list_habits()
    habit_names = [h["name"] for h in habits if not h.get("archived")]

    # Get habit logs in this week
    habit_logs = conn.execute(
        """
        SELECT habit_id, date, status
        FROM habit_logs
        WHERE date >= ? AND date <= ?
        """,
        (start_iso, end_iso),
    ).fetchall()

    done_logs = [r for r in habit_logs if r["status"] == "done"]
    days_in_week_so_far = min(7, (date.today() - start_date).days + 1)
    total_opportunities = len(habit_names) * days_in_week_so_far
    habit_adherence_pct = (
        round((len(done_logs) / total_opportunities) * 100) if total_opportunities > 0 else 0
    )

    # Best active streak
    best_streak = 0
    best_habit = None
    for h in habits:
        streak = h.get("streak", 0)
        if streak > best_streak:
            best_streak = streak
            best_habit = h.get("name")

    # 3. People touched base with
    recent_people = conn.execute(
        """
        SELECT name, last_contacted
        FROM people
        WHERE last_contacted IS NOT NULL AND last_contacted >= ?
        ORDER BY last_contacted DESC
        LIMIT 5
        """,
        (start_iso,),
    ).fetchall()
    people_contacted = [dict(r) for r in recent_people]

    # 4. Debts settled this week
    settled_debts = conn.execute(
        """
        SELECT person, direction, amount
        FROM debts
        WHERE settled = 1 AND settled_at >= ?
        """,
        (start_iso,),
    ).fetchall()
    debts_settled_count = len(settled_debts)

    # 5. File activity
    file_count_row = conn.execute("SELECT COUNT(*) as c FROM files").fetchone()
    total_files = file_count_row["c"] if file_count_row else 0

    conn.close()

    # Formulate human insight
    insights = []
    if habit_adherence_pct >= 80:
        insights.append(f"Outstanding discipline! {habit_adherence_pct}% habit completion rate this week.")
    elif habit_adherence_pct >= 50:
        insights.append(f"Steady momentum on habits ({habit_adherence_pct}% completed).")
    elif habit_names:
        insights.append("Focus on consistency: lock in your core habits for the coming week.")

    if total_spent == 0:
        insights.append("Zero unneeded spend logged this week — great restraint.")
    elif spend_change_pct < 0:
        insights.append(f"Spent {abs(spend_change_pct)}% less than last week.")
    elif spend_change_pct > 20:
        insights.append(f"Spending spiked by {spend_change_pct}% over last week; top category was {top_categories[0]['category'] if top_categories else 'miscellaneous'}.")

    if len(people_contacted) >= 3:
        insights.append(f"Strong social connection: stayed in touch with {len(people_contacted)} people.")

    return {
        "start_date": start_iso,
        "end_date": end_iso,
        "week_number": date.today().isocalendar()[1],
        "year": date.today().year,
        "spending": {
            "total": round(total_spent, 2),
            "prev_total": round(prev_spent, 2),
            "change_pct": spend_change_pct,
            "top_categories": top_categories,
            "transactions_count": len(spend_rows),
        },
        "habits": {
            "total_habits": len(habit_names),
            "completed_logs": len(done_logs),
            "adherence_pct": habit_adherence_pct,
            "best_streak": best_streak,
            "best_habit": best_habit,
        },
        "people": {
            "contacted_count": len(people_contacted),
            "recent": people_contacted,
        },
        "debts_settled": debts_settled_count,
        "total_files": total_files,
        "insights": insights,
    }
