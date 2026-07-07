import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Use DATABASE_URL env var if set (PostgreSQL on Render/Railway),
# otherwise fall back to local SQLite for development.
_db_url = os.getenv("DATABASE_URL")

if _db_url:
    # Neon/Render provide postgres:// — SQLAlchemy 2.x needs postgresql://
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = _db_url
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,       # reconnect on dropped connections
        pool_size=5,
        max_overflow=10,
    )
else:
    DB_PATH = Path(__file__).resolve().parent.parent / "pfms.db"
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
