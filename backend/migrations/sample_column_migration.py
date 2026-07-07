import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "pfms.db"

def run_migration():
    if not DB_PATH.exists():
        print(f"Error: Database file not found at {DB_PATH}")
        return
        
    print(f"[*] Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Disable foreign keys temporarily for alterations
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    tables_to_migrate = {
        "people": "people",
        "accounts": "accounts",
        "transactions": "transactions",
        "emi_schedule": "emi_schedule"
    }
    
    try:
        cursor.execute("BEGIN TRANSACTION;")
        
        for table_key, table_name in tables_to_migrate.items():
            # Check if column already exists
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = [col[1] for col in cursor.fetchall()]
            
            if "is_sample" in columns:
                print(f"[!] Column 'is_sample' already exists in table '{table_name}'. Skipping.")
            else:
                print(f"[*] Adding 'is_sample' column to table '{table_name}'...")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN is_sample BOOLEAN NOT NULL DEFAULT 0;")
                
        conn.commit()
        print("[+] SUCCESS: Migration executed successfully. Sample columns added to all target tables!")
        
    except Exception as e:
        conn.rollback()
        print(f"[-] ERROR DURING MIGRATION: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
