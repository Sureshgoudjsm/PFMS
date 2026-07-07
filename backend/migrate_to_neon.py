"""
Data Migration Script — SQLite → PostgreSQL (Neon)
===================================================
Run this AFTER the backend is deployed on Render and your Neon DB is set up.

Usage:
    set DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
    python migrate_to_neon.py

This script:
1. Reads data_export.json (exported from your local SQLite)
2. Connects to your Neon PostgreSQL database
3. Creates all tables via SQLAlchemy models
4. Inserts users, categories, accounts, transactions in the correct order
"""
import json
import os
import sys
from pathlib import Path

# Allow importing app modules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("ERROR: DATABASE_URL environment variable not set.")
    print("Set it to your Neon PostgreSQL connection string and re-run.")
    sys.exit(1)

# Fix postgres:// -> postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

print(f"Connecting to: {db_url[:40]}...")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

engine = create_engine(db_url, pool_pre_ping=True)

# Create all tables from models
from app.models import Base
print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created.")

Session = sessionmaker(bind=engine)
db = Session()

# Load exported data
export_path = Path(__file__).parent / "data_export.json"
if not export_path.exists():
    print(f"ERROR: {export_path} not found. Run the export from local SQLite first.")
    sys.exit(1)

with open(export_path) as f:
    data = json.load(f)

print(f"\nData to migrate:")
for k, v in data.items():
    print(f"  {k}: {len(v)} records")

try:
    # ── 1. Users ──────────────────────────────────────────────────────────
    from app.models import User
    for u in data["users"]:
        existing = db.query(User).filter_by(username=u["username"]).first()
        if not existing:
            user = User(
                id=u["id"],
                username=u["username"],
                hashed_password=u["hashed_password"],
                full_name=u.get("full_name"),
                avatar_url=u.get("avatar_url"),
                salary_day=u.get("salary_day"),
                forecast_alert_threshold=u.get("forecast_alert_threshold"),
            )
            db.add(user)
    db.flush()
    print(f"✓ Users inserted: {len(data['users'])}")

    # ── 2. Categories ─────────────────────────────────────────────────────
    from app.models import Category
    for cat in data["categories"]:
        existing = db.query(Category).filter_by(id=cat["id"]).first()
        if not existing:
            c = Category(
                id=cat["id"],
                name=cat["name"],
                parent_type=cat.get("parent_type"),
                user_id=cat.get("user_id"),
            )
            db.add(c)
    db.flush()
    print(f"✓ Categories inserted: {len(data['categories'])}")

    # ── 3. Accounts ───────────────────────────────────────────────────────
    from app.models import Account
    for acc in data["accounts"]:
        existing = db.query(Account).filter_by(id=acc["id"]).first()
        if not existing:
            a = Account(
                id=acc["id"],
                user_id=acc["user_id"],
                name=acc["name"],
                account_type=acc.get("account_type"),
                current_balance=acc.get("current_balance", 0),
                credit_limit=acc.get("credit_limit"),
            )
            db.add(a)
    db.flush()
    print(f"✓ Accounts inserted: {len(data['accounts'])}")

    # ── 4. People ─────────────────────────────────────────────────────────
    from app.models import Person
    for p in data["people"]:
        existing = db.query(Person).filter_by(id=p["id"]).first()
        if not existing:
            person = Person(
                id=p["id"],
                user_id=p["user_id"],
                full_name=p["full_name"],
                phone=p.get("phone"),
                is_active=p.get("is_active", True),
            )
            db.add(person)
    db.flush()
    print(f"✓ People inserted: {len(data['people'])}")

    # ── 5. Transactions ───────────────────────────────────────────────────
    from app.models import Transaction
    from datetime import date
    for t in data["transactions"]:
        existing = db.query(Transaction).filter_by(id=t["id"]).first()
        if not existing:
            txn_date = date.fromisoformat(t["date"]) if t.get("date") else date.today()
            txn = Transaction(
                id=t["id"],
                user_id=t["user_id"],
                date=txn_date,
                transaction_type=t.get("transaction_type"),
                description=t.get("description"),
                amount=t.get("amount", 0),
                from_account_id=t.get("from_account_id"),
                to_account_id=t.get("to_account_id"),
                person_id=t.get("person_id"),
                category_id=t.get("category_id"),
            )
            db.add(txn)
    db.flush()
    print(f"✓ Transactions inserted: {len(data['transactions'])}")

    db.commit()
    print("\n🎉 Migration complete! All data has been inserted into Neon PostgreSQL.")

except Exception as e:
    db.rollback()
    print(f"\n❌ Migration failed: {e}")
    raise
finally:
    db.close()
