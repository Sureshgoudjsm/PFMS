import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "pfms.db"

def create_table():
    if not DB_PATH.exists():
        print(f"Error: Database file not found at {DB_PATH}")
        return
        
    print(f"[*] Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        print("[*] Creating 'telegram_links' table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS telegram_links (
            chat_id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id)
        );
        """)
        
        # Also create index on chat_id if not present
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_telegram_links_chat_id ON telegram_links (chat_id);")
        
        conn.commit()
        print("[+] SUCCESS: 'telegram_links' table created successfully!")
    except Exception as e:
        conn.rollback()
        print(f"[-] ERROR: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    create_table()
