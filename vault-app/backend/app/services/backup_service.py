"""Backup and Restore service with SHA-256 manifests, staged restoration, and traversal protection."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Tuple
import zipfile

from app.core.vault import VaultManager
from app.db.indexer import Indexer
from app.models.backup import BackupFileInfo, BackupManifest, BackupSummary, RestoreRequest


def sha256_file(file_path: Path) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class BackupService:
    def __init__(self, vault_mgr: VaultManager, indexer: Indexer):
        self.vault = vault_mgr
        self.indexer = indexer

    def create_backup(self, custom_name: Optional[str] = None) -> BackupSummary:
        """
        Create a verified timestamped ZIP backup of the vault.
        Includes all notes, attachments, metadata, .vault-config.yaml, and manifest.json with checksums.
        """
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%Y-%m-%d_%H%M%S")
        
        if custom_name:
            clean_name = "".join(c for c in custom_name if c.isalnum() or c in "-_")
            archive_filename = f"Vault_Backup_{timestamp_str}_{clean_name}.zip"
        else:
            archive_filename = f"Vault_Backup_{timestamp_str}.zip"

        archive_path = self.vault.backups_dir / archive_filename
        
        # Collect files to include (exclude backups_dir itself and cache_dir)
        files_to_backup: List[Tuple[Path, str]] = []
        
        # 1. Config
        if self.vault.config_path.exists():
            files_to_backup.append((self.vault.config_path, ".vault-config.yaml"))

        # 2. Nodes
        if self.vault.nodes_dir.exists():
            for p in self.vault.nodes_dir.glob("*.md"):
                if p.is_file():
                    files_to_backup.append((p, f"nodes/{p.name}"))

        # 3. Attachments
        if self.vault.attachments_dir.exists():
            for p in self.vault.attachments_dir.rglob("*"):
                if p.is_file():
                    rel = p.relative_to(self.vault.root_path).as_posix()
                    files_to_backup.append((p, rel))

        # 4. Metadata
        if self.vault.metadata_dir.exists():
            for p in self.vault.metadata_dir.glob("*.json"):
                if p.is_file():
                    files_to_backup.append((p, f"metadata/{p.name}"))

        # Build manifest
        manifest_files: List[BackupFileInfo] = []
        total_size = 0
        note_count = 0
        att_count = 0

        for src_path, arc_name in files_to_backup:
            size = src_path.stat().st_size
            total_size += size
            checksum = sha256_file(src_path)
            manifest_files.append(BackupFileInfo(path=arc_name, size_bytes=size, sha256=checksum))
            
            if arc_name.startswith("nodes/"):
                note_count += 1
            elif arc_name.startswith("attachments/"):
                att_count += 1

        vault_cfg = self.vault.get_config()
        manifest = BackupManifest(
            backup_format_version="1.0.0",
            app_version="1.0.0",
            vault_name=vault_cfg.get("vault_name", "Vault"),
            created_at=now.isoformat(),
            note_count=note_count,
            attachment_count=att_count,
            total_size_bytes=total_size,
            files=manifest_files,
        )

        # Write to temporary file first, then move to final destination
        temp_zip = archive_path.with_suffix(".tmp.zip")
        with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            # Write manifest.json
            zf.writestr("manifest.json", json.dumps(manifest.model_dump(), indent=2))
            
            # Write all files
            for src_path, arc_name in files_to_backup:
                zf.write(src_path, arc_name)

        # Atomically move temp zip to final destination
        if archive_path.exists():
            archive_path.unlink()
        temp_zip.rename(archive_path)

        # Verify archive integrity immediately
        self.verify_backup_archive(archive_path)

        # Enforce retention policy
        self._enforce_retention()

        return BackupSummary(
            filename=archive_filename,
            created_at=now.isoformat(),
            file_size_bytes=archive_path.stat().st_size,
            note_count=note_count,
            attachment_count=att_count,
            is_valid=True,
            manifest=manifest,
        )

    def list_backups(self) -> List[BackupSummary]:
        """List all available backup archives with their validated manifests."""
        summaries = []
        if not self.vault.backups_dir.exists():
            return []

        for p in sorted(self.vault.backups_dir.glob("*.zip"), reverse=True):
            if p.name.endswith(".tmp.zip"):
                continue
            
            try:
                manifest, is_valid = self.inspect_backup_archive(p)
                stat = p.stat()
                summaries.append(
                    BackupSummary(
                        filename=p.name,
                        created_at=manifest.created_at if manifest else datetime.fromtimestamp(stat.st_ctime, timezone.utc).isoformat(),
                        file_size_bytes=stat.st_size,
                        note_count=manifest.note_count if manifest else 0,
                        attachment_count=manifest.attachment_count if manifest else 0,
                        is_valid=is_valid,
                        manifest=manifest,
                    )
                )
            except Exception:
                summaries.append(
                    BackupSummary(
                        filename=p.name,
                        created_at="",
                        file_size_bytes=p.stat().st_size,
                        note_count=0,
                        attachment_count=0,
                        is_valid=False,
                        manifest=None,
                    )
                )
        return summaries

    def inspect_backup_archive(self, archive_path: Path) -> Tuple[Optional[BackupManifest], bool]:
        """Inspect and validate backup manifest without extracting."""
        if not archive_path.exists():
            return None, False
        
        try:
            with zipfile.ZipFile(archive_path, "r") as zf:
                if "manifest.json" not in zf.namelist():
                    return None, False
                manifest_data = json.loads(zf.read("manifest.json").decode("utf-8"))
                manifest = BackupManifest(**manifest_data)
                return manifest, True
        except Exception:
            return None, False

    def verify_backup_archive(self, archive_path: Path) -> bool:
        """Thoroughly test archive zip integrity and SHA-256 checksums."""
        manifest, is_valid = self.inspect_backup_archive(archive_path)
        if not is_valid or not manifest:
            raise ValueError("Corrupted or invalid backup: missing or unreadable manifest.json.")

        with zipfile.ZipFile(archive_path, "r") as zf:
            # Check zip file integrity
            bad_file = zf.testzip()
            if bad_file:
                raise ValueError(f"Corrupted zip entry found: {bad_file}")

            # Verify checksums for each file
            for finfo in manifest.files:
                if finfo.path not in zf.namelist():
                    raise ValueError(f"Missing file in archive: {finfo.path}")
                content = zf.read(finfo.path)
                checksum = hashlib.sha256(content).hexdigest()
                if checksum != finfo.sha256:
                    raise ValueError(f"Checksum mismatch for {finfo.path}: expected {finfo.sha256}, got {checksum}")

        return True

    def restore_backup(self, req: RestoreRequest) -> Dict[str, Any]:
        """
        Safely restore a backup archive using a staging directory.
        Protects against path traversal attacks.
        """
        archive_path = self.vault.backups_dir / req.backup_filename
        if not archive_path.exists():
            raise FileNotFoundError(f"Backup archive '{req.backup_filename}' not found.")

        # 1. Verify archive
        self.verify_backup_archive(archive_path)

        # 2. Determine target vault directory
        if req.target_directory:
            target_vault = Path(req.target_directory).resolve()
        elif req.in_place:
            target_vault = self.vault.root_path
            # Create a pre-restore backup first if requested
            if req.create_pre_restore_backup:
                self.create_backup("pre_restore")
        else:
            raise ValueError("Must specify target_directory or enable in_place restoration.")

        # 3. Extract to staging directory first
        with tempfile.TemporaryDirectory(prefix="vault_restore_stage_") as stage_dir_str:
            stage_dir = Path(stage_dir_str)
            
            with zipfile.ZipFile(archive_path, "r") as zf:
                for member in zf.infolist():
                    target_file = stage_dir / member.filename
                    
                    # Prevent directory traversal attacks
                    try:
                        target_file.resolve().relative_to(stage_dir.resolve())
                    except ValueError:
                        raise PermissionError(f"Directory traversal attack detected in zip member: {member.filename}")
                    
                    zf.extract(member, stage_dir)

            # 4. Copy validated staging files to destination
            target_vault.mkdir(parents=True, exist_ok=True)
            for item in stage_dir.iterdir():
                if item.name == "manifest.json":
                    continue
                dest = target_vault / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                else:
                    shutil.copy2(item, dest)

        # 5. Rebuild derived index on target vault
        if target_vault == self.vault.root_path:
            self.indexer.rebuild_full_index()

        return {
            "status": "success",
            "message": f"Successfully restored '{req.backup_filename}' to {target_vault}",
            "target_vault": str(target_vault),
        }

    def delete_backup(self, filename: str) -> None:
        """Delete a backup archive."""
        archive_path = self.vault.backups_dir / filename
        if archive_path.exists() and archive_path.name.endswith(".zip"):
            archive_path.unlink()

    def _enforce_retention(self) -> None:
        """Prune oldest backups when count exceeds configured retention."""
        cfg = self.vault.get_config()
        limit = cfg.get("backup_retention_count", 10)
        
        all_backups = sorted(self.vault.backups_dir.glob("*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
        if len(all_backups) > limit:
            for old in all_backups[limit:]:
                try:
                    old.unlink()
                except Exception:
                    pass
