from datetime import date
import datetime
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
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


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    salary_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forecast_alert_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=1000.0)

    people: Mapped[list["Person"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    accounts: Mapped[list["Account"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    emi_schedules: Mapped[list["EmiSchedule"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    telegram_links: Mapped[list["TelegramLink"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)

    user: Mapped["User"] = relationship(back_populates="people")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="person")
    emi_schedules: Mapped[list["EmiSchedule"]] = relationship(back_populates="linked_person")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    account_name: Mapped[str] = mapped_column(String(120), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0)
    credit_limit: Mapped[float | None] = mapped_column(Float, nullable=True)
    statement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)

    user: Mapped["User"] = relationship(back_populates="accounts")
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
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
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)

    user: Mapped["User"] = relationship(back_populates="transactions")
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    emi_name: Mapped[str] = mapped_column(String(120), nullable=False)
    linked_person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=EmiStatus.ACTIVE.value)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)

    user: Mapped["User"] = relationship(back_populates="emi_schedules")
    linked_person: Mapped["Person | None"] = relationship(back_populates="emi_schedules")


class TelegramLink(Base):
    __tablename__ = "telegram_links"

    chat_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="telegram_links")


class Notification(Base):
    """Nudge / proactive alert stored per user."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # e.g. "EMI_DUE", "UNUSUAL_SPEND", "LEDGER_REMINDER", "CREDIT_WATCH"
    type: Mapped[str] = mapped_column(String(80), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False, index=True
    )
    read_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="notifications")

class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    related_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    achieved_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "type", "related_entity_id", name="uq_milestone"),)

    user: Mapped["User"] = relationship("User")

