"""Database connection, pragmas, and schema initialization."""

from contextlib import contextmanager
from pathlib import Path
import sqlite3
import threading
from typing import Generator
from app.core.vault import VaultManager


_db_lock = threading.Lock()


class Database:
    def __init__(self, vault_mgr: VaultManager):
        self.vault = vault_mgr
        self._ensure_db()

    @property
    def db_path(self) -> Path:
        return self.vault.db_path

    def _ensure_db(self) -> None:
        """Create tables if database does not exist."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        schema_file = Path(__file__).parent / "schema.sql"
        schema_sql = schema_file.read_text(encoding="utf-8")
        
        with self.get_connection() as conn:
            conn.executescript(schema_sql)
            conn.commit()

    def get_raw_connection(self) -> sqlite3.Connection:
        """Create a sqlite3 connection with pragmas configured."""
        conn = sqlite3.connect(
            str(self.db_path),
            timeout=10.0,
            check_same_thread=False,
            isolation_level=None,  # Autocommit mode; use BEGIN explicitly in transactions
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        return conn

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager providing a managed connection."""
        conn = self.get_raw_connection()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def transaction(self, foreign_keys: bool = True) -> Generator[sqlite3.Connection, None, None]:
        """Context manager wrapping block in an explicit transaction with lock."""
        with _db_lock:
            conn = self.get_raw_connection()
            if not foreign_keys:
                conn.execute("PRAGMA foreign_keys = OFF;")
            try:
                conn.execute("BEGIN IMMEDIATE;")
                yield conn
                conn.execute("COMMIT;")
            except Exception:
                conn.execute("ROLLBACK;")
                raise
            finally:
                conn.close()
