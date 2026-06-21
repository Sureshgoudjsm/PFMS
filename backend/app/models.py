from datetime import date
from enum import Enum

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RelationshipType(str, Enum):
    BROTHER = "Brother"
    SISTER = "Sister"
    FRIEND = "Friend"
    RELATIVE = "Relative"
    COLLEAGUE = "Colleague"
    VENDOR = "Vendor"
    OTHER = "Other"


class AccountType(str, Enum):
    SALARY = "Salary Account"
    SAVINGS = "Savings Account"
    CASH = "Cash"
    CREDIT_CARD = "Credit Card"
    GOLD_LOAN = "Gold Loan Account"
    PERSONAL_LOAN = "Personal Loan Account"
    WALLET = "Wallet"


class ParentType(str, Enum):
    INCOME = "Income"
    EXPENSE = "Expense"
    LOAN = "Loan"
    INVESTMENT = "Investment"


class TransactionType(str, Enum):
    INCOME = "Income"
    EXPENSE = "Expense"
    TRANSFER = "Transfer"
    LOAN_GIVEN = "Loan Given"
    LOAN_RECEIVED = "Loan Received"
    LOAN_REPAYMENT_RECEIVED = "Loan Repayment Received"
    LOAN_REPAYMENT_PAID = "Loan Repayment Paid"
    CREDIT_CARD_PAYMENT = "Credit Card Payment"
    EMI_PAYMENT = "EMI Payment"
    INTEREST_PAYMENT = "Interest Payment"
    INVESTMENT = "Investment"
    WITHDRAWAL = "Withdrawal"
    DEPOSIT = "Deposit"


class EmiFrequency(str, Enum):
    MONTHLY = "Monthly"
    QUARTERLY = "Quarterly"
    YEARLY = "Yearly"


class EmiStatus(str, Enum):
    ACTIVE = "Active"
    PAUSED = "Paused"
    COMPLETED = "Completed"


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="person")
    emi_schedules: Mapped[list["EmiSchedule"]] = relationship(back_populates="linked_person")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_name: Mapped[str] = mapped_column(String(120), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0)
    credit_limit: Mapped[float | None] = mapped_column(Float, nullable=True)
    statement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    transactions_from: Mapped[list["Transaction"]] = relationship(
        back_populates="from_account",
        foreign_keys="Transaction.from_account_id",
    )
    transactions_to: Mapped[list["Transaction"]] = relationship(
        back_populates="to_account",
        foreign_keys="Transaction.to_account_id",
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category_name: Mapped[str] = mapped_column(String(120), nullable=False)
    parent_type: Mapped[str] = mapped_column(String(50), nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    from_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id"), nullable=True
    )

    from_account: Mapped["Account | None"] = relationship(
        back_populates="transactions_from",
        foreign_keys=[from_account_id],
    )
    to_account: Mapped["Account | None"] = relationship(
        back_populates="transactions_to",
        foreign_keys=[to_account_id],
    )
    person: Mapped["Person | None"] = relationship(back_populates="transactions")
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    fee_child: Mapped["Transaction | None"] = relationship(
        "Transaction",
        remote_side=[id],
        foreign_keys=[parent_transaction_id],
        uselist=False,
    )


class EmiSchedule(Base):
    __tablename__ = "emi_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    emi_name: Mapped[str] = mapped_column(String(120), nullable=False)
    linked_person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=EmiStatus.ACTIVE.value)

    linked_person: Mapped["Person | None"] = relationship(back_populates="emi_schedules")
