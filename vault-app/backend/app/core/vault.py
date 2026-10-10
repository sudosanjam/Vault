"""Vault filesystem manager, atomic writes, safety checks, and configuration."""

import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Dict, Optional
import yaml
from app.config import get_default_vault_path


CONFIG_FILE_NAME = ".vault-config.yaml"
LAYOUTS_FILE_NAME = "graph-layouts.json"


def sanitize_filename(title: str, max_length: int = 80) -> str:
    """Sanitize note title for safe filesystem naming while preserving readability."""
    clean = re.sub(r'[\\/*?:"<>|]', "", title)
    clean = re.sub(r"\s+", "-", clean.strip().lower())
    clean = re.sub(r"-+", "-", clean)
    clean = clean.strip("-")
    if not clean:
        clean = "untitled-note"
    return clean[:max_length]


class VaultManager:
    def __init__(self, root_path: Optional[Path] = None):
        self.root_path = Path(root_path or get_default_vault_path()).resolve()
        self.ensure_structure()

    @property
    def nodes_dir(self) -> Path:
        return self.root_path / "nodes"

    @property
    def attachments_dir(self) -> Path:
        return self.root_path / "attachments"

    @property
    def metadata_dir(self) -> Path:
        return self.root_path / "metadata"

    @property
    def exports_dir(self) -> Path:
        return self.root_path / "exports"

    @property
    def backups_dir(self) -> Path:
        return self.root_path / "backups"

    @property
    def cache_dir(self) -> Path:
        return self.root_path / ".vault-cache"

    @property
    def db_path(self) -> Path:
        return self.cache_dir / "vault-index.db"

    @property
    def config_path(self) -> Path:
        return self.root_path / CONFIG_FILE_NAME

    def ensure_structure(self) -> None:
        """Create standard Vault directory hierarchy if it does not exist."""
        self.root_path.mkdir(parents=True, exist_ok=True)
        self.nodes_dir.mkdir(parents=True, exist_ok=True)
        (self.attachments_dir / "images").mkdir(parents=True, exist_ok=True)
        (self.attachments_dir / "documents").mkdir(parents=True, exist_ok=True)
        (self.attachments_dir / "other").mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
        self.backups_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Create default config if missing
        if not self.config_path.exists():
            default_config = {
                "vault_version": "1.0.0",
                "vault_name": "Vault",
                "created_at": "2026-10-10T21:57:38Z",
                "default_note_type": "concept",
                "autosave_debounce_ms": 2000,
                "backup_retention_count": 10,
                "auto_backup_on_startup": False,
            }
            self.save_config(default_config)

    def is_safe_path(self, target_path: Path) -> bool:
        """Verify that target_path is within the vault root directory (prevent traversal)."""
        try:
            resolved = target_path.resolve()
            return self.root_path in resolved.parents or resolved == self.root_path
        except Exception:
            return False

    def atomic_write(self, target_path: Path, content: str) -> None:
        """Write content to temporary file in metadata/.tmp and atomically replace destination."""
        if not self.is_safe_path(target_path):
            raise PermissionError(f"Access denied: path {target_path} is outside the vault boundary.")
        
        target_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_dir = self.metadata_dir / ".tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        
        with tempfile.NamedTemporaryFile("w", dir=str(tmp_dir), delete=False, encoding="utf-8") as tf:
            tf.write(content)
            temp_name = tf.name

        os.replace(temp_name, str(target_path))

    def read_file(self, target_path: Path) -> str:
        """Safely read text file within the vault boundary."""
        if not self.is_safe_path(target_path):
            raise PermissionError(f"Access denied: path {target_path} is outside the vault boundary.")
        with open(target_path, "r", encoding="utf-8") as f:
            return f.read()

    def delete_file(self, target_path: Path) -> None:
        """Safely delete file within vault."""
        if not self.is_safe_path(target_path):
            raise PermissionError(f"Access denied: path {target_path} is outside the vault boundary.")
        if target_path.exists():
            target_path.unlink()

    def get_config(self) -> Dict[str, Any]:
        """Read .vault-config.yaml."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return yaml.safe_load(f) or {}
            except Exception:
                return {}
        return {}

    def save_config(self, config_data: Dict[str, Any]) -> None:
        """Save .vault-config.yaml."""
        yaml_content = yaml.dump(config_data, sort_keys=False, allow_unicode=True)
        self.atomic_write(self.config_path, yaml_content)

    def get_graph_layouts(self) -> Dict[str, Any]:
        """Load saved graph node layout positions."""
        layout_file = self.metadata_dir / LAYOUTS_FILE_NAME
        if layout_file.exists():
            try:
                with open(layout_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_graph_layouts(self, layouts: Dict[str, Any]) -> None:
        """Save graph node layout positions."""
        layout_file = self.metadata_dir / LAYOUTS_FILE_NAME
        self.atomic_write(layout_file, json.dumps(layouts, indent=2))
