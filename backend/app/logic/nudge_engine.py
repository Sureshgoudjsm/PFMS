"""
nudge_engine.py
---------------
Daily background nudge job. Four checks per user.

Deduplication rule: a new Notification is NOT created if an *unread* notification
of the same type + entity already exists within the last 24 hours.

Telegram push: EMI_DUE and CREDIT_WATCH only (time-sensitive).
"""

import logging
import os
from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    Account,
    AccountType,
    Category,
    EmiSchedule,
    Notification,
    Person,
    TelegramLink,
    Transaction,
    TransactionType,
    User,
)
from app.logic.balance import (
    compute_account_balance,
    compute_net_worth,
    compute_person_ledger,
)

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Only these two types are pushed to Telegram (time-sensitive/consequential)
TELEGRAM_PUSH_TYPES: frozenset[str] = frozenset({"EMI_DUE", "CREDIT_WATCH"})

_EXPENSE_TYPES: frozenset[str] = frozenset({
    TransactionType.EXPENSE.value,
    TransactionType.EMI_PAYMENT.value,
    TransactionType.INTEREST_PAYMENT.value,
})


# ── Helpers ────────────────────────────────────────────────────────────────

def _next_due_date(day_of_month: int, reference: date) -> date:
    """
    Compute the next calendar occurrence of `day_of_month` relative to `reference`.
    If reference.day <= day_of_month → this month (clamped to last valid day).
    Else                             → next month (clamped to last valid day).
    """
    if reference.day <= day_of_month:
        last = monthrange(reference.year, reference.month)[1]
        return reference.replace(day=min(day_of_month, last))
    # Roll to next month
    if reference.month == 12:
        next_m = reference.replace(year=reference.year + 1, month=1, day=1)
    else:
        next_m = reference.replace(month=reference.month + 1, day=1)
    last = monthrange(next_m.year, next_m.month)[1]
    return next_m.replace(day=min(day_of_month, last))


def _is_duplicate(
    db: Session,
    user_id: int,
    nudge_type: str,
    entity_id: Optional[int],
) -> bool:
    """True if an unread notification of this type+entity already exists within 24 h."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    q = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == nudge_type,
            Notification.read_at.is_(None),
            Notification.created_at >= cutoff,
        )
    )
    if entity_id is not None:
        q = q.filter(Notification.related_entity_id == entity_id)
    return q.first() is not None


def _add_notification(
    db: Session,
    user_id: int,
    nudge_type: str,
    message: str,
    entity_type: Optional[str],
    entity_id: Optional[int],
):
    db.add(Notification(
        user_id=user_id,
        type=nudge_type,
        message=message,
        related_entity_type=entity_type,
        related_entity_id=entity_id,
    ))


# ── Four nudge checks ──────────────────────────────────────────────────────
# Each returns list of (nudge_type, message, entity_type, entity_id) tuples.

def check_emi_due(db: Session, user_id: int) -> list[tuple]:
    """
    EMI Due Reminder: next_due <= today + 3 days AND liquid balance < EMI amount.
    Uses compute_net_worth for liquid = bank_balance + cash_balance (no duplication).
    """
    today = db_today = date.today()
    window = today + timedelta(days=3)
    nudges: list[tuple] = []

    emis = (
        db.query(EmiSchedule)
        .filter(EmiSchedule.user_id == user_id, EmiSchedule.status == "Active")
        .all()
    )
    if not emis:
        return nudges

    nw = compute_net_worth(db, user_id=user_id)
    liquid = nw["bank_balance"] + nw["cash_balance"]

    for emi in emis:
        next_due  = _next_due_date(emi.due_date, today)
        days_left = (next_due - today).days
        if next_due > window:
            continue
        if liquid >= emi.amount:
            continue  # balance is sufficient — no nudge needed
        nudges.append((
            "EMI_DUE",
            (
                f"\u26a0\ufe0f Your {emi.emi_name} EMI of \u20b9{emi.amount:,.0f} is due in "
                f"{days_left} day{'s' if days_left != 1 else ''}. "
                f"Your current liquid balance is \u20b9{liquid:,.0f}. "
                f"Consider topping up your account before {next_due.strftime('%d %b')}."
            ),
            "emi",
            emi.id,
        ))
    return nudges


def check_unusual_spend(db: Session, user_id: int) -> list[tuple]:
    """
    Unusual Spend Alert: this week's spend by category > trailing 4-week avg by >30%.
    This week: Monday through today.
    Trailing avg: 4 complete Mon-Sun weeks ending last Sunday.
    """
    today = date.today()
    days_since_monday = today.weekday()          # 0 = Monday
    this_week_start   = today - timedelta(days=days_since_monday)
    last_sunday       = this_week_start - timedelta(days=1)
    nudges: list[tuple] = []

    # Current week's spend, grouped by category_id
    this_week_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= this_week_start,
            Transaction.date <= today,
            Transaction.transaction_type.in_(_EXPENSE_TYPES),
            Transaction.category_id.isnot(None),
        )
        .all()
    )
    if not this_week_txns:
        return nudges

    by_cat: dict[int, float] = {}
    for t in this_week_txns:
        by_cat[t.category_id] = by_cat.get(t.category_id, 0.0) + t.amount

    for cat_id, this_week_total in by_cat.items():
        # Trailing 4 complete weeks
        weekly_totals: list[float] = []
        for i in range(1, 5):                   # weeks 1..4 before current
            w_end   = last_sunday - timedelta(weeks=i - 1)
            w_start = w_end - timedelta(days=6)
            week_sum = sum(
                t.amount for t in db.query(Transaction).filter(
                    Transaction.user_id == user_id,
                    Transaction.category_id == cat_id,
                    Transaction.date >= w_start,
                    Transaction.date <= w_end,
                    Transaction.transaction_type.in_(_EXPENSE_TYPES),
                ).all()
            )
            weekly_totals.append(week_sum)

        avg = sum(weekly_totals) / 4
        if avg <= 0:
            continue  # No history to compare against
        if this_week_total <= avg * 1.30:
            continue  # Not unusual

        pct_higher = round((this_week_total / avg - 1) * 100)
        cat        = db.get(Category, cat_id)
        cat_name   = cat.category_name if cat else f"Category #{cat_id}"
        nudges.append((
            "UNUSUAL_SPEND",
            (
                f"\U0001f4c8 Your {cat_name} spending this week (\u20b9{this_week_total:,.0f}) "
                f"is {pct_higher}% higher than your usual \u20b9{avg:,.0f}."
            ),
            "category",
            cat_id,
        ))
    return nudges


def check_ledger_reminders(db: Session, user_id: int) -> list[tuple]:
    """
    Friend Ledger Reminder: person's net_position > 0 (they owe us) AND
    last transaction with them was ≥30 days ago.
    """
    today     = date.today()
    threshold = today - timedelta(days=30)
    nudges: list[tuple] = []

    people = (
        db.query(Person)
        .filter(Person.user_id == user_id, Person.active.is_(True))
        .all()
    )
    for person in people:
        ledger = compute_person_ledger(db, person.id)
        if ledger["net_position"] <= 0:
            continue  # settled or we owe them

        last_txn = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.person_id == person.id,
            )
            .order_by(Transaction.date.desc())
            .first()
        )
        if not last_txn or last_txn.date > threshold:
            continue

        net          = ledger["net_position"]
        last_date_str = last_txn.date.strftime("%d %b %Y")
        nudges.append((
            "LEDGER_REMINDER",
            (
                f"\U0001f4b8 {person.full_name} still owes you \u20b9{net:,.0f} "
                f"(last activity: {last_date_str}). "
                f"Reminder template: 'Hey, just a friendly reminder about the "
                f"\u20b9{net:,.0f} from {last_date_str}.'"
            ),
            "person",
            person.id,
        ))
    return nudges


def check_credit_utilization(db: Session, user_id: int) -> list[tuple]:
    """
    Credit Utilization Watch: utilization ≥28% (approaching 30% threshold).
    """
    nudges: list[tuple] = []
    cards = (
        db.query(Account)
        .filter(
            Account.user_id == user_id,
            Account.account_type == AccountType.CREDIT_CARD.value,
            Account.credit_limit.isnot(None),
            Account.credit_limit > 0,
        )
        .all()
    )
    for card in cards:
        balance     = compute_account_balance(db, card.id)
        utilization = balance / card.credit_limit
        if utilization < 0.28:
            continue
        pct = round(utilization * 100, 1)
        nudges.append((
            "CREDIT_WATCH",
            (
                f"\U0001f4b3 Your {card.account_name} utilization is at {pct}%, "
                f"approaching the 30% threshold. "
                f"High utilization may affect your credit score."
            ),
            "account",
            card.id,
        ))
    return nudges


# ── Telegram push ──────────────────────────────────────────────────────────

def _push_telegram(db: Session, user_id: int, message: str) -> None:
    """Push a message to the user's linked Telegram chat (sync httpx)."""
    if not TELEGRAM_BOT_TOKEN:
        return
    link = db.query(TelegramLink).filter(TelegramLink.user_id == user_id).first()
    if not link:
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        with httpx.Client(timeout=10.0) as client:
            client.post(url, json={"chat_id": link.chat_id, "text": message})
    except Exception as exc:
        logger.warning("Telegram push failed for user %d: %s", user_id, exc)


# ── Per-user orchestrator ──────────────────────────────────────────────────

def run_all_nudges_for_user(db: Session, user_id: int) -> None:
    """Run all 4 checks, create non-duplicate notifications, push to Telegram."""
    checks = [
        check_emi_due,
        check_unusual_spend,
        check_ledger_reminders,
        check_credit_utilization,
    ]
    telegram_queue: list[str] = []

    for check_fn in checks:
        try:
            nudges = check_fn(db, user_id)
            for nudge_type, message, entity_type, entity_id in nudges:
                if _is_duplicate(db, user_id, nudge_type, entity_id):
                    logger.debug(
                        "Skipping duplicate nudge %s/entity=%s for user %d",
                        nudge_type, entity_id, user_id,
                    )
                    continue
                _add_notification(db, user_id, nudge_type, message, entity_type, entity_id)
                if nudge_type in TELEGRAM_PUSH_TYPES:
                    telegram_queue.append(message)
        except Exception as exc:
            logger.error(
                "Nudge check %s failed for user %d: %s",
                check_fn.__name__, user_id, exc,
            )

    db.commit()

    # Push to Telegram AFTER commit (outside transaction)
    for msg in telegram_queue:
        _push_telegram(db, user_id, msg)


# ── APScheduler job entry point ────────────────────────────────────────────

def run_nudge_job() -> None:
    """
    Top-level synchronous entry point called by APScheduler (cron, 07:00 daily).
    Opens its own DB session — not request-scoped.
    Missing a single run on server restart is acceptable (local deployment).
    """
    logger.info("Nudge job starting...")
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            try:
                run_all_nudges_for_user(db, user.id)
            except Exception as exc:
                logger.error("Nudge job failed for user %d: %s", user.id, exc)
                db.rollback()
        logger.info("Nudge job complete (%d user(s) processed).", len(users))
    finally:
        db.close()
