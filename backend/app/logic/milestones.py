"""Milestone detection module conforming to Phase 3 requirements."""

import datetime
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import (
    Milestone,
    EmiSchedule,
    EmiStatus,
    Person,
    Transaction,
)
from app.logic.balance import compute_person_ledger

# ---------------------------------------------------------------------------
# Milestone messages
# ---------------------------------------------------------------------------
_MESSAGES: dict[str, str] = {
    "EMI_REPAID": "✅ An EMI schedule has been fully completed!",
    "FRIEND_LOAN_ZERO": "🏆 Outstanding balance with contact is fully settled!",
    "SAVINGS_RATE_20": "💰 Savings milestone! Your 3-month trailing savings rate is above 20%!",
}


def _try_record(
    db: Session,
    user_id: int,
    milestone_type: str,
    related_entity_id: int | None = None,
) -> dict | None:
    """Attempt to insert a milestone; return dict on success, None on dup."""
    # Check for duplicates first (especially important since NULL is not considered equal in SQLite unique index)
    existing = (
        db.query(Milestone)
        .filter(
            Milestone.user_id == user_id,
            Milestone.type == milestone_type,
            Milestone.related_entity_id == related_entity_id,
        )
        .first()
    )
    if existing:
        return None

    ms = Milestone(
        user_id=user_id,
        type=milestone_type,
        related_entity_id=related_entity_id,
        achieved_at=datetime.datetime.utcnow(),
    )
    db.add(ms)
    try:
        db.flush()
        return {
            "type": milestone_type,
            "message": _MESSAGES.get(milestone_type, "Milestone achieved!"),
        }
    except IntegrityError:
        db.rollback()
        return None


# ---------------------------------------------------------------------------
# Individual milestone checkers
# ---------------------------------------------------------------------------


def _check_emi_repaid(db: Session, user_id: int) -> list[dict]:
    """EMI_REPAID: any active-turned-completed EMI schedule, excluding samples."""
    completed_emis = (
        db.query(EmiSchedule)
        .filter(
            EmiSchedule.user_id == user_id,
            EmiSchedule.status == EmiStatus.COMPLETED.value,
            EmiSchedule.is_sample == False,  # Exclude sample data
        )
        .all()
    )
    results = []
    for emi in completed_emis:
        result = _try_record(db, user_id, "EMI_REPAID", emi.id)
        if result:
            result["message"] = f"✅ EMI '{emi.emi_name}' has been fully completed!"
            results.append(result)
    return results


def _check_friend_loan_zero(db: Session, user_id: int) -> list[dict]:
    """FRIEND_LOAN_ZERO: contact net position becomes exactly 0 (excluding samples)."""
    people = (
        db.query(Person)
        .filter(
            Person.user_id == user_id,
            Person.is_sample == False,  # Exclude sample data
        )
        .all()
    )
    results = []
    for p in people:
        # Check if the user has any real transactions with this person
        txn_count = (
            db.query(func.count(Transaction.id))
            .filter(
                Transaction.user_id == user_id,
                Transaction.person_id == p.id,
                Transaction.is_sample == False,
            )
            .scalar()
        )
        if txn_count > 0:
            ledger = compute_person_ledger(db, p.id)
            # Both outstanding lent and borrowed are exactly 0
            if (
                ledger["ledger"]["outstanding_lent"] == 0.0
                and ledger["ledger"]["outstanding_borrowed"] == 0.0
            ):
                result = _try_record(db, user_id, "FRIEND_LOAN_ZERO", p.id)
                if result:
                    result["message"] = f"🏆 Outstanding balance with {p.full_name} is fully settled!"
                    results.append(result)
    return results


def _check_savings_rate_20(db: Session, user_id: int) -> dict | None:
    """SAVINGS_RATE_20: trailing 3 months real savings rate > 20%."""
    from app.logic.health_score import (
        _trailing_range,
        _sum_txns,
        _INCOME_TYPES,
        _EXPENSE_TYPES,
    )
    
    start, end = _trailing_range(3)
    income = _sum_txns(db, user_id, start, end, _INCOME_TYPES)
    expenses = _sum_txns(db, user_id, start, end, _EXPENSE_TYPES)
    
    if income > 0:
        rate = (income - expenses) / income
        if rate > 0.20:
            return _try_record(db, user_id, "SAVINGS_RATE_20")
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def check_and_record_milestones(
    db: Session, user_id: int, transaction_id: int
) -> list[dict]:
    """Run all milestone checks and return newly achieved milestones.

    Args:
        db: SQLAlchemy session.
        user_id: The current user's ID.
        transaction_id: The transaction triggering the check.

    Returns:
        List of dicts ``{type: str, message: str}`` for each new milestone.
    """
    # Exclude check if the triggering transaction is sample data
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if txn and txn.is_sample:
        return []

    achieved: list[dict] = []

    # Savings rate milestone
    sr_res = _check_savings_rate_20(db, user_id)
    if sr_res:
        achieved.append(sr_res)

    # EMI repaid milestones
    achieved.extend(_check_emi_repaid(db, user_id))

    # Friend loan settled milestones
    achieved.extend(_check_friend_loan_zero(db, user_id))

    if achieved:
        db.commit()

    return achieved
