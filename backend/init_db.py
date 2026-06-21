"""Initialize SQLite database with schema and seed data."""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import Base, SessionLocal, engine
from app.models import (
    Account,
    AccountType,
    Category,
    EmiSchedule,
    EmiStatus,
    Person,
    RelationshipType,
    Transaction,
    TransactionType,
)


def seed_categories(db):
    categories = [
        ("Salary", "Income"),
        ("Freelance", "Income"),
        ("Interest Earned", "Income"),
        ("Food & Dining", "Expense"),
        ("Transport", "Expense"),
        ("Utilities", "Expense"),
        ("Shopping", "Expense"),
        ("Entertainment", "Expense"),
        ("Processing Charges", "Expense"),
        ("Medical", "Expense"),
        ("Personal Loan", "Loan"),
        ("Friend Loan", "Loan"),
        ("Mutual Funds", "Investment"),
        ("Stocks", "Investment"),
        ("Gold", "Investment"),
    ]
    for name, parent in categories:
        if not db.query(Category).filter(Category.category_name == name).first():
            db.add(Category(category_name=name, parent_type=parent))


def seed_people(db):
    people = [
        ("Sunny", RelationshipType.FRIEND.value, True, "College friend"),
        ("Somesh", RelationshipType.FRIEND.value, True, "Roommate"),
        ("Mahesh", RelationshipType.BROTHER.value, True, "Elder brother"),
        ("Priya", RelationshipType.SISTER.value, True, ""),
        ("Rajesh Vendor", RelationshipType.VENDOR.value, True, "Local shop owner"),
    ]
    for name, rel, active, notes in people:
        if not db.query(Person).filter(Person.full_name == name).first():
            db.add(Person(full_name=name, relationship_type=rel, active=active, notes=notes))


def seed_accounts(db):
    accounts = [
        ("HDFC Salary", AccountType.SALARY.value, 85000, None, 1, 5),
        ("SBI Savings", AccountType.SAVINGS.value, 125000, None, 1, 1),
        ("Cash in Hand", AccountType.CASH.value, 15000, None, None, None),
        ("HDFC Credit Card", AccountType.CREDIT_CARD.value, 0, 200000, 15, 5),
        ("Paytm Wallet", AccountType.WALLET.value, 3500, None, None, None),
        ("Gold Loan - Muthoot", AccountType.GOLD_LOAN.value, 0, 500000, 1, 10),
    ]
    for name, atype, bal, limit, stmt_day, due_day in accounts:
        if not db.query(Account).filter(Account.account_name == name).first():
            db.add(
                Account(
                    account_name=name,
                    account_type=atype,
                    current_balance=bal,
                    credit_limit=limit,
                    statement_date=date(2026, 6, stmt_day) if stmt_day else None,
                    due_date=date(2026, 6, due_day) if due_day else None,
                )
            )


def seed_transactions(db):
    if db.query(Transaction).count() > 0:
        return

    salary_acc = db.query(Account).filter(Account.account_name == "HDFC Salary").first()
    savings_acc = db.query(Account).filter(Account.account_name == "SBI Savings").first()
    cash_acc = db.query(Account).filter(Account.account_name == "Cash in Hand").first()
    cc_acc = db.query(Account).filter(Account.account_name == "HDFC Credit Card").first()
    wallet_acc = db.query(Account).filter(Account.account_name == "Paytm Wallet").first()

    salary_cat = db.query(Category).filter(Category.category_name == "Salary").first()
    food_cat = db.query(Category).filter(Category.category_name == "Food & Dining").first()
    transport_cat = db.query(Category).filter(Category.category_name == "Transport").first()
    loan_cat = db.query(Category).filter(Category.category_name == "Friend Loan").first()

    sunny = db.query(Person).filter(Person.full_name == "Sunny").first()
    somesh = db.query(Person).filter(Person.full_name == "Somesh").first()
    mahesh = db.query(Person).filter(Person.full_name == "Mahesh").first()

    today = date.today()
    month_start = today.replace(day=1)

    txns = [
        Transaction(
            date=month_start,
            transaction_type=TransactionType.INCOME.value,
            to_account_id=salary_acc.id,
            category_id=salary_cat.id,
            amount=95000,
            description="Monthly salary",
        ),
        Transaction(
            date=month_start + timedelta(days=2),
            transaction_type=TransactionType.TRANSFER.value,
            from_account_id=salary_acc.id,
            to_account_id=savings_acc.id,
            amount=30000,
            description="Savings transfer",
        ),
        Transaction(
            date=month_start + timedelta(days=3),
            transaction_type=TransactionType.EXPENSE.value,
            from_account_id=salary_acc.id,
            category_id=food_cat.id,
            amount=4500,
            description="Groceries",
        ),
        Transaction(
            date=month_start + timedelta(days=5),
            transaction_type=TransactionType.EXPENSE.value,
            from_account_id=cash_acc.id,
            category_id=transport_cat.id,
            amount=800,
            description="Auto fare",
        ),
        Transaction(
            date=month_start + timedelta(days=7),
            transaction_type=TransactionType.LOAN_GIVEN.value,
            from_account_id=savings_acc.id,
            person_id=sunny.id,
            category_id=loan_cat.id,
            amount=10000,
            description="Emergency loan to Sunny",
        ),
        Transaction(
            date=month_start + timedelta(days=10),
            transaction_type=TransactionType.LOAN_REPAYMENT_RECEIVED.value,
            to_account_id=savings_acc.id,
            person_id=sunny.id,
            category_id=loan_cat.id,
            amount=3000,
            description="Partial repayment from Sunny",
        ),
        Transaction(
            date=month_start + timedelta(days=12),
            transaction_type=TransactionType.LOAN_GIVEN.value,
            from_account_id=cash_acc.id,
            person_id=somesh.id,
            category_id=loan_cat.id,
            amount=5000,
            description="Shared dinner advance",
        ),
        Transaction(
            date=month_start + timedelta(days=14),
            transaction_type=TransactionType.LOAN_RECEIVED.value,
            to_account_id=cash_acc.id,
            person_id=mahesh.id,
            category_id=loan_cat.id,
            amount=2000,
            description="Borrowed from Mahesh",
        ),
        Transaction(
            date=month_start + timedelta(days=15),
            transaction_type=TransactionType.EXPENSE.value,
            from_account_id=cc_acc.id,
            category_id=food_cat.id,
            amount=3200,
            description="Credit card dining",
        ),
        Transaction(
            date=month_start + timedelta(days=18),
            transaction_type=TransactionType.CREDIT_CARD_PAYMENT.value,
            from_account_id=salary_acc.id,
            to_account_id=cc_acc.id,
            amount=3200,
            description="CC bill payment",
        ),
        Transaction(
            date=month_start + timedelta(days=20),
            transaction_type=TransactionType.TRANSFER.value,
            from_account_id=salary_acc.id,
            to_account_id=wallet_acc.id,
            amount=5000,
            description="Wallet load",
        ),
    ]

    for txn in txns:
        db.add(txn)

    db.flush()

    processing_cat = db.query(Category).filter(Category.category_name == "Processing Charges").first()
    wallet_load = db.query(Transaction).filter(Transaction.description == "Wallet load").first()
    if wallet_load and processing_cat:
        db.add(
            Transaction(
                date=wallet_load.date,
                transaction_type=TransactionType.EXPENSE.value,
                from_account_id=wallet_load.from_account_id,
                category_id=processing_cat.id,
                amount=round(wallet_load.amount * 0.02, 2),
                description="2% processing fee for wallet load",
                parent_transaction_id=wallet_load.id,
            )
        )


def seed_emi(db):
    if db.query(EmiSchedule).count() > 0:
        return

    gold_loan = db.query(Account).filter(Account.account_type == AccountType.GOLD_LOAN.value).first()
    db.add(
        EmiSchedule(
            emi_name="Gold Loan EMI",
            linked_person_id=None,
            amount=8500,
            due_date=10,
            frequency="Monthly",
            start_date=date(2025, 6, 1),
            end_date=date(2028, 6, 1),
            status=EmiStatus.ACTIVE.value,
        )
    )


def init_db(reset: bool = False):
    if reset and engine.url.database:
        db_file = Path(engine.url.database)
        if db_file.exists():
            db_file.unlink()

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_categories(db)
        db.flush()
        seed_people(db)
        db.flush()
        seed_accounts(db)
        db.flush()
        seed_transactions(db)
        seed_emi(db)
        db.commit()
        print("Database initialized successfully.")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    init_db(reset=reset)
