import getpass
import os
import sqlite3
import sys
from pathlib import Path

# Add backend to python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.auth import hash_password

DB_PATH = Path(__file__).resolve().parent.parent / "pfms.db"

def run_migration():
    print("==================================================")
    # 1. Prompt for credentials
    username_input = input("Enter desired username (default: [USERNAME]): ").strip()
    username = username_input if username_input else "[USERNAME]"
    
    password = ""
    while not password or len(password) < 6:
        password = getpass.getpass("Enter password (min 6 characters): ")
        if len(password) < 6:
            print("Password is too short!")
            
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match!")
        sys.exit(1)
        
    print(f"[*] Hashing password for user '{username}'...")
    hashed = hash_password(password)
    
    if not DB_PATH.exists():
        print(f"Error: Database file not found at {DB_PATH}")
        sys.exit(1)
        
    print(f"[*] Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Disable foreign keys temporarily during schema modification
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    try:
        # Check if users table or user_id column already exists (idempotency check)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
        if cursor.fetchone():
            # Check if user_id column is present in transactions
            cursor.execute("PRAGMA table_info(transactions);")
            cols = [col[1] for col in cursor.fetchall()]
            if "user_id" in cols:
                print("[!] Database is already migrated to user scoping. Skipping.")
                conn.close()
                return
        
        print("[*] Recording pre-migration row counts...")
        counts = {}
        for table in ["people", "accounts", "transactions", "emi_schedule"]:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            counts[table] = cursor.fetchone()[0]
            print(f"  - {table}: {counts[table]} rows")
            
        # Start transaction block
        cursor.execute("BEGIN TRANSACTION;")
        
        # 1. Create users table
        print("[*] Creating 'users' table...")
        cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(120) UNIQUE NOT NULL,
            hashed_password VARCHAR(128) NOT NULL,
            full_name VARCHAR(100),
            avatar_url VARCHAR(255)
        );
        """)

        # 1.1 Create telegram_links table
        print("[*] Creating 'telegram_links' table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS telegram_links (
            chat_id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id)
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_telegram_links_chat_id ON telegram_links (chat_id);")
        
        # 2. Seed default user_id = 1
        print(f"[*] Seeding default user '{username}' (ID=1)...")
        cursor.execute(
            "INSERT INTO users (id, username, email, hashed_password, full_name, avatar_url) VALUES (?, ?, ?, ?, ?, ?);",
            (1, username, f"{username.lower()}@local.pfms", hashed, username, f"https://api.dicebear.com/7.x/bottts/svg?seed={username}")
        )
        
        # 3. Recreate 'people' table with user_id
        print("[*] Scoping 'people' table...")
        cursor.execute("""
        CREATE TABLE people_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            full_name VARCHAR(120) NOT NULL,
            relationship_type VARCHAR(50) NOT NULL,
            active BOOLEAN NOT NULL DEFAULT 1,
            notes TEXT
        );
        """)
        cursor.execute("""
        INSERT INTO people_new (id, user_id, full_name, relationship_type, active, notes)
        SELECT id, 1, full_name, relationship_type, active, notes FROM people;
        """)
        cursor.execute("DROP TABLE people;")
        cursor.execute("ALTER TABLE people_new RENAME TO people;")
        
        # 4. Recreate 'accounts' table with user_id
        print("[*] Scoping 'accounts' table...")
        cursor.execute("""
        CREATE TABLE accounts_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            account_name VARCHAR(120) NOT NULL,
            account_type VARCHAR(50) NOT NULL,
            current_balance FLOAT NOT NULL DEFAULT 0.0,
            credit_limit FLOAT,
            statement_date DATE,
            due_date DATE
        );
        """)
        cursor.execute("""
        INSERT INTO accounts_new (id, user_id, account_name, account_type, current_balance, credit_limit, statement_date, due_date)
        SELECT id, 1, account_name, account_type, current_balance, credit_limit, statement_date, due_date FROM accounts;
        """)
        cursor.execute("DROP TABLE accounts;")
        cursor.execute("ALTER TABLE accounts_new RENAME TO accounts;")
        
        # 5. Recreate 'transactions' table with user_id
        print("[*] Scoping 'transactions' table...")
        cursor.execute("""
        CREATE TABLE transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            date DATE NOT NULL,
            transaction_type VARCHAR(50) NOT NULL,
            from_account_id INTEGER REFERENCES accounts(id),
            to_account_id INTEGER REFERENCES accounts(id),
            person_id INTEGER REFERENCES people(id),
            category_id INTEGER REFERENCES categories(id),
            amount FLOAT NOT NULL,
            description TEXT,
            parent_transaction_id INTEGER REFERENCES transactions(id),
            created_at DATETIME NOT NULL
        );
        """)
        cursor.execute("""
        INSERT INTO transactions_new (id, user_id, date, transaction_type, from_account_id, to_account_id, person_id, category_id, amount, description, parent_transaction_id, created_at)
        SELECT id, 1, date, transaction_type, from_account_id, to_account_id, person_id, category_id, amount, description, parent_transaction_id, created_at FROM transactions;
        """)
        cursor.execute("DROP TABLE transactions;")
        cursor.execute("ALTER TABLE transactions_new RENAME TO transactions;")
        
        # 6. Recreate 'emi_schedule' table with user_id
        print("[*] Scoping 'emi_schedule' table...")
        cursor.execute("""
        CREATE TABLE emi_schedule_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            emi_name VARCHAR(120) NOT NULL,
            linked_person_id INTEGER REFERENCES people(id),
            amount FLOAT NOT NULL,
            due_date INTEGER NOT NULL,
            frequency VARCHAR(20) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE,
            status VARCHAR(20) NOT NULL DEFAULT 'Active'
        );
        """)
        cursor.execute("""
        INSERT INTO emi_schedule_new (id, user_id, emi_name, linked_person_id, amount, due_date, frequency, start_date, end_date, status)
        SELECT id, 1, emi_name, linked_person_id, amount, due_date, frequency, start_date, end_date, status FROM emi_schedule;
        """)
        cursor.execute("DROP TABLE emi_schedule;")
        cursor.execute("ALTER TABLE emi_schedule_new RENAME TO emi_schedule;")
        
        # Re-enable foreign key checking and verify referential integrity
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA foreign_key_check;")
        fk_violations = cursor.fetchall()
        assert len(fk_violations) == 0, f"Foreign key violations detected post-migration: {fk_violations}"

        # Assertions
        print("[*] Verifying post-migration row counts...")
        for table in ["people", "accounts", "transactions", "emi_schedule"]:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            new_count = cursor.fetchone()[0]
            print(f"  - {table}: {new_count} rows")
            
            # Assert match
            assert new_count == counts[table], f"Row count mismatch for {table}: expected {counts[table]}, got {new_count}."
            
            # Assert no null user_id
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL;")
            null_count = cursor.fetchone()[0]
            assert null_count == 0, f"Found {null_count} rows with null user_id in table {table}."
            
        print("[*] Committing transaction...")
        conn.commit()
        print("\n[+] SUCCESS: Migration executed successfully. Database is now user-scoped!")
        
    except Exception as e:
        print(f"\n[!] ERROR DURING MIGRATION: {e}")
        print("[*] Rolling back transaction to ensure zero data corruption...")
        conn.rollback()
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
