"""Automated processing fee generation (2% on wallet loads / card payments)."""

from datetime import date

from sqlalchemy.orm import Session

from app.models import Category, Transaction, TransactionType

PROCESSING_FEE_RATE = 0.02
PROCESSING_CATEGORY_NAME = "Processing Charges"


def get_or_create_processing_category(db: Session) -> Category:
    category = (
        db.query(Category)
        .filter(
            Category.category_name == PROCESSING_CATEGORY_NAME,
            Category.parent_type == "Expense",
        )
        .first()
    )
    if not category:
        category = Category(
            category_name=PROCESSING_CATEGORY_NAME,
            parent_type="Expense",
        )
        db.add(category)
        db.flush()
    return category


def create_processing_fee_transaction(
    db: Session,
    parent: Transaction,
) -> Transaction:
    """Create a secondary 2% fee expense linked to the parent transaction."""
    fee_amount = round(parent.amount * PROCESSING_FEE_RATE, 2)
    if fee_amount <= 0:
        raise ValueError("Fee amount must be positive")

    category = get_or_create_processing_category(db)
    fee_txn = Transaction(
        date=parent.date,
        transaction_type=TransactionType.EXPENSE.value,
        from_account_id=parent.from_account_id,
        to_account_id=None,
        person_id=None,
        category_id=category.id,
        amount=fee_amount,
        description=f"2% processing fee for txn #{parent.id}",
        parent_transaction_id=parent.id,
    )
    db.add(fee_txn)
    db.flush()
    return fee_txn
