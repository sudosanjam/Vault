"""Dependency injection providers for Vault backend API."""

from pathlib import Path
from typing import Optional
from fastapi import Request
from app.config import get_default_vault_path, settings
from app.core.attachments import AttachmentManager
from app.core.vault import VaultManager
from app.db.database import Database
from app.db.indexer import Indexer
from app.services.backup_service import BackupService
from app.services.diagnostics_service import DiagnosticsService
from app.services.export_service import ExportService
from app.services.graph_service import GraphService
from app.services.import_service import ImportService
from app.services.note_service import NoteService
from app.services.search_service import SearchService


class ServiceContainer:
    _instance: Optional["ServiceContainer"] = None

    def __init__(self, vault_path: Optional[Path] = None):
        self.vault = VaultManager(vault_path)
        self.db = Database(self.vault)
        self.indexer = Indexer(self.vault, self.db)
        self.att_mgr = AttachmentManager(self.vault)
        self.note_service = NoteService(self.vault, self.db, self.indexer)
        self.graph_service = GraphService(self.vault, self.db, self.note_service)
        self.search_service = SearchService(self.db)
        self.backup_service = BackupService(self.vault, self.indexer)
        self.export_service = ExportService(self.vault, self.db)
        self.import_service = ImportService(self.vault, self.indexer)
        self.diagnostics_service = DiagnosticsService(self.vault, self.db, self.att_mgr)

        # Initial index check: if database has 0 notes, run rebuild index
        self._check_initial_index()

    def _check_initial_index(self) -> None:
        try:
            with self.db.get_connection() as conn:
                count = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
                if count == 0 and any(self.vault.nodes_dir.glob("*.md")):
                    print("[Vault] Initializing database index from existing markdown files...")
                    self.indexer.rebuild_full_index()
        except Exception as e:
            print(f"[Vault] Initial index error: {e}")

    @classmethod
    def get_instance(cls, vault_path: Optional[Path] = None) -> "ServiceContainer":
        if cls._instance is None:
            cls._instance = cls(vault_path)
        return cls._instance

    @classmethod
    def reconfigure_vault_path(cls, new_path: Path) -> "ServiceContainer":
        cls._instance = cls(new_path)
        return cls._instance


def get_services() -> ServiceContainer:
    return ServiceContainer.get_instance()
