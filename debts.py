"""Debts and IOUs Tracker.

Tracks money borrowed from or lent to contacts/friends/family,
helping the user maintain clarity on who owes what and upcoming settlement due dates.
"""

from datetime import datetime, date
from typing import Optional
from db import get_conn


VALID_DIRECTIONS = {"borrowed", "lent"}  # 'borrowed': I owe them, 'lent': they owe me


def _days_until(target_date_str: Optional[str]) -> Optional[int]:
    if not target_date_str:
        return None
    try:
        t_date = date.fromisoformat(target_date_str)
        today = date.today()
        return (t_date - today).days
    except Exception:
        return None


def add_debt(
    person: str,
    direction: str,
    amount: float,
    description: str = "",
    due_date: Optional[str] = None,
    notes: str = "",
    taken_at: Optional[str] = None,
) -> dict:
    clean_name = (person or "").strip()
    if not clean_name:
        raise ValueError("person is required")
    if amount <= 0:
        raise ValueError("amount must be positive")
    
    clean_dir = (direction or "").strip().lower()
    if clean_dir not in VALID_DIRECTIONS:
        raise ValueError(f"direction must be 'borrowed' or 'lent', got '{clean_dir}'")

    now = datetime.now().isoformat(timespec="seconds")
    taken = (taken_at or "").strip() or date.today().isoformat()
    due = (due_date or "").strip() or None

    conn = get_conn()
    cur = conn.execute(
        """
        INSERT INTO debts (
            person, direction, amount, description, due_date,
            taken_at, settled, settled_at, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
        """,
        (
            clean_name,
            clean_dir,
            float(amount),
            (description or "").strip(),
            due,
            taken,
            (notes or "").strip(),
            now,
        ),
    )
    conn.commit()
    debt_id = cur.lastrowid
    conn.close()

    return get_debt(debt_id)


def update_debt(
    debt_id: int,
    person: Optional[str] = None,
    direction: Optional[str] = None,
    amount: Optional[float] = None,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    taken_at: Optional[str] = None,
    settled: Optional[bool] = None,
    notes: Optional[str] = None,
) -> Optional[dict]:
    existing = get_debt(debt_id)
    if not existing:
        return None

    new_name = existing["person"] if person is None else (person or "").strip()
    if not new_name:
        raise ValueError("person cannot be empty")

    new_dir = existing["direction"] if direction is None else (direction or "").strip().lower()
    if new_dir not in VALID_DIRECTIONS:
        raise ValueError("direction must be 'borrowed' or 'lent'")

    new_amount = existing["amount"] if amount is None else float(amount)
    if new_amount <= 0:
        raise ValueError("amount must be positive")

    new_desc = existing["description"] if description is None else (description or "").strip()
    new_due = existing["due_date"] if due_date is None else ((due_date or "").strip() or None)
    new_taken = existing["taken_at"] if taken_at is None else ((taken_at or "").strip() or existing["taken_at"])
    new_notes = existing["notes"] if notes is None else (notes or "").strip()

    new_settled = 1 if (settled if settled is not None else existing["settled"]) else 0
    settled_at = existing["settled_at"]
    if settled is not None:
        if settled and not existing["settled"]:
            settled_at = datetime.now().isoformat(timespec="seconds")
        elif not settled and existing["settled"]:
            settled_at = None

    conn = get_conn()
    conn.execute(
        """
        UPDATE debts
        SET person = ?, direction = ?, amount = ?, description = ?,
            due_date = ?, taken_at = ?, settled = ?, settled_at = ?, notes = ?
        WHERE id = ?
        """,
        (
            new_name,
            new_dir,
            new_amount,
            new_desc,
            new_due,
            new_taken,
            new_settled,
            settled_at,
            new_notes,
            debt_id,
        ),
    )
    conn.commit()
    conn.close()

    return get_debt(debt_id)


def settle_debt(debt_id: int, settled: bool = True) -> Optional[dict]:
    return update_debt(debt_id, settled=settled)


def delete_debt(debt_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM debts WHERE id = ?", (debt_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_debt(debt_id: int) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM debts WHERE id = ?", (debt_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["settled"] = bool(d["settled"])
    d["person_name"] = d["person"]  # Frontend convenience alias
    days = _days_until(d["due_date"])
    d["days_remaining"] = days
    if d["settled"]:
        d["status"] = "settled"
    elif days is None:
        d["status"] = "active"
    elif days < 0:
        d["status"] = "overdue"
    elif days <= 3:
        d["status"] = "urgent"
    elif days <= 7:
        d["status"] = "soon"
    else:
        d["status"] = "active"
    return d


def list_debts(
    settled: Optional[bool] = None,
    direction: Optional[str] = None,
    person: Optional[str] = None,
) -> list[dict]:
    conn = get_conn()
    query = "SELECT * FROM debts WHERE 1=1"
    params = []

    if settled is not None:
        query += " AND settled = ?"
        params.append(1 if settled else 0)
    if direction:
        query += " AND direction = ?"
        params.append(direction.lower())
    if person:
        query += " AND person LIKE ?"
        params.append(f"%{person}%")

    query += " ORDER BY settled ASC, due_date ASC, created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["settled"] = bool(d["settled"])
        d["person_name"] = d["person"]
        days = _days_until(d["due_date"])
        d["days_remaining"] = days
        if d["settled"]:
            d["status"] = "settled"
        elif days is None:
            d["status"] = "active"
        elif days < 0:
            d["status"] = "overdue"
        elif days <= 3:
            d["status"] = "urgent"
        elif days <= 7:
            d["status"] = "soon"
        else:
            d["status"] = "active"
        results.append(d)
    return results


def debts_summary() -> dict:
    all_debts = list_debts()
    active_debts = [d for d in all_debts if not d["settled"]]
    settled_debts = [d for d in all_debts if d["settled"]]

    total_borrowed = sum(d["amount"] for d in active_debts if d["direction"] == "borrowed")
    total_lent = sum(d["amount"] for d in active_debts if d["direction"] == "lent")
    net_balance = total_lent - total_borrowed  # Positive means people owe me more than I owe

    overdue_count = sum(1 for d in active_debts if d.get("status") == "overdue")
    urgent_count = sum(1 for d in active_debts if d.get("status") in ("overdue", "urgent"))

    # Group active debts by person
    person_map = {}
    for d in active_debts:
        name = d["person"]
        if name not in person_map:
            person_map[name] = {"person": name, "person_name": name, "lent": 0.0, "borrowed": 0.0, "net": 0.0, "count": 0}
        person_map[name]["count"] += 1
        if d["direction"] == "lent":
            person_map[name]["lent"] += d["amount"]
            person_map[name]["net"] += d["amount"]
        else:
            person_map[name]["borrowed"] += d["amount"]
            person_map[name]["net"] -= d["amount"]

    by_person = sorted(person_map.values(), key=lambda x: abs(x["net"]), reverse=True)

    return {
        "total_borrowed": round(total_borrowed, 2),
        "total_lent": round(total_lent, 2),
        "net_balance": round(net_balance, 2),
        "active_count": len(active_debts),
        "settled_count": len(settled_debts),
        "overdue_count": overdue_count,
        "urgent_count": urgent_count,
        "by_person": by_person,
    }
