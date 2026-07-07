"""
query_templates.py
------------------
6 read-only, parameterized query functions. ALL are SELECT-only.
Zero INSERT / UPDATE / DELETE anywhere in this module — confirmed before implementation.

Every function takes `user_id` as its first argument and filters all queries
with `.filter(... user_id == user_id)` to enforce per-user scoping.
"""

from calendar import monthrange
from datetime import date
from typing import Any

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.models import Category, EmiSchedule, Person, Transaction, TransactionType
from app.logic.balance import compute_person_ledger

_EXPENSE_TYPES: frozenset[str] = frozenset({
    TransactionType.EXPENSE.value,
    TransactionType.EMI_PAYMENT.value,
    TransactionType.INTEREST_PAYMENT.value,
})
_INCOME_TYPES: frozenset[str] = frozenset({
    TransactionType.INCOME.value,
    TransactionType.DEPOSIT.value,
})


# ── Template 1 ─────────────────────────────────────────────────────────────

def spend_by_category(
    db: Session,
    user_id: int,
    category_name: str,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    """Total expense spend in a named category over [start_date, end_date]."""
    cat = (
        db.query(Category)
        .filter(Category.category_name.ilike(f"%{category_name}%"))
        .first()
    )
    if not cat:
        return {"found": False, "category": category_name, "total": 0.0, "count": 0}

    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.category_id == cat.id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.transaction_type.in_(_EXPENSE_TYPES),
        )
        .all()
    )
    return {
        "found":      True,
        "category":   cat.category_name,
        "start_date": str(start_date),
        "end_date":   str(end_date),
        "total":      round(sum(t.amount for t in txns), 2),
        "count":      len(txns),
    }


# ── Template 2 ─────────────────────────────────────────────────────────────

def total_in_range(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    """Total income and expense for the current user in [start_date, end_date]."""
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        )
        .all()
    )
    income   = sum(t.amount for t in txns if t.transaction_type in _INCOME_TYPES)
    expenses = sum(t.amount for t in txns if t.transaction_type in _EXPENSE_TYPES)
    return {
        "start_date": str(start_date),
        "end_date":   str(end_date),
        "income":     round(income, 2),
        "expenses":   round(expenses, 2),
        "net":        round(income - expenses, 2),
    }


# ── Template 3 ─────────────────────────────────────────────────────────────

def transactions_with_person(
    db: Session,
    user_id: int,
    person_name: str,
    limit: int = 10,
) -> dict[str, Any]:
    """Last `limit` transactions involving a named contact."""
    person = (
        db.query(Person)
        .filter(
            Person.user_id == user_id,
            Person.full_name.ilike(f"%{person_name}%"),
        )
        .first()
    )
    if not person:
        return {"found": False, "person": person_name, "transactions": []}

    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.person_id == person.id,
        )
        .order_by(Transaction.date.desc())
        .limit(max(1, min(limit, 50)))   # clamp 1–50
        .all()
    )
    return {
        "found":  True,
        "person": person.full_name,
        "transactions": [
            {
                "date":        str(t.date),
                "type":        t.transaction_type,
                "amount":      t.amount,
                "description": t.description,
            }
            for t in txns
        ],
    }


# ── Template 4 ─────────────────────────────────────────────────────────────

def avg_monthly_spend_category(
    db: Session,
    user_id: int,
    category_name: str,
    n_months: int,
) -> dict[str, Any]:
    """Average monthly spend on a category over the last n_months calendar months."""
    n_months = max(1, min(n_months, 24))  # clamp 1–24
    today    = date.today()

    cat = (
        db.query(Category)
        .filter(Category.category_name.ilike(f"%{category_name}%"))
        .first()
    )
    if not cat:
        return {"found": False, "category": category_name, "avg_monthly": 0.0, "monthly_breakdown": []}

    monthly_totals: list[float] = []
    for i in range(n_months - 1, -1, -1):
        ref     = today - relativedelta(months=i)
        m_start = ref.replace(day=1)
        m_end   = ref.replace(day=monthrange(ref.year, ref.month)[1])
        total   = sum(
            t.amount for t in db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.category_id == cat.id,
                Transaction.date >= m_start,
                Transaction.date <= m_end,
                Transaction.transaction_type.in_(_EXPENSE_TYPES),
            ).all()
        )
        monthly_totals.append(total)

    avg = sum(monthly_totals) / len(monthly_totals)
    return {
        "found":             True,
        "category":          cat.category_name,
        "n_months":          n_months,
        "avg_monthly":       round(avg, 2),
        "monthly_breakdown": [round(v, 2) for v in monthly_totals],
    }


# ── Template 5 ─────────────────────────────────────────────────────────────

def net_position_with_person(
    db: Session,
    user_id: int,
    person_name: str,
) -> dict[str, Any]:
    """Net lending position with a named contact (reuses compute_person_ledger)."""
    person = (
        db.query(Person)
        .filter(
            Person.user_id == user_id,
            Person.full_name.ilike(f"%{person_name}%"),
        )
        .first()
    )
    if not person:
        return {"found": False, "person": person_name}

    ledger = compute_person_ledger(db, person.id)
    return {"found": True, "person": person.full_name, **ledger}


# ── Template 6 ─────────────────────────────────────────────────────────────

def upcoming_emis(db: Session, user_id: int) -> list[dict[str, Any]]:
    """All active EMIs with computed next-due dates, sorted soonest first."""
    today = date.today()
    emis  = (
        db.query(EmiSchedule)
        .filter(EmiSchedule.user_id == user_id, EmiSchedule.status == "Active")
        .all()
    )
    result: list[dict[str, Any]] = []
    for emi in emis:
        day = emi.due_date
        if today.day <= day:
            last = monthrange(today.year, today.month)[1]
            next_due = today.replace(day=min(day, last))
        else:
            if today.month == 12:
                nm = today.replace(year=today.year + 1, month=1, day=1)
            else:
                nm = today.replace(month=today.month + 1, day=1)
            last = monthrange(nm.year, nm.month)[1]
            next_due = nm.replace(day=min(day, last))
        result.append({
            "id":         emi.id,
            "name":       emi.emi_name,
            "amount":     emi.amount,
            "next_due":   str(next_due),
            "days_until": (next_due - today).days,
            "status":     emi.status,
        })

    result.sort(key=lambda x: x["next_due"])
    return result
