"""Backup and Restore models."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class BackupFileInfo(BaseModel):
    path: str
    size_bytes: int
    sha256: str


class BackupManifest(BaseModel):
    backup_format_version: str = "1.0.0"
    app_version: str = "1.0.0"
    vault_name: str
    created_at: str
    note_count: int
    attachment_count: int
    total_size_bytes: int
    files: List[BackupFileInfo] = Field(default_factory=list)


class BackupSummary(BaseModel):
    filename: str
    created_at: str
    file_size_bytes: int
    note_count: int
    attachment_count: int
    is_valid: bool = True
    manifest: Optional[BackupManifest] = None


class RestoreRequest(BaseModel):
    backup_filename: str
    target_directory: Optional[str] = None  # If empty and in_place=True, restores in-place with staging
    in_place: bool = False
    create_pre_restore_backup: bool = True
