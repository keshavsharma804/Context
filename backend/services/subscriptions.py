import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

"""Subscriptions and recurring renewals tracker.

Helps users monitor recurring software, utilities, memberships, and services,
warning before renewals occur and calculating total monthly and annual burn rate.
"""

from datetime import datetime, date, timedelta
from core.db import get_conn


VALID_CYCLES = {"monthly", "yearly", "quarterly", "weekly"}
VALID_CATEGORIES = {
    "entertainment",
    "software",
    "cloud",
    "utilities",
    "health",
    "gym",
    "work",
    "education",
    "other",
}


def _calc_equivalents(amount: float, cycle: str) -> tuple[float, float]:
    """Return (monthly_equivalent, yearly_equivalent) for a given amount and billing cycle."""
    c = (cycle or "monthly").lower()
    if c == "yearly":
        return round(amount / 12.0, 2), round(amount, 2)
    elif c == "quarterly":
        return round(amount / 3.0, 2), round(amount * 4.0, 2)
    elif c == "weekly":
        return round(amount * 4.33, 2), round(amount * 52.0, 2)
    else:  # monthly
        return round(amount, 2), round(amount * 12.0, 2)


def _days_until(target_date_str: str) -> int:
    """Calculate days remaining until target date (can be negative if overdue)."""
    try:
        t_date = date.fromisoformat(target_date_str)
        today = date.today()
        return (t_date - today).days
    except Exception:
        return 0


def add_subscription(
    name: str,
    amount: float,
    billing_cycle: str = "monthly",
    category: str = "entertainment",
    next_renewal: str | None = None,
    payment_method: str = "",
    auto_renew: bool = True,
    notes: str = "",
) -> dict:
    clean_name = (name or "").strip()
    if not clean_name:
        raise ValueError("name is required")
    if amount <= 0:
        raise ValueError("amount must be positive")

    cycle = billing_cycle.lower() if billing_cycle in VALID_CYCLES else "monthly"
    cat = category.lower() if category in VALID_CATEGORIES else "other"
    renewal = (next_renewal or "").strip()
    if not renewal:
        # Default to 1 month from now
        renewal = (date.today() + timedelta(days=30)).isoformat()

    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()
    cur = conn.execute(
        '\n        INSERT INTO context.subscriptions (\n            name, amount, billing_cycle, category, next_renewal,\n            payment_method, auto_renew, notes, created_at\n        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id',
        (
            clean_name,
            float(amount),
            cycle,
            cat,
            renewal,
            (payment_method or "").strip(),
            1 if auto_renew else 0,
            (notes or "").strip(),
            now,
        ),
    )
    conn.commit()
    sub_id = cur.fetchone()[0]
    conn.close()

    return get_subscription(sub_id)


def update_subscription(
    sub_id: int,
    name: str | None = None,
    amount: float | None = None,
    billing_cycle: str | None = None,
    category: str | None = None,
    next_renewal: str | None = None,
    payment_method: str | None = None,
    auto_renew: bool | None = None,
    notes: str | None = None,
) -> dict | None:
    conn = get_conn()
    existing = conn.execute(
        'SELECT * FROM context.subscriptions WHERE id = %s', (sub_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return None

    new_name = name.strip() if name is not None else existing["name"]
    new_amount = float(amount) if amount is not None else existing["amount"]
    new_cycle = (
        billing_cycle.lower()
        if billing_cycle is not None and billing_cycle.lower() in VALID_CYCLES
        else existing["billing_cycle"]
    )
    new_cat = (
        category.lower()
        if category is not None and category.lower() in VALID_CATEGORIES
        else existing["category"]
    )
    new_renewal = (
        next_renewal.strip() if next_renewal is not None else existing["next_renewal"]
    )
    new_payment = (
        payment_method.strip()
        if payment_method is not None
        else existing["payment_method"]
    )
    new_auto = (
        (1 if auto_renew else 0) if auto_renew is not None else existing["auto_renew"]
    )
    new_notes = notes.strip() if notes is not None else existing["notes"]

    conn.execute(
        '\n        UPDATE context.subscriptions SET\n            name = %s, amount = %s, billing_cycle = %s, category = %s,\n            next_renewal = %s, payment_method = %s, auto_renew = %s, notes = %s\n        WHERE id = %s\n        ',
        (
            new_name,
            new_amount,
            new_cycle,
            new_cat,
            new_renewal,
            new_payment,
            new_auto,
            new_notes,
            sub_id,
        ),
    )
    conn.commit()
    conn.close()

    return get_subscription(sub_id)


def delete_subscription(sub_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute('DELETE FROM context.subscriptions WHERE id = %s', (sub_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_subscription(sub_id: int) -> dict | None:
    conn = get_conn()
    row = conn.execute(
        'SELECT * FROM context.subscriptions WHERE id = %s', (sub_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    monthly, yearly = _calc_equivalents(d["amount"], d["billing_cycle"])
    days = _days_until(d["next_renewal"])
    d["monthly_equivalent"] = monthly
    d["yearly_equivalent"] = yearly
    d["days_remaining"] = days
    d["urgency"] = (
        "overdue" if days < 0 else "urgent" if days <= 3 else "soon" if days <= 7 else "normal"
    )
    return d


def list_subscriptions() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        'SELECT * FROM context.subscriptions ORDER BY next_renewal ASC, amount DESC'
    ).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        monthly, yearly = _calc_equivalents(d["amount"], d["billing_cycle"])
        days = _days_until(d["next_renewal"])
        d["monthly_equivalent"] = monthly
        d["yearly_equivalent"] = yearly
        d["days_remaining"] = days
        d["urgency"] = (
            "overdue" if days < 0 else "urgent" if days <= 3 else "soon" if days <= 7 else "normal"
        )
        results.append(d)
    return results


def advance_renewal_date(current_date_str: str, cycle: str) -> str:
    """Calculate the next renewal date after a cycle renewal."""
    try:
        curr = date.fromisoformat(current_date_str)
    except Exception:
        curr = date.today()

    c = (cycle or "monthly").lower()
    if c == "yearly":
        # Add 1 year
        try:
            return curr.replace(year=curr.year + 1).isoformat()
        except ValueError:
            return (curr + timedelta(days=365)).isoformat()
    elif c == "quarterly":
        # Approximate 91 days
        return (curr + timedelta(days=91)).isoformat()
    elif c == "weekly":
        return (curr + timedelta(days=7)).isoformat()
    else:  # monthly
        # Approximate 1 month
        month = curr.month + 1
        year = curr.year
        if month > 12:
            month = 1
            year += 1
        day = min(curr.day, 28)
        return date(year, month, day).isoformat()


def renew_subscription(sub_id: int, log_spend: bool = True) -> dict | None:
    """Advance subscription renewal date and optionally log transaction to spends."""
    sub = get_subscription(sub_id)
    if not sub:
        return None

    next_date = advance_renewal_date(sub["next_renewal"], sub["billing_cycle"])

    conn = get_conn()
    conn.execute(
        'UPDATE context.subscriptions SET next_renewal = %s WHERE id = %s',
        (next_date, sub_id),
    )
    conn.commit()
    conn.close()

    if log_spend:
        try:
            from services.spends import add_spend
            add_spend(
                amount=sub["amount"],
                merchant=sub["name"],
                category="bills",
                spent_at=date.today().isoformat(),
            )
        except Exception as e:
            print(f"[subscriptions] spend log failed: {e}")

    return get_subscription(sub_id)


def subscriptions_summary() -> dict:
    subs = list_subscriptions()

    total_monthly = sum(s["monthly_equivalent"] for s in subs)
    total_yearly = sum(s["yearly_equivalent"] for s in subs)
    due_week = [s for s in subs if 0 <= s["days_remaining"] <= 7]
    urgent = [s for s in subs if s["days_remaining"] <= 3]

    by_cat = {}
    for s in subs:
        cat = s["category"]
        by_cat[cat] = round(by_cat.get(cat, 0) + s["monthly_equivalent"], 2)

    cat_list = [
        {"category": k, "monthly": v, "percent": round(v / total_monthly * 100) if total_monthly else 0}
        for k, v in sorted(by_cat.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "active_count": len(subs),
        "total_monthly": round(total_monthly, 2),
        "total_yearly": round(total_yearly, 2),
        "due_within_7_days": len(due_week),
        "urgent_count": len(urgent),
        "by_category": cat_list,
        "upcoming": subs[:5],
    }
