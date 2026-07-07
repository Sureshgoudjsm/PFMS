"""Dynamic balance and ledger computation from transaction history."""

from sqlalchemy.orm import Session

from app.models import Account, AccountType, Transaction, TransactionType

LIABILITY_TYPES = {
    AccountType.CREDIT_CARD.value,
    AccountType.GOLD_LOAN.value,
    AccountType.PERSONAL_LOAN.value,
}


def is_liability(account_type: str) -> bool:
    return account_type in LIABILITY_TYPES


def compute_account_balance(db: Session, account_id: int) -> float:
    """Compute account balance purely from transaction history."""
    account = db.get(Account, account_id)
    if not account:
        return 0.0

    balance = 0.0
    transactions = (
        db.query(Transaction)
        .filter(
            (Transaction.from_account_id == account_id)
            | (Transaction.to_account_id == account_id)
        )
        .all()
    )

    for txn in transactions:
        balance += _transaction_effect_on_account(txn, account_id, account.account_type)

    return round(balance, 2)


def _transaction_effect_on_account(
    txn: Transaction, account_id: int, account_type: str
) -> float:
    """Return signed effect of a transaction on a specific account."""
    amount = txn.amount
    ttype = txn.transaction_type

    if account_id == txn.from_account_id:
        return _from_account_effect(ttype, amount, account_type)

    if account_id == txn.to_account_id:
        return _to_account_effect(ttype, amount, account_type)

    return 0.0


def _from_account_effect(ttype: str, amount: float, account_type: str) -> float:
    """Money leaving or liability changing via from_account."""
    liability = is_liability(account_type)

    if ttype in (
        TransactionType.EXPENSE.value,
        TransactionType.TRANSFER.value,
        TransactionType.LOAN_GIVEN.value,
        TransactionType.LOAN_REPAYMENT_PAID.value,
        TransactionType.CREDIT_CARD_PAYMENT.value,
        TransactionType.EMI_PAYMENT.value,
        TransactionType.INTEREST_PAYMENT.value,
        TransactionType.INVESTMENT.value,
        TransactionType.WITHDRAWAL.value,
    ):
        return -amount if not liability else amount

    if ttype == TransactionType.DEPOSIT.value and liability:
        return -amount

    return 0.0


def _to_account_effect(ttype: str, amount: float, account_type: str) -> float:
    """Money entering or liability changing via to_account."""
    liability = is_liability(account_type)

    if ttype in (
        TransactionType.INCOME.value,
        TransactionType.TRANSFER.value,
        TransactionType.LOAN_RECEIVED.value,
        TransactionType.LOAN_REPAYMENT_RECEIVED.value,
        TransactionType.CREDIT_CARD_PAYMENT.value,
        TransactionType.DEPOSIT.value,
    ):
        if liability:
            return -amount
        return amount

    if ttype in (
        TransactionType.EXPENSE.value,
        TransactionType.EMI_PAYMENT.value,
        TransactionType.INTEREST_PAYMENT.value,
    ) and liability:
        return amount

    return 0.0


def compute_person_ledger(db: Session, person_id: int) -> dict:
    """Friend ledger: outstanding lent and borrowed from transaction history."""
    transactions = db.query(Transaction).filter(Transaction.person_id == person_id).all()

    total_lent = 0.0
    total_lent_returned = 0.0
    total_borrowed = 0.0
    total_borrowed_returned = 0.0

    for txn in transactions:
        if txn.transaction_type == TransactionType.LOAN_GIVEN.value:
            total_lent += txn.amount
        elif txn.transaction_type == TransactionType.LOAN_REPAYMENT_RECEIVED.value:
            total_lent_returned += txn.amount
        elif txn.transaction_type == TransactionType.LOAN_RECEIVED.value:
            total_borrowed += txn.amount
        elif txn.transaction_type == TransactionType.LOAN_REPAYMENT_PAID.value:
            total_borrowed_returned += txn.amount

    outstanding_lent = round(total_lent - total_lent_returned, 2)
    outstanding_borrowed = round(total_borrowed - total_borrowed_returned, 2)

    return {
        "total_lent": round(total_lent, 2),
        "total_lent_returned": round(total_lent_returned, 2),
        "outstanding_lent": outstanding_lent,
        "total_borrowed": round(total_borrowed, 2),
        "total_borrowed_returned": round(total_borrowed_returned, 2),
        "outstanding_borrowed": outstanding_borrowed,
        "net_position": round(outstanding_lent - outstanding_borrowed, 2),
    }


def compute_all_balances(db: Session, user_id: int | None = None) -> dict[int, float]:
    """Compute balances for all accounts."""
    query = db.query(Account)
    if user_id is not None:
        query = query.filter(Account.user_id == user_id)
    accounts = query.all()
    return {acc.id: compute_account_balance(db, acc.id) for acc in accounts}


def compute_net_worth(db: Session, user_id: int | None = None) -> dict:
    """Net worth = total assets - total liabilities."""
    query_acc = db.query(Account)
    if user_id is not None:
        query_acc = query_acc.filter(Account.user_id == user_id)
    accounts = query_acc.all()
    balances = compute_all_balances(db, user_id)

    total_assets = 0.0
    total_liabilities = 0.0
    bank_balance = 0.0
    cash_balance = 0.0
    credit_outstanding = 0.0

    for acc in accounts:
        bal = balances.get(acc.id, 0.0)
        if is_liability(acc.account_type):
            total_liabilities += bal
            if acc.account_type == AccountType.CREDIT_CARD.value:
                credit_outstanding += bal
        else:
            total_assets += bal
            if acc.account_type in (
                AccountType.SALARY.value,
                AccountType.SAVINGS.value,
            ):
                bank_balance += bal
            elif acc.account_type == AccountType.CASH.value:
                cash_balance += bal

    query_people = db.query(Transaction.person_id).filter(Transaction.person_id.isnot(None))
    if user_id is not None:
        query_people = query_people.filter(Transaction.user_id == user_id)
    people = query_people.distinct().all()
    
    money_lent = 0.0
    money_borrowed = 0.0
    for (pid,) in people:
        if pid is None:
            continue
        ledger = compute_person_ledger(db, pid)
        money_lent += ledger["outstanding_lent"]
        money_borrowed += ledger["outstanding_borrowed"]

    total_assets += money_lent
    total_liabilities += money_borrowed

    return {
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "net_worth": round(total_assets - total_liabilities, 2),
        "bank_balance": round(bank_balance, 2),
        "cash_balance": round(cash_balance, 2),
        "credit_outstanding": round(credit_outstanding, 2),
        "money_lent": round(money_lent, 2),
        "money_borrowed": round(money_borrowed, 2),
    }
