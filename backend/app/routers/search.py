"""Universal search and milestones endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Transaction, Account, Person, Category, Milestone, User, EmiSchedule, Notification
from app.schemas import SearchResponse, SearchResultItem, MilestoneResponse
from app.core.auth import get_current_user

router = APIRouter(tags=["Search"])


@router.get("/search", response_model=SearchResponse)
def universal_search(
    q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search across transactions, accounts, people, and categories."""
    pattern = f"%{q}%"

    # Transactions — search by description
    txn_rows = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.description.ilike(pattern),
        )
        .order_by(Transaction.date.desc())
        .limit(5)
        .all()
    )
    transactions = [
        SearchResultItem(
            id=t.id,
            type="transaction",
            title=t.description or f"{t.transaction_type} — ₹{t.amount}",
            subtitle=f"{t.transaction_type} · ₹{t.amount} · {t.date}",
        )
        for t in txn_rows
    ]

    # Accounts — search by account_name
    acc_rows = (
        db.query(Account)
        .filter(
            Account.user_id == current_user.id,
            Account.account_name.ilike(pattern),
        )
        .limit(5)
        .all()
    )
    accounts = [
        SearchResultItem(
            id=a.id,
            type="account",
            title=a.account_name,
            subtitle=a.account_type,
        )
        for a in acc_rows
    ]

    # People — search by full_name
    person_rows = (
        db.query(Person)
        .filter(
            Person.user_id == current_user.id,
            Person.full_name.ilike(pattern),
        )
        .limit(5)
        .all()
    )
    people = [
        SearchResultItem(
            id=p.id,
            type="person",
            title=p.full_name,
            subtitle=p.relationship_type,
        )
        for p in person_rows
    ]

    # Categories — search by category_name (shared, not user-scoped)
    cat_rows = (
        db.query(Category)
        .filter(Category.category_name.ilike(pattern))
        .limit(5)
        .all()
    )
    categories = [
        SearchResultItem(
            id=c.id,
            type="category",
            title=c.category_name,
            subtitle=c.parent_type,
        )
        for c in cat_rows
    ]

    # EMIs — search by emi_name
    emi_rows = (
        db.query(EmiSchedule)
        .filter(
            EmiSchedule.user_id == current_user.id,
            EmiSchedule.emi_name.ilike(pattern),
        )
        .limit(5)
        .all()
    )
    emis = [
        SearchResultItem(
            id=e.id,
            type="emi",
            title=e.emi_name,
            subtitle=f"₹{e.amount} · Due: {e.due_date} · {e.status}",
        )
        for e in emi_rows
    ]

    # Notifications — search by message
    notif_rows = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.message.ilike(pattern),
        )
        .limit(5)
        .all()
    )
    notifications = [
        SearchResultItem(
            id=n.id,
            type="notification",
            title=n.message,
            subtitle=f"{n.type} · {n.created_at}",
        )
        for n in notif_rows
    ]

    return SearchResponse(
        transactions=transactions,
        accounts=accounts,
        people=people,
        categories=categories,
        emis=emis,
        notifications=notifications,
    )


@router.get("/milestones", response_model=list[MilestoneResponse])
def list_milestones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all milestones achieved by the current user."""
    rows = (
        db.query(Milestone)
        .filter(Milestone.user_id == current_user.id)
        .order_by(Milestone.achieved_at.desc())
        .all()
    )
    return [MilestoneResponse.model_validate(r) for r in rows]
