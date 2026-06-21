from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category
from app.schemas import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    parent_type: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Category)
    if parent_type:
        query = query.filter(Category.parent_type == parent_type)
    return query.order_by(Category.parent_type, Category.category_name).all()


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    category = Category(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category
