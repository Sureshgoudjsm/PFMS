import sqlite3
import os
import datetime

def create_local_backup(db_path: str = "C:/PFMS/backend/pfms.db", backup_dir: str = "C:/PFMS/backend/backups") -> str:
    """
    Create a transaction-consistent backup of the SQLite database using the SQLite backup API.
    Returns:
        str: Absolute path to the created backup file.
    """
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"pfms_backup_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)
    
    # Establish connections
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(backup_path)
    
    # Perform backup
    with src, dst:
        src.backup(dst)
        
    src.close()
    dst.close()
    return os.path.abspath(backup_path)
