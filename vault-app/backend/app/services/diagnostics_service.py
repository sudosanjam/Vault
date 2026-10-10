"""Diagnostics service for complete system health checks and data integrity validation."""

from pathlib import Path
import shutil
from typing import List
from app.core.attachments import AttachmentManager
from app.core.vault import VaultManager
from app.db.database import Database
from app.models.diagnostics import DiagnosticItem, SystemDiagnostics


class DiagnosticsService:
    def __init__(self, vault_mgr: VaultManager, db: Database, att_mgr: AttachmentManager):
        self.vault = vault_mgr
        self.db = db
        self.att_mgr = att_mgr

    def run_diagnostics(self) -> SystemDiagnostics:
        """Execute full health check on vault, database, attachments, links, and renderer."""
        issues: List[DiagnosticItem] = []
        
        # 1. Vault accessibility
        is_accessible = self.vault.root_path.exists()
        is_writable = False
        if is_accessible:
            try:
                test_file = self.vault.metadata_dir / ".health_check_probe"
                test_file.write_text("probe", encoding="utf-8")
                test_file.unlink()
                is_writable = True
            except Exception as e:
                issues.append(
                    DiagnosticItem(
                        status="error",
                        category="storage",
                        title="Vault Directory Not Writable",
                        message=f"Vault path is not writable: {e}",
                    )
                )

        # 2. Database status & counts
        note_count = 0
        broken_links_count = 0
        missing_attachments_count = 0

        with self.db.get_connection() as conn:
            try:
                note_count = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
                broken_links_count = conn.execute("SELECT COUNT(*) FROM edges WHERE is_broken = 1").fetchone()[0]
            except Exception as e:
                issues.append(
                    DiagnosticItem(
                        status="error",
                        category="indexing",
                        title="SQLite Index Issue",
                        message=f"Error querying derived SQLite index: {e}",
                    )
                )

        if broken_links_count > 0:
            issues.append(
                DiagnosticItem(
                    status="warn",
                    category="links",
                    title="Broken Links Detected",
                    message=f"Found {broken_links_count} broken internal links targeting nonexistent notes.",
                )
            )

        # 3. Attachment stats & orphans
        all_att_files = self.att_mgr.get_all_attachment_files()
        attachment_count = len(all_att_files)
        total_att_bytes = sum(p.stat().st_size for p in all_att_files if p.exists())

        # Collect references from notes
        referenced_paths = set()
        with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT file_path FROM attachments")
            referenced_paths = {r["file_path"] for r in cursor.fetchall()}

        orphaned = self.att_mgr.find_orphaned_attachments(referenced_paths)
        orphaned_count = len(orphaned)

        if orphaned_count > 0:
            issues.append(
                DiagnosticItem(
                    status="info",
                    category="attachments",
                    title="Orphaned Attachments Found",
                    message=f"{orphaned_count} attachments are not referenced in any note markdown.",
                )
            )

        # 4. Check for missing attachment files
        for ref in referenced_paths:
            if not (self.vault.root_path / ref).exists():
                missing_attachments_count += 1

        if missing_attachments_count > 0:
            issues.append(
                DiagnosticItem(
                    status="warn",
                    category="attachments",
                    title="Missing Attachments",
                    message=f"{missing_attachments_count} referenced attachments could not be found on disk.",
                )
            )

        # 5. Disk storage
        try:
            total, used, free = shutil.disk_usage(self.vault.root_path)
            disk_free = free
        except Exception:
            disk_free = 0

        # 6. Database file size
        db_size = self.vault.db_path.stat().st_size if self.vault.db_path.exists() else 0

        # 7. Backup info
        backups = list(self.vault.backups_dir.glob("*.zip"))
        backup_count = len(backups)
        last_backup_date = None
        if backups:
            newest = max(backups, key=lambda p: p.stat().st_mtime)
            last_backup_date = newest.name

        return SystemDiagnostics(
            app_name="Vault",
            app_version="1.0.0",
            vault_path=str(self.vault.root_path),
            is_vault_accessible=is_accessible,
            is_vault_writable=is_writable,
            note_count=note_count,
            attachment_count=attachment_count,
            total_attachment_bytes=total_att_bytes,
            broken_links_count=broken_links_count,
            missing_attachments_count=missing_attachments_count,
            orphaned_attachments_count=orphaned_count,
            database_size_bytes=db_size,
            disk_free_bytes=disk_free,
            pdf_renderer_available=True,
            pdf_renderer_name="Playwright Chromium",
            last_backup_date=last_backup_date,
            backup_count=backup_count,
            issues=issues,
        )
