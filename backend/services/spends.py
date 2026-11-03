import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

from datetime import datetime, timedelta
from core.db import get_conn


def add_spend(amount, merchant, category="other", spent_at=None):
    now = datetime.now().isoformat(timespec="seconds")
    today = (spent_at or datetime.now().date().isoformat())
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO spends (amount, merchant, category, spent_at, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (float(amount), (merchant or "").strip(), (category or "other").lower(), today, now),
    )
    sid = cur.lastrowid          # ← capture ID from same connection
    conn.commit()
    conn.close()

    try:
        from services.rag import add_chunk
        add_chunk(
            "spend", str(sid),
            f"₹{amount} {merchant}",
            f"Spent ₹{amount} on {merchant} ({category}) on {today}",
            {"amount": float(amount), "merchant": merchant,
             "category": category, "date": today},
        )
    except Exception as e:
        print(f"[spends] chunk failed: {e}")
    return sid


def update_spend(spend_id, amount=None, merchant=None, category=None, spent_at=None):
    conn = get_conn()
    cur = conn.execute("SELECT * FROM spends WHERE id = ?", (spend_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    current = dict(row)
    new_amount = float(amount) if amount is not None else current["amount"]
    new_merchant = merchant.strip() if merchant is not None else current["merchant"]
    new_category = (category.lower().strip() if category is not None else current["category"]) or "other"
    new_spent_at = spent_at.strip() if spent_at is not None else current["spent_at"]

    conn.execute(
        "UPDATE spends SET amount = ?, merchant = ?, category = ?, spent_at = ? WHERE id = ?",
        (new_amount, new_merchant, new_category, new_spent_at, spend_id),
    )
    conn.commit()
    conn.close()

    try:
        from services.rag import add_chunk
        add_chunk(
            "spend", str(spend_id),
            f"₹{new_amount} {new_merchant}",
            f"Spent ₹{new_amount} on {new_merchant} ({new_category}) on {new_spent_at}",
            {"amount": float(new_amount), "merchant": new_merchant,
             "category": new_category, "date": new_spent_at},
        )
    except Exception as e:
        print(f"[spends] update chunk failed: {e}")

    return {
        "id": spend_id,
        "amount": new_amount,
        "merchant": new_merchant,
        "category": new_category,
        "spent_at": new_spent_at,
        "created_at": current.get("created_at"),
    }


def delete_spend(spend_id):
    conn = get_conn()
    cur = conn.execute("DELETE FROM spends WHERE id = ?", (spend_id,))
    deleted = cur.rowcount > 0
    if deleted:
        conn.execute("DELETE FROM chunks WHERE source_type = 'spend' AND source_id = ?", (str(spend_id),))
    conn.commit()
    conn.close()
    return deleted


def set_budget(category, amount, period="month"):
    conn = get_conn()
    conn.execute("DELETE FROM budgets WHERE category = ?", (category.lower(),))
    if float(amount) > 0:
        conn.execute(
            "INSERT INTO budgets (category, amount, period, created_at) VALUES (?, ?, ?, ?)",
            (category.lower(), float(amount), period, datetime.now().isoformat(timespec="seconds")),
        )
    conn.commit()
    conn.close()


def delete_budget(category):
    conn = get_conn()
    cur = conn.execute("DELETE FROM budgets WHERE category = ?", (category.lower(),))
    deleted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def period_range(period="month"):
    today = datetime.now().date()
    if period == "week":
        start = today - timedelta(days=today.weekday())
    elif period == "month":
        start = today.replace(day=1)
    else:
        start = today
    return start.isoformat(), today.isoformat()


def summary(period="month"):
    start, end = period_range(period)
    conn = get_conn()
    total = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM spends WHERE spent_at BETWEEN ? AND ?",
        (start, end),
    ).fetchone()[0]
    by_cat = conn.execute(
        "SELECT category, SUM(amount) as total, COUNT(*) as count "
        "FROM spends WHERE spent_at BETWEEN ? AND ? "
        "GROUP BY category ORDER BY total DESC",
        (start, end),
    ).fetchall()
    top_merchants = conn.execute(
        "SELECT merchant, SUM(amount) as total, COUNT(*) as count "
        "FROM spends WHERE spent_at BETWEEN ? AND ? AND merchant != '' "
        "GROUP BY merchant ORDER BY total DESC LIMIT 5",
        (start, end),
    ).fetchall()
    budgets = conn.execute("SELECT category, amount FROM budgets").fetchall()
    budget_status = []
    for b in budgets:
        spent = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM spends "
            "WHERE category = ? AND spent_at BETWEEN ? AND ?",
            (b["category"], start, end),
        ).fetchone()[0]
        budget_status.append({
            "category": b["category"],
            "budget": b["amount"],
            "spent": round(spent, 2),
            "over": spent > b["amount"],
            "percent": round(spent / b["amount"] * 100) if b["amount"] else 0,
            "remaining": round(max(0, b["amount"] - spent), 2),
        })
    conn.close()
    return {
        "period": period,
        "start": start,
        "end": end,
        "total": round(total, 2),
        "by_category": [dict(r) for r in by_cat],
        "top_merchants": [dict(r) for r in top_merchants],
        "budgets": budget_status,
        "compare": compare_periods(period),
        "transactions": transactions_in_range(start, end),
        "trend": daily_trend(14),
    }


def transactions_in_range(start, end, limit=250):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, amount, merchant, category, spent_at, created_at "
        "FROM spends WHERE spent_at BETWEEN ? AND ? "
        "ORDER BY spent_at DESC, id DESC LIMIT ?",
        (start, end, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def daily_trend(days=14):
    """Daily spend totals for the last `days` days, oldest first (zero-filled)."""
    today = datetime.now().date()
    start = today - timedelta(days=days - 1)
    conn = get_conn()
    rows = conn.execute(
        "SELECT spent_at, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count "
        "FROM spends WHERE spent_at BETWEEN ? AND ? GROUP BY spent_at",
        (start.isoformat(), today.isoformat()),
    ).fetchall()
    conn.close()
    by_day = {r["spent_at"]: r for r in rows}
    out = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).isoformat()
        row = by_day.get(day)
        out.append({
            "date": day,
            "total": round(row["total"], 2) if row else 0,
            "count": row["count"] if row else 0,
        })
    return out


def compare_periods(period="week"):
    today = datetime.now().date()
    if period == "week":
        this_start = today - timedelta(days=today.weekday())
        last_start_dt = this_start - timedelta(days=7)
        last_end = this_start - timedelta(days=1)
    else:
        this_start = today.replace(day=1)
        last_month_end = this_start - timedelta(days=1)
        last_start_dt = last_month_end.replace(day=1)
        last_end = last_month_end
    conn = get_conn()
    this_total = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM spends WHERE spent_at BETWEEN ? AND ?",
        (this_start.isoformat(), today.isoformat()),
    ).fetchone()[0]
    last_total = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM spends WHERE spent_at BETWEEN ? AND ?",
        (last_start_dt.isoformat(), last_end.isoformat()),
    ).fetchone()[0]
    conn.close()
    change = 0
    if last_total > 0:
        change = round((this_total - last_total) / last_total * 100)
    return {
        "this_total": round(this_total, 2),
        "last_total": round(last_total, 2),
        "change_pct": change,
    }


def detect_leaks():
    s = summary("month")
    leaks = []
    for c in s["by_category"]:
        if c["total"] > 1000 and c["count"] >= 5:
            leaks.append({
                "kind": "high_spend",
                "detail": f"{c['category']}: ₹{c['total']:.0f} across {c['count']} entries",
            })
    for m in s["top_merchants"]:
        if m["count"] >= 5:
            leaks.append({
                "kind": "frequent_merchant",
                "detail": f"{m['merchant']}: {m['count']} times (₹{m['total']:.0f})",
            })
    return leaks[:3]


def spend_brief():
    week = summary("week")
    month = summary("month")
    categories = sorted(
        {c["category"] for c in month["by_category"]}
        | {b["category"] for b in month["budgets"]}
    )
    return {
        "week_total": week["total"],
        "week_by_category": week["by_category"][:5],
        "month_total": month["total"],
        "budgets": month["budgets"],
        "compare": compare_periods("week"),
        "leaks": detect_leaks(),
        # Real categories present in the database, so the quick-add form never
        # ships a hardcoded category list.
        "categories": categories,
    }