"""Import service for markdown files, directories, ZIP packages, and backup recovery."""

import json
from pathlib import Path
import shutil
import tempfile
from typing import Any, Dict, List, Optional
import uuid
import zipfile

from app.core.frontmatter import parse_note_content, serialize_note_content
from app.core.vault import VaultManager, sanitize_filename
from app.db.indexer import Indexer


class ImportService:
    def __init__(self, vault_mgr: VaultManager, indexer: Indexer):
        self.vault = vault_mgr
        self.indexer = indexer

    def import_markdown_file(
        self, filename: str, content_str: str, collision_policy: str = "rename"
    ) -> Dict[str, Any]:
        """
        Import a single Markdown note.
        collision_policy: 'overwrite' | 'rename' | 'skip'
        """
        default_id = f"node_{uuid.uuid4().hex[:8]}"
        default_title = Path(filename).stem.replace("-", " ").title()
        meta, body = parse_note_content(content_str, default_id, default_title)

        target_name = f"{sanitize_filename(meta.title)}.md"
        target_path = self.vault.nodes_dir / target_name

        if target_path.exists():
            if collision_policy == "skip":
                return {"status": "skipped", "file": target_name}
            elif collision_policy == "rename":
                counter = 1
                stem = target_path.stem
                while target_path.exists():
                    target_path = self.vault.nodes_dir / f"{stem}-{counter}.md"
                    counter += 1
                meta.title = f"{meta.title} ({counter})"
                meta.id = f"{meta.id}_{counter}"

        full_content = serialize_note_content(meta, body)
        self.vault.atomic_write(target_path, full_content)
        self.indexer.index_single_note(target_path)

        return {
            "status": "imported",
            "id": meta.id,
            "title": meta.title,
            "file": target_path.name,
        }

    def import_zip_package(self, zip_bytes: bytes, collision_policy: str = "rename") -> Dict[str, Any]:
        """
        Import a ZIP archive containing notes and attachments.
        """
        imported_notes = 0
        imported_attachments = 0

        with tempfile.TemporaryDirectory(prefix="vault_import_zip_") as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str)
            zip_file = tmp_dir / "import.zip"
            zip_file.write_bytes(zip_bytes)

            with zipfile.ZipFile(zip_file, "r") as zf:
                for member in zf.infolist():
                    target_path = tmp_dir / member.filename
                    # Security check: prevent traversal
                    try:
                        target_path.resolve().relative_to(tmp_dir.resolve())
                    except ValueError:
                        continue
                    zf.extract(member, tmp_dir)

            # Process notes
            for md_file in tmp_dir.rglob("*.md"):
                content = md_file.read_text(encoding="utf-8")
                res = self.import_markdown_file(md_file.name, content, collision_policy)
                if res["status"] == "imported":
                    imported_notes += 1

            # Process attachments
            for sub in ["images", "documents", "other"]:
                att_sub = tmp_dir / "attachments" / sub
                if att_sub.exists():
                    for att_file in att_sub.iterdir():
                        if att_file.is_file():
                            dest = self.vault.attachments_dir / sub / att_file.name
                            if not dest.exists():
                                shutil.copy2(att_file, dest)
                                imported_attachments += 1

        self.indexer.rebuild_full_index()
        return {
            "status": "success",
            "imported_notes": imported_notes,
            "imported_attachments": imported_attachments,
        }
