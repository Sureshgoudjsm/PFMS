"""
forecast.py
"""
"""Forecast utilities for PFMS.

This module provides the 30‑day cash‑flow forecast helper that computes the
average *discretionary* daily spend. Discretionary spend is defined as
plain expense transactions only – it deliberately excludes EMI payments,
interest payments and any loan‑repayment transaction types. The previous
implementation mistakenly used the generic ``_EXPENSE_TYPES`` set from
``health_score.py`` which includes those EMI‑related types, causing double‑
counting when the forecast later subtracts scheduled EMIs.

The fix introduces a dedicated ``_DISCRETIONARY_TYPES`` constant that
contains only the core ``EXPENSE`` transaction type. The helper function
``average_daily_discretionary_spend`` now filters on this set.
"""

from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models import Transaction, TransactionType, User, EmiStatus
from app.logic.nudge_engine import _next_due_date

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# Only plain expense transactions are considered discretionary. EMI payments,
# interest payments and loan‑repayment types are excluded.
_DISCRETIONARY_TYPES = frozenset({TransactionType.EXPENSE.value})

# ---------------------------------------------------------------------------
# Public helper
# ---------------------------------------------------------------------------
def average_daily_discretionary_spend(db: Session, user_id: int) -> float:
    """Return the average discretionary spend per day over the last 30 days.

    Steps
    -----
    1. Define a 30‑day window ending today (inclusive).
    2. Query *non‑sample* ``Transaction`` rows whose ``transaction_type`` is in
       ``_DISCRETIONARY_TYPES``.
    3. Sum the ``amount`` fields and divide by 30.
    4. If the window contains no matching transactions, ``0.0`` is returned –
       the forecast will then show a zero discretionary cash‑flow.

    The function intentionally **does not** include ``EMI_PAYMENT``,
    ``INTEREST_PAYMENT`` or any loan‑repayment transaction types, thereby
    avoiding the double‑counting bug previously observed.
    """
    # Define the 30‑day window (today and the previous 29 days).
    end_date = date.today()
    start_date = end_date - timedelta(days=29)  # inclusive range of 30 days

    # Pull matching transactions.
    rows = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.is_sample == False,  # noqa: E712 – ignore synthetic rows
            Transaction.transaction_type.in_(_DISCRETIONARY_TYPES),
        )
        .all()
    )

    if not rows:
        return 0.0

    total_amount = sum(t.amount for t in rows)
    # Round to two decimal places for a tidy UI display.
    return round(total_amount / 30.0, 2)


def compute_forecast(db: Session, user_id: int, what_if: float = 0.0) -> list[dict]:
    """Compute a 30‑day cash‑flow forecast for the given user.

    Args:
        db: SQLAlchemy session.
        user_id: ID of the user.
        what_if: Fraction (0.0‑0.5) representing the reduction of discretionary spend.

    Returns:
        List of dicts with keys ``date``, ``balance`` and ``events``.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []

    def _avg_income() -> float:
        three_months_ago = date.today() - timedelta(days=90)
        rows = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.date >= three_months_ago,
                Transaction.is_sample == False,
                Transaction.transaction_type == TransactionType.INCOME.value,
            )
            .all()
        )
        if not rows:
            return 0.0
        total = sum(t.amount for t in rows)
        return total / 3.0

    avg_income = _avg_income()
    avg_daily_discretionary = average_daily_discretionary_spend(db, user_id)
    daily_spend_factor = 1.0 - what_if

    asset_types = {"Salary Account", "Savings Account", "Cash", "Wallet"}
    balance = sum(
        acc.current_balance or 0.0
        for acc in user.accounts
        if acc.account_type in asset_types
    )

    projection = []
    cur_date = date.today()
    for _ in range(30):
        salary_event = False
        if user.salary_day is not None and _next_due_date(user.salary_day, cur_date) == cur_date:
            balance += avg_income
            salary_event = True
        emi_event = False
        if user.emi_schedules:
            for emi in user.emi_schedules:
                # Only consider active, non‑sample EMI schedules
                if emi.status != EmiStatus.ACTIVE.value:
                    continue
                if emi.is_sample:
                    continue
                emi_day = emi.due_date
                if _next_due_date(emi_day, cur_date) == cur_date:
                    balance -= emi.amount
                    emi_event = True
        discretionary_spend = avg_daily_discretionary * daily_spend_factor
        balance -= discretionary_spend
        projection.append(
            {
                "date": cur_date.isoformat(),
                "balance": round(balance, 2),
                "events": {
                    "salary_added": salary_event,
                    "emi_deducted": emi_event,
                    "discretionary_spend": round(discretionary_spend, 2),
                },
            }
        )
        cur_date += timedelta(days=1)
    return projection
