"""Export & audit endpoints for transaction data."""

import csv
import datetime
import io
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Transaction, Account, Person, Category, User
from app.core.auth import get_current_user
from app.logic.audit import compute_account_running_balances
from app.logic.backup import create_local_backup

router = APIRouter(tags=["Export"])


def _build_txn_query(
    db: Session,
    user_id: int,
    start_date: Optional[str],
    end_date: Optional[str],
):
    """Build a filtered transaction query for the given user."""
    query = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.from_account),
            joinedload(Transaction.to_account),
            joinedload(Transaction.category),
            joinedload(Transaction.person),
        )
        .filter(Transaction.user_id == user_id)
    )

    if start_date:
        try:
            sd = datetime.date.fromisoformat(start_date)
            query = query.filter(Transaction.date >= sd)
        except ValueError:
            raise HTTPException(400, "Invalid start_date format. Expected YYYY-MM-DD.")

    if end_date:
        try:
            ed = datetime.date.fromisoformat(end_date)
            query = query.filter(Transaction.date <= ed)
        except ValueError:
            raise HTTPException(400, "Invalid end_date format. Expected YYYY-MM-DD.")

    return query.order_by(Transaction.date.desc(), Transaction.id.desc())


def _txn_to_dict(txn: Transaction) -> dict:
    """Serialise a Transaction row to a flat dict for export."""
    return {
        "id": txn.id,
        "date": str(txn.date),
        "transaction_type": txn.transaction_type,
        "amount": txn.amount,
        "description": txn.description or "",
        "from_account": txn.from_account.account_name if txn.from_account else "",
        "to_account": txn.to_account.account_name if txn.to_account else "",
        "category": txn.category.category_name if txn.category else "",
        "person": txn.person.full_name if txn.person else "",
    }


@router.get("/export")
def export_transactions(
    format: str = Query("json", regex="^(json|csv)$"),
    start_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export user transactions as JSON or CSV."""
    query = _build_txn_query(db, current_user.id, start_date, end_date)
    txns = query.all()
    rows = [_txn_to_dict(t) for t in txns]

    if format == "csv":
        buf = io.StringIO()
        columns = [
            "date",
            "transaction_type",
            "amount",
            "description",
            "from_account",
            "to_account",
            "category",
            "person",
        ]
        writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=pfms_export.csv"
            },
        )

    # Default: JSON
    return {
        "transactions": rows,
        "exported_at": datetime.datetime.utcnow().isoformat(),
        "total": len(rows),
    }


@router.get("/audit")
def audit_summary(
    start_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Audit summary: totals, date range, type breakdown, monthly totals."""
    query = _build_txn_query(db, current_user.id, start_date, end_date)
    txns = query.all()

    if not txns:
        return {
            "total_transactions": 0,
            "date_range": {"start": None, "end": None},
            "breakdown_by_type": {},
            "monthly_totals": {},
        }

    dates = [t.date for t in txns]
    min_date = min(dates)
    max_date = max(dates)

    # Breakdown by transaction type
    type_breakdown: dict[str, dict] = defaultdict(lambda: {"count": 0, "total_amount": 0.0})
    for t in txns:
        type_breakdown[t.transaction_type]["count"] += 1
        type_breakdown[t.transaction_type]["total_amount"] = round(
            type_breakdown[t.transaction_type]["total_amount"] + t.amount, 2
        )

    # Monthly totals
    monthly: dict[str, dict] = defaultdict(lambda: {"count": 0, "total_amount": 0.0})
    for t in txns:
        key = t.date.strftime("%Y-%m")
        monthly[key]["count"] += 1
        monthly[key]["total_amount"] = round(monthly[key]["total_amount"] + t.amount, 2)

    return {
        "total_transactions": len(txns),
        "date_range": {"start": str(min_date), "end": str(max_date)},
        "breakdown_by_type": dict(type_breakdown),
        "monthly_totals": dict(monthly),
    }


@router.get("/audit/running-balances")
def get_running_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return historical running balances computed per account for the user."""
    return compute_account_running_balances(db, current_user.id)


@router.post("/backup")
def trigger_backup(
    current_user: User = Depends(get_current_user),
):
    """Trigger a transaction-consistent SQLite database backup."""
    try:
        backup_file = create_local_backup()
        return {"status": "success", "backup_path": backup_file}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database backup failed: {str(e)}")
