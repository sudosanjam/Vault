"""Diagnostics models for system health and validation checks."""

from typing import List, Optional
from pydantic import BaseModel, Field


class DiagnosticItem(BaseModel):
    status: str = "ok"  # ok, info, warn, error
    category: str  # storage, indexing, links, attachments, backup, pdf
    title: str
    message: str
    details: Optional[str] = None


class SystemDiagnostics(BaseModel):
    app_name: str = "Vault"
    app_version: str = "1.0.0"
    vault_path: str
    is_vault_accessible: bool
    is_vault_writable: bool
    note_count: int = 0
    attachment_count: int = 0
    total_attachment_bytes: int = 0
    broken_links_count: int = 0
    missing_attachments_count: int = 0
    orphaned_attachments_count: int = 0
    database_size_bytes: int = 0
    disk_free_bytes: int = 0
    pdf_renderer_available: bool = True
    pdf_renderer_name: str = "Playwright Chromium"
    last_backup_date: Optional[str] = None
    backup_count: int = 0
    issues: List[DiagnosticItem] = Field(default_factory=list)
