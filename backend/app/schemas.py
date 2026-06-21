from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# --- People ---


class PersonBase(BaseModel):
    full_name: str
    relationship_type: str
    active: bool = True
    notes: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    relationship_type: Optional[str] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class PersonResponse(PersonBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class PersonLedgerResponse(PersonResponse):
    ledger: dict
    transactions: list["TransactionResponse"]


# --- Accounts ---


class AccountBase(BaseModel):
    account_name: str
    account_type: str
    credit_limit: Optional[float] = None
    statement_date: Optional[date] = None
    due_date: Optional[date] = None


class AccountCreate(AccountBase):
    current_balance: float = 0.0


class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    credit_limit: Optional[float] = None
    statement_date: Optional[date] = None
    due_date: Optional[date] = None


class AccountResponse(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    current_balance: float
    computed_balance: float


# --- Categories ---


class CategoryBase(BaseModel):
    category_name: str
    parent_type: str


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# --- Transactions ---


class TransactionBase(BaseModel):
    date: date
    transaction_type: str
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    person_id: Optional[int] = None
    category_id: Optional[int] = None
    amount: float = Field(gt=0)
    description: Optional[str] = None


class TransactionCreate(TransactionBase):
    apply_processing_fee: bool = False


class TransactionResponse(TransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    parent_transaction_id: Optional[int] = None
    processing_fee: Optional["TransactionResponse"] = None


# --- EMI ---


class EmiBase(BaseModel):
    emi_name: str
    linked_person_id: Optional[int] = None
    amount: float
    due_date: int = Field(ge=1, le=31)
    frequency: str
    start_date: date
    end_date: Optional[date] = None
    status: str = "Active"


class EmiCreate(EmiBase):
    pass


class EmiResponse(EmiBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# --- Dashboard ---


class DashboardSummary(BaseModel):
    current_month_expenses: float
    total_bank_balance: float
    cash_balance: float
    credit_outstanding: float
    money_lent: float
    money_borrowed: float
    net_worth: float
    total_assets: float
    total_liabilities: float


class TrendPoint(BaseModel):
    month: str
    income: float
    expenses: float
    net: float


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    trend: list[TrendPoint]
    recent_transactions: list[TransactionResponse]
