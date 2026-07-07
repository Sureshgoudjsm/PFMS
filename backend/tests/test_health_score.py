import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys, os; sys.path.append(os.path.abspath('C:/PFMS/backend'))
from app.database import Base
from app.models import User
from app.logic.health_score import compute_health_score

@pytest.fixture(scope="function")
def db():
    # In‑memory SQLite for isolated tests
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = TestSessionLocal()
    yield db
    db.close()

def test_health_score_insufficient_data(db):
    # Create a user with no transactions
    user = User(username="testuser", email="test@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)
    result = compute_health_score(db, user.id)
    assert result["is_sufficient_data"] is False
    assert result["score"] == 0
    assert result["factors"] == []
