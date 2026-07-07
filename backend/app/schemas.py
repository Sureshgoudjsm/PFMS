from datetime import date, datetime
from typing import Any, Optional

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
    total_accounts: int = 0
    total_transactions: int = 0
    has_sample_data: bool = False


# --- AI Copilot Schemas ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)

class ParsedIntent(BaseModel):
    intent: str
    confidence: float
    data: dict[str, Any]
    reply: str

class ChatResponse(BaseModel):
    message: str
    intent: str
    confidence: float
    reply: str
    created: Optional[dict[str, Any]] = None
    executed: bool = False

class ParseOnlyResponse(BaseModel):
    message: str
    intent: str
    confidence: float
    data: dict[str, Any]
    reply: str

class SummaryResponse(BaseModel):
    summary: str
    stats: dict[str, Any]

class OllamaHealthResponse(BaseModel):
    ollama_running: bool
    model: str
    status: str


# --- Preview / Confirm / Undo Schemas ---

class PreviewRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)

class PreviewResponse(BaseModel):
    preview_id: str
    intent: str
    intent_data: dict[str, Any]
    original_text: str

class ConfirmRequest(BaseModel):
    preview_id: str
    intent: str
    intent_data: dict[str, Any]
    execute: bool

class ConfirmResponse(BaseModel):
    status: str
    transaction_id: Optional[int] = None
    timestamp: Optional[int] = None
    milestones: list[dict] = []

class UndoRequest(BaseModel):
    transaction_id: int

class UndoResponse(BaseModel):
    success: bool
    reason: Optional[str] = None


# --- Authentication Schemas ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    salary_day: Optional[int] = Field(None, ge=1, le=31)
    forecast_alert_threshold: Optional[float] = Field(None, ge=0.0)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    salary_day: Optional[int] = None
    forecast_alert_threshold: float = 1000.0

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Phase 2: Notifications ---

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    created_at: datetime
    read_at: Optional[datetime] = None


# --- Phase 2: Health Score ---

class HealthScoreFactor(BaseModel):
    name: str
    weight: float
    raw_value: str
    sub_score: int
    weighted_score: float


class HealthScoreResponse(BaseModel):
    score: int
    is_sufficient_data: bool
    factors: list[HealthScoreFactor]


class HealthNarrativeResponse(BaseModel):
    narrative: str


# --- Phase 2: Conversational Query ---

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class QueryResponse(BaseModel):
    answer: str
    data: dict[str, Any] = {}
    template_used: Optional[str] = None
    is_fallback: bool = False
    example_questions: list[str] = []

class ForecastDay(BaseModel):
    date: str  # ISO-formatted date string
    balance: float
    events: dict[str, bool | float]

class ForecastResponse(BaseModel):
    projection: list[ForecastDay]


# --- Phase 3: Universal Search ---

class SearchResultItem(BaseModel):
    id: int
    type: str
    title: str
    subtitle: str


class SearchResponse(BaseModel):
    transactions: list[SearchResultItem] = []
    accounts: list[SearchResultItem] = []
    people: list[SearchResultItem] = []
    categories: list[SearchResultItem] = []
    emis: list[SearchResultItem] = []
    notifications: list[SearchResultItem] = []


# --- Phase 3: Milestones ---

class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    type: str
    related_entity_id: Optional[int] = None
    achieved_at: datetime


class MilestoneAchieved(BaseModel):
    type: str
    message: str
