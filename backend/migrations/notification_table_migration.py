"""
notification_table_migration.py
--------------------------------
Safe, idempotent migration: creates the `notifications` table.
Uses CREATE TABLE IF NOT EXISTS — safe to re-run on an already-migrated database.
Does NOT alter any existing table.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "pfms.db"


def run():
    print(f"[*] Connecting to {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type                VARCHAR(80) NOT NULL,
            message             TEXT NOT NULL,
            related_entity_type VARCHAR(50),
            related_entity_id   INTEGER,
            created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
            read_at             DATETIME
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at)")
    con.commit()

    count = cur.execute("SELECT COUNT(*) FROM notifications").fetchone()[0]
    print(f"[OK] notifications table ready ({count} existing rows)")
    con.close()


if __name__ == "__main__":
    run()
