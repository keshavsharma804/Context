import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

"""Savings Goals and Target Pots.

Allows users to set target savings pots (e.g. Emergency Fund, New Laptop, Vacation),
deposit money into them, track progress percentages, and estimate completion dates.
"""

from datetime import datetime, date
from typing import Optional
from core.db import get_conn


def add_goal(
    title: str,
    target_amount: float,
    current_amount: float = 0.0,
    target_date: Optional[str] = None,
    category: str = "purchase",
    emoji: str = "🎯",
    notes: str = "",
    is_locked: bool = False,
) -> dict:
    clean_title = (title or "").strip()
    if not clean_title:
        raise ValueError("title is required")
    if target_amount <= 0:
        raise ValueError("target_amount must be positive")

    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()
    cur = conn.execute(
        """
        INSERT INTO saving_goals (
            title, target_amount, current_amount, target_date,
            category, emoji, notes, is_locked, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            clean_title,
            float(target_amount),
            max(0.0, float(current_amount)),
            (target_date or "").strip() or None,
            (category or "purchase").strip().lower(),
            (emoji or "🎯").strip(),
            (notes or "").strip(),
            1 if is_locked else 0,
            now,
        ),
    )
    conn.commit()
    goal_id = cur.lastrowid
    conn.close()

    return get_goal(goal_id)


def update_goal(
    goal_id: int,
    title: Optional[str] = None,
    target_amount: Optional[float] = None,
    current_amount: Optional[float] = None,
    target_date: Optional[str] = None,
    category: Optional[str] = None,
    emoji: Optional[str] = None,
    notes: Optional[str] = None,
    is_locked: Optional[bool] = None,
) -> Optional[dict]:
    existing = get_goal(goal_id)
    if not existing:
        return None

    new_title = existing["title"] if title is None else (title or "").strip()
    if not new_title:
        raise ValueError("title cannot be empty")

    new_target = existing["target_amount"] if target_amount is None else float(target_amount)
    if new_target <= 0:
        raise ValueError("target_amount must be positive")

    new_current = existing["current_amount"] if current_amount is None else max(0.0, float(current_amount))
    new_date = existing["target_date"] if target_date is None else ((target_date or "").strip() or None)
    new_cat = existing["category"] if category is None else (category or "purchase").strip().lower()
    new_emoji = existing["emoji"] if emoji is None else (emoji or "🎯").strip()
    new_notes = existing["notes"] if notes is None else (notes or "").strip()
    new_locked = (1 if is_locked else 0) if is_locked is not None else (1 if existing.get("is_locked") else 0)

    conn = get_conn()
    conn.execute(
        """
        UPDATE saving_goals
        SET title = ?, target_amount = ?, current_amount = ?, target_date = ?,
            category = ?, emoji = ?, notes = ?, is_locked = ?
        WHERE id = ?
        """,
        (
            new_title,
            new_target,
            new_current,
            new_date,
            new_cat,
            new_emoji,
            new_notes,
            new_locked,
            goal_id,
        ),
    )
    conn.commit()
    conn.close()

    return get_goal(goal_id)


def add_funds(goal_id: int, amount: float) -> Optional[dict]:
    """Deposit or withdraw funds from a saving goal."""
    existing = get_goal(goal_id)
    if not existing:
        return None
    new_amount = max(0.0, existing["current_amount"] + float(amount))
    return update_goal(goal_id, current_amount=new_amount)


def delete_goal(goal_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM saving_goals WHERE id = ?", (goal_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_goal(goal_id: int) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM saving_goals WHERE id = ?", (goal_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    target = d["target_amount"]
    current = d["current_amount"]
    pct = round((current / target * 100), 1) if target > 0 else 0.0
    d["progress_pct"] = min(100.0, pct)
    d["remaining"] = max(0.0, target - current)
    d["is_completed"] = current >= target
    d["is_locked"] = bool(d.get("is_locked", 0))
    return d


def list_goals() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM saving_goals ORDER BY (current_amount >= target_amount) ASC, target_amount DESC"
    ).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        target = d["target_amount"]
        current = d["current_amount"]
        pct = round((current / target * 100), 1) if target > 0 else 0.0
        d["progress_pct"] = min(100.0, pct)
        d["remaining"] = max(0.0, target - current)
        d["is_completed"] = current >= target
        d["is_locked"] = bool(d.get("is_locked", 0))
        results.append(d)
    return results


def savings_summary() -> dict:
    goals = list_goals()
    total_target = sum(g["target_amount"] for g in goals)
    total_saved = sum(g["current_amount"] for g in goals)
    completed_count = sum(1 for g in goals if g["is_completed"])
    overall_pct = round((total_saved / total_target * 100), 1) if total_target > 0 else 0.0

    return {
        "goals_count": len(goals),
        "completed_count": completed_count,
        "total_target": round(total_target, 2),
        "total_saved": round(total_saved, 2),
        "overall_progress_pct": overall_pct,
        "goals": goals,
    }
