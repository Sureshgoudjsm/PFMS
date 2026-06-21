from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.logic.balance import compute_net_worth
from app.models import Category, Transaction, TransactionType
from app.schemas import (
    DashboardResponse,
    DashboardSummary,
    EmiCreate,
    EmiResponse,
    TransactionResponse,
    TrendPoint,
)

router = APIRouter(tags=["Dashboard & EMI"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    expense_types = [
        TransactionType.EXPENSE.value,
        TransactionType.EMI_PAYMENT.value,
        TransactionType.INTEREST_PAYMENT.value,
    ]

    month_expenses = (
        db.query(Transaction)
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .filter(
            Transaction.date >= month_start,
            Transaction.date <= today,
            Transaction.transaction_type.in_(expense_types),
        )
        .all()
    )
    current_month_expenses = round(sum(t.amount for t in month_expenses), 2)

    nw = compute_net_worth(db)

    trend: list[TrendPoint] = []
    for i in range(5, -1, -1):
        ref = today - relativedelta(months=i)
        m_start = ref.replace(day=1)
        m_end = (m_start + relativedelta(months=1)) - relativedelta(days=1)

        income = (
            db.query(Transaction)
            .filter(
                Transaction.date >= m_start,
                Transaction.date <= m_end,
                Transaction.transaction_type == TransactionType.INCOME.value,
            )
            .all()
        )
        expenses = (
            db.query(Transaction)
            .filter(
                Transaction.date >= m_start,
                Transaction.date <= m_end,
                Transaction.transaction_type.in_(expense_types),
            )
            .all()
        )
        inc_total = sum(t.amount for t in income)
        exp_total = sum(t.amount for t in expenses)
        trend.append(
            TrendPoint(
                month=m_start.strftime("%b %Y"),
                income=round(inc_total, 2),
                expenses=round(exp_total, 2),
                net=round(inc_total - exp_total, 2),
            )
        )

    recent = (
        db.query(Transaction)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(10)
        .all()
    )

    return DashboardResponse(
        summary=DashboardSummary(
            current_month_expenses=current_month_expenses,
            total_bank_balance=nw["bank_balance"],
            cash_balance=nw["cash_balance"],
            credit_outstanding=nw["credit_outstanding"],
            money_lent=nw["money_lent"],
            money_borrowed=nw["money_borrowed"],
            net_worth=nw["net_worth"],
            total_assets=nw["total_assets"],
            total_liabilities=nw["total_liabilities"],
        ),
        trend=trend,
        recent_transactions=[TransactionResponse.model_validate(t) for t in recent],
    )


@router.get("/emi", response_model=list[EmiResponse])
def list_emi(db: Session = Depends(get_db)):
    from app.models import EmiSchedule

    return db.query(EmiSchedule).order_by(EmiSchedule.emi_name).all()


@router.post("/emi", response_model=EmiResponse, status_code=201)
def create_emi(data: EmiCreate, db: Session = Depends(get_db)):
    from app.models import EmiSchedule

    emi = EmiSchedule(**data.model_dump())
    db.add(emi)
    db.commit()
    db.refresh(emi)
    return emi


@router.delete("/emi/{emi_id}", status_code=204)
def delete_emi(emi_id: int, db: Session = Depends(get_db)):
    from app.models import EmiSchedule

    emi = db.get(EmiSchedule, emi_id)
    if not emi:
        raise HTTPException(404, "EMI schedule not found")
    db.delete(emi)
    db.commit()
