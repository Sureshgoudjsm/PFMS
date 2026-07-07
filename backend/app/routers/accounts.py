from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.logic.balance import compute_account_balance
from app.models import Account, User
from app.schemas import AccountCreate, AccountResponse, AccountUpdate
from app.core.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["Accounts"])


def _account_with_balance(account: Account, db: Session) -> AccountResponse:
    computed = compute_account_balance(db, account.id)
    return AccountResponse(
        id=account.id,
        account_name=account.account_name,
        account_type=account.account_type,
        current_balance=computed,
        computed_balance=computed,
        credit_limit=account.credit_limit,
        statement_date=account.statement_date,
        due_date=account.due_date,
    )


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    accounts = (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.account_name)
        .all()
    )
    return [_account_with_balance(a, db) for a in accounts]


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(
    data: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = Account(**data.model_dump(), user_id=current_user.id)
    db.add(account)
    db.commit()
    db.refresh(account)
    return _account_with_balance(account, db)


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(404, "Account not found")
    return _account_with_balance(account, db)


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    data: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(404, "Account not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return _account_with_balance(account, db)


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(404, "Account not found")
    db.delete(account)
    db.commit()
