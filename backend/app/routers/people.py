from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.logic.balance import compute_person_ledger
from app.models import Person, User
from app.schemas import PersonCreate, PersonLedgerResponse, PersonResponse, PersonUpdate, TransactionResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/people", tags=["People"])


@router.get("", response_model=list[PersonResponse])
def list_people(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Person).filter(Person.user_id == current_user.id)
    if active_only:
        query = query.filter(Person.active.is_(True))
    return query.order_by(Person.full_name).all()


@router.post("", response_model=PersonResponse, status_code=201)
def create_person(
    data: PersonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    person = Person(**data.model_dump(), user_id=current_user.id)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@router.get("/{person_id}", response_model=PersonResponse)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    person = db.get(Person, person_id)
    if not person or person.user_id != current_user.id:
        raise HTTPException(404, "Person not found")
    return person


@router.put("/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: int,
    data: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    person = db.get(Person, person_id)
    if not person or person.user_id != current_user.id:
        raise HTTPException(404, "Person not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(person, key, value)
    db.commit()
    db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=204)
def delete_person(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    person = db.get(Person, person_id)
    if not person or person.user_id != current_user.id:
        raise HTTPException(404, "Person not found")
    db.delete(person)
    db.commit()


@router.get("/{person_id}/ledger", response_model=PersonLedgerResponse)
def get_person_ledger(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    person = db.get(Person, person_id)
    if not person or person.user_id != current_user.id:
        raise HTTPException(404, "Person not found")

    ledger = compute_person_ledger(db, person_id)
    transactions = person.transactions
    txn_list = sorted(transactions, key=lambda t: t.date, reverse=True)

    return PersonLedgerResponse(
        id=person.id,
        full_name=person.full_name,
        relationship_type=person.relationship_type,
        active=person.active,
        notes=person.notes,
        ledger=ledger,
        transactions=[TransactionResponse.model_validate(t) for t in txn_list],
    )
