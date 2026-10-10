"""Attachment management, collision-resistant storage, and orphan detection."""

import hashlib
import mimetypes
from pathlib import Path
import re
import shutil
from typing import Any, Dict, List, Optional, Set, Tuple
from app.core.vault import VaultManager


# Categorize file extensions into subfolders
EXT_MAP = {
    # Images
    ".png": "images",
    ".jpg": "images",
    ".jpeg": "images",
    ".gif": "images",
    ".svg": "images",
    ".webp": "images",
    ".bmp": "images",
    ".ico": "images",
    # Documents
    ".pdf": "documents",
    ".docx": "documents",
    ".doc": "documents",
    ".xlsx": "documents",
    ".xls": "documents",
    ".pptx": "documents",
    ".ppt": "documents",
    ".txt": "documents",
    ".md": "documents",
    ".csv": "documents",
    ".json": "documents",
    ".yaml": "documents",
    ".yml": "documents",
    ".xml": "documents",
    ".zip": "documents",
    ".tar": "documents",
    ".gz": "documents",
}


def sanitize_attachment_name(filename: str) -> str:
    clean = re.sub(r'[\\/*?:"<>|]', "", filename)
    clean = re.sub(r"\s+", "_", clean.strip())
    return clean or "attachment"


class AttachmentManager:
    def __init__(self, vault_mgr: VaultManager):
        self.vault = vault_mgr

    def save_attachment(self, filename: str, file_bytes: bytes) -> Dict[str, Any]:
        """
        Store an attachment with collision-resistant hashed naming.
        Returns metadata including relative path for markdown embedding.
        """
        sha256 = hashlib.sha256(file_bytes).hexdigest()
        short_hash = sha256[:10]
        
        orig_clean = sanitize_attachment_name(filename)
        ext = Path(orig_clean).suffix.lower()
        subfolder = EXT_MAP.get(ext, "other")
        
        stem = Path(orig_clean).stem
        target_filename = f"{short_hash}_{stem}{ext}"
        
        rel_path = f"attachments/{subfolder}/{target_filename}"
        abs_path = self.vault.root_path / rel_path
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(abs_path, "wb") as f:
            f.write(file_bytes)
            
        mime_type, _ = mimetypes.guess_type(orig_clean)
        if not mime_type:
            mime_type = "application/octet-stream"

        return {
            "id": f"att_{short_hash}_{stem}",
            "original_name": orig_clean,
            "relative_path": rel_path.replace("\\", "/"),
            "file_size": len(file_bytes),
            "mime_type": mime_type,
            "sha256": sha256,
            "subfolder": subfolder,
        }

    def get_all_attachment_files(self) -> List[Path]:
        """List all attachment files currently in the vault attachments directory."""
        results = []
        if self.vault.attachments_dir.exists():
            for p in self.vault.attachments_dir.rglob("*"):
                if p.is_file():
                    results.append(p)
        return results

    def find_orphaned_attachments(self, referenced_paths: Set[str]) -> List[Dict[str, Any]]:
        """
        Find attachments on disk that are not referenced in any note markdown.
        """
        orphans = []
        norm_refs = {p.replace("\\", "/").lower() for p in referenced_paths}
        
        for file_path in self.get_all_attachment_files():
            try:
                rel = file_path.relative_to(self.vault.root_path).as_posix().lower()
                if rel not in norm_refs:
                    stat = file_path.stat()
                    orphans.append({
                        "file_path": file_path.relative_to(self.vault.root_path).as_posix(),
                        "file_size": stat.st_size,
                        "modified_at": stat.st_mtime,
                    })
            except Exception:
                continue
        return orphans

    def cleanup_orphans(self, orphaned_rel_paths: List[str]) -> List[str]:
        """Delete specified orphaned attachment files safely."""
        deleted = []
        for rel in orphaned_rel_paths:
            p = (self.vault.root_path / rel).resolve()
            if self.vault.is_safe_path(p) and p.exists() and p.is_file():
                p.unlink()
                deleted.append(rel)
        return deleted
