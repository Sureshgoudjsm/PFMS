"""Transaction validation and creation helpers."""

from sqlalchemy.orm import Session

from app.logic.fees import create_processing_fee_transaction
from app.models import Transaction, TransactionType

TYPES_REQUIRING_FROM = {
    TransactionType.EXPENSE.value,
    TransactionType.TRANSFER.value,
    TransactionType.LOAN_GIVEN.value,
    TransactionType.LOAN_REPAYMENT_PAID.value,
    TransactionType.CREDIT_CARD_PAYMENT.value,
    TransactionType.EMI_PAYMENT.value,
    TransactionType.INTEREST_PAYMENT.value,
    TransactionType.INVESTMENT.value,
    TransactionType.WITHDRAWAL.value,
}

TYPES_REQUIRING_TO = {
    TransactionType.INCOME.value,
    TransactionType.TRANSFER.value,
    TransactionType.LOAN_RECEIVED.value,
    TransactionType.LOAN_REPAYMENT_RECEIVED.value,
    TransactionType.CREDIT_CARD_PAYMENT.value,
    TransactionType.DEPOSIT.value,
}

TYPES_REQUIRING_PERSON = {
    TransactionType.LOAN_GIVEN.value,
    TransactionType.LOAN_RECEIVED.value,
    TransactionType.LOAN_REPAYMENT_RECEIVED.value,
    TransactionType.LOAN_REPAYMENT_PAID.value,
}

DOUBLE_ENTRY_TYPES = {
    TransactionType.TRANSFER.value,
    TransactionType.CREDIT_CARD_PAYMENT.value,
}


def validate_transaction(data: dict) -> None:
    ttype = data["transaction_type"]

    if ttype in TYPES_REQUIRING_FROM and not data.get("from_account_id"):
        raise ValueError(f"'{ttype}' requires from_account_id")

    if ttype in TYPES_REQUIRING_TO and not data.get("to_account_id"):
        raise ValueError(f"'{ttype}' requires to_account_id")

    if ttype in TYPES_REQUIRING_PERSON and not data.get("person_id"):
        raise ValueError(f"'{ttype}' requires person_id")

    if ttype in DOUBLE_ENTRY_TYPES:
        if data.get("from_account_id") == data.get("to_account_id"):
            raise ValueError("Transfer requires different from and to accounts")

    if data["amount"] <= 0:
        raise ValueError("Amount must be positive")


def create_transaction(
    db: Session,
    data: dict,
    apply_processing_fee: bool = False,
) -> tuple[Transaction, Transaction | None]:
    validate_transaction(data)

    txn = Transaction(**data)
    db.add(txn)
    db.flush()

    fee_txn = None
    if apply_processing_fee and txn.from_account_id:
        fee_txn = create_processing_fee_transaction(db, txn)

    db.commit()
    db.refresh(txn)
    if fee_txn:
        db.refresh(fee_txn)

    return txn, fee_txn
