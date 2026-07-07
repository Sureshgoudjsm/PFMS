from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.logic.transactions import create_transaction
from app.models import Transaction, User
from app.schemas import TransactionCreate, TransactionResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _txn_response(txn: Transaction, db: Session) -> TransactionResponse:
    fee = (
        db.query(Transaction)
        .filter(Transaction.parent_transaction_id == txn.id)
        .first()
    )
    resp = TransactionResponse.model_validate(txn)
    if fee:
        resp.processing_fee = TransactionResponse.model_validate(fee)
    return resp


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    person_id: int | None = None,
    account_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if person_id:
        query = query.filter(Transaction.person_id == person_id)
    if account_id:
        query = query.filter(
            (Transaction.from_account_id == account_id)
            | (Transaction.to_account_id == account_id)
        )
    txns = (
        query.order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_txn_response(t, db) for t in txns]


@router.post("", response_model=TransactionResponse, status_code=201)
def add_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump(exclude={"apply_processing_fee"})
    payload["user_id"] = current_user.id
    
    try:
        txn, fee_txn = create_transaction(
            db,
            payload,
            apply_processing_fee=data.apply_processing_fee,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    resp = TransactionResponse.model_validate(txn)
    if fee_txn:
        resp.processing_fee = TransactionResponse.model_validate(fee_txn)
    return resp


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.get(Transaction, transaction_id)
    if not txn or txn.user_id != current_user.id:
        raise HTTPException(404, "Transaction not found")
    return _txn_response(txn, db)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.get(Transaction, transaction_id)
    if not txn or txn.user_id != current_user.id:
        raise HTTPException(404, "Transaction not found")
        
    db.query(Transaction).filter(Transaction.parent_transaction_id == transaction_id).delete()
    db.delete(txn)
    db.commit()
