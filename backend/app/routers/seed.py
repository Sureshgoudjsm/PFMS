from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Transaction, EmiSchedule, Account, Person, User, Milestone, Notification
from app.core.auth import get_current_user
from app.routers.ai import _get_or_create_category

router = APIRouter(prefix="/seed", tags=["Seeding"])


@router.post("/sample", status_code=201)
def seed_sample_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Clear any existing sample data to prevent duplicate seeds
    _clear_user_samples(db, current_user.id)
    
    today = date.today()
    
    try:
        # 2. Create sample friend contact
        ravi = Person(
            user_id=current_user.id,
            full_name="[Sample] Ravi",
            relationship_type="Friend",
            active=True,
            notes="Sample friend contact for peer loans",
            is_sample=True
        )
        db.add(ravi)
        db.flush()
        
        # 3. Create sample bank account and cash wallet
        salary_acc = Account(
            user_id=current_user.id,
            account_name="[Sample] Salary Account",
            account_type="Savings Account",
            current_balance=0.0,
            is_sample=True
        )
        cash_wallet = Account(
            user_id=current_user.id,
            account_name="[Sample] Cash Wallet",
            account_type="Wallet",
            current_balance=0.0,
            is_sample=True
        )
        db.add(salary_acc)
        db.add(cash_wallet)
        db.flush()
        
        # 4. Create initial balance transactions
        sal_deposit = Transaction(
            user_id=current_user.id,
            date=today - timedelta(days=15),
            transaction_type="Income",
            to_account_id=salary_acc.id,
            amount=50000.0,
            description="Sample monthly salary deposit",
            is_sample=True
        )
        cash_withdraw = Transaction(
            user_id=current_user.id,
            date=today - timedelta(days=14),
            transaction_type="Income",
            to_account_id=cash_wallet.id,
            amount=5000.0,
            description="Sample cash withdrawal from bank",
            is_sample=True
        )
        db.add(sal_deposit)
        db.add(cash_withdraw)
        db.flush()
        
        # 5. Create loan transactions with Ravi (Lent ₹10k, Repaid ₹4k)
        loan_given = Transaction(
            user_id=current_user.id,
            date=today - timedelta(days=10),
            transaction_type="Loan Given",
            from_account_id=cash_wallet.id,
            person_id=ravi.id,
            amount=10000.0,
            description="Lent money for travel expenses",
            is_sample=True
        )
        loan_repaid = Transaction(
            user_id=current_user.id,
            date=today - timedelta(days=5),
            transaction_type="Loan Repayment Received",
            to_account_id=cash_wallet.id,
            person_id=ravi.id,
            amount=4000.0,
            description="Ravi paid back partial amount",
            is_sample=True
        )
        db.add(loan_given)
        db.add(loan_repaid)
        db.flush()
        
        # 6. Create active EMI (next due in 7 days)
        due_date_target = today + timedelta(days=7)
        emi = EmiSchedule(
            user_id=current_user.id,
            emi_name="[Sample] Bike Loan EMI",
            amount=4200.0,
            due_date=due_date_target.day,
            frequency="Monthly",
            start_date=today - timedelta(days=23),
            end_date=today + timedelta(days=365),
            status="Active",
            is_sample=True
        )
        db.add(emi)
        db.flush()
        
        # 7. Create 5-6 sample expenses across categories
        cat_food = _get_or_create_category(db, "Food", "Expense")
        cat_trans = _get_or_create_category(db, "Transport", "Expense")
        cat_ent = _get_or_create_category(db, "Entertainment", "Expense")
        
        expenses = [
            Transaction(
                user_id=current_user.id,
                date=today - timedelta(days=4),
                transaction_type="Expense",
                from_account_id=cash_wallet.id,
                category_id=cat_food,
                amount=1200.0,
                description="Dinner at restaurant",
                is_sample=True
            ),
            Transaction(
                user_id=current_user.id,
                date=today - timedelta(days=3),
                transaction_type="Expense",
                from_account_id=salary_acc.id,
                category_id=cat_trans,
                amount=350.0,
                description="Uber ride to office",
                is_sample=True
            ),
            Transaction(
                user_id=current_user.id,
                date=today - timedelta(days=3),
                transaction_type="Expense",
                from_account_id=salary_acc.id,
                category_id=cat_ent,
                amount=600.0,
                description="Movie tickets with friends",
                is_sample=True
            ),
            Transaction(
                user_id=current_user.id,
                date=today - timedelta(days=2),
                transaction_type="Expense",
                from_account_id=salary_acc.id,
                category_id=cat_food,
                amount=2450.0,
                description="Weekly grocery shopping",
                is_sample=True
            ),
            Transaction(
                user_id=current_user.id,
                date=today - timedelta(days=1),
                transaction_type="Expense",
                from_account_id=cash_wallet.id,
                category_id=cat_food,
                amount=150.0,
                description="Afternoon coffee",
                is_sample=True
            ),
            Transaction(
                user_id=current_user.id,
                date=today,
                transaction_type="Expense",
                from_account_id=salary_acc.id,
                category_id=cat_trans,
                amount=1000.0,
                description="Fuel refill",
                is_sample=True
            )
        ]
        db.add_all(expenses)
        db.commit()
        return {"status": "seeded"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed sample data: {str(e)}"
        )


@router.delete("/sample")
def clear_sample_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        deleted_count = _clear_user_samples(db, current_user.id)
        db.commit()
        return {"status": "cleared", "deleted_rows_count": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear sample data: {str(e)}"
        )


def _clear_user_samples(db: Session, user_id: int) -> int:
    # 1. Delete transactions
    tx_deleted = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.is_sample.is_(True))
        .delete()
    )
    
    # 2. Delete EMIs
    emi_deleted = (
        db.query(EmiSchedule)
        .filter(EmiSchedule.user_id == user_id, EmiSchedule.is_sample.is_(True))
        .delete()
    )
    
    # 3. Delete Accounts
    acc_deleted = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.is_sample.is_(True))
        .delete()
    )
    
    # 4. Delete People
    people_deleted = (
        db.query(Person)
        .filter(Person.user_id == user_id, Person.is_sample.is_(True))
        .delete()
    )
    
    return tx_deleted + emi_deleted + acc_deleted + people_deleted


@router.delete("/reset")
def reset_user_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        deleted_count = _clear_all_user_data(db, current_user.id)
        db.commit()
        return {"status": "reset", "deleted_rows_count": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset user database: {str(e)}"
        )


def _clear_all_user_data(db: Session, user_id: int) -> int:
    # 1. Delete notifications
    notif_deleted = db.query(Notification).filter(Notification.user_id == user_id).delete()
    
    # 2. Delete milestones
    ms_deleted = db.query(Milestone).filter(Milestone.user_id == user_id).delete()
    
    # 3. Delete transactions
    tx_deleted = db.query(Transaction).filter(Transaction.user_id == user_id).delete()
    
    # 4. Delete EMIs
    emi_deleted = db.query(EmiSchedule).filter(EmiSchedule.user_id == user_id).delete()
    
    # 5. Delete Accounts
    acc_deleted = db.query(Account).filter(Account.user_id == user_id).delete()
    
    # 6. Delete People
    people_deleted = db.query(Person).filter(Person.user_id == user_id).delete()
    
    return notif_deleted + ms_deleted + tx_deleted + emi_deleted + acc_deleted + people_deleted

