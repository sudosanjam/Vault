"""LAN Sync API endpoints — allows Android/Termux clients to pull Vault notes over local network."""

import hashlib
import os
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services

router = APIRouter(prefix="/sync", tags=["Sync"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_lan_ip() -> str:
    """Auto-detect the LAN IP address of this machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _md5_file(path: Path) -> str:
    """Return hex MD5 of file contents."""
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


def _mtime_iso(path: Path) -> str:
    """Return file modification time as ISO 8601 UTC string."""
    try:
        ts = path.stat().st_mtime
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        return ""


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SyncConfigPayload(BaseModel):
    lan_enabled: bool = False
    lan_port: int = 8000


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/info")
def get_sync_info(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Return server identity and LAN sync configuration for connecting clients."""
    cfg = services.vault.get_config()
    lan_enabled: bool = cfg.get("lan_enabled", False)
    lan_port: int = int(cfg.get("lan_port", 8000))
    vault_name = services.vault.root_path.name

    return {
        "vault_name": vault_name,
        "lan_enabled": lan_enabled,
        "server_ip": _get_lan_ip(),
        "port": lan_port,
        "vault_path": str(services.vault.root_path),
        "app": "Vault",
    }


@router.put("/config")
def update_sync_config(
    payload: SyncConfigPayload,
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Persist LAN sync settings to vault config file."""
    current = services.vault.get_config()
    current["lan_enabled"] = payload.lan_enabled
    current["lan_port"] = payload.lan_port
    services.vault.save_config(current)
    return {
        "status": "saved",
        "lan_enabled": payload.lan_enabled,
        "lan_port": payload.lan_port,
        "message": "Restart Vault for network binding changes to take effect." if payload.lan_enabled else "LAN sync disabled.",
    }


@router.get("/manifest")
def get_sync_manifest(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """
    Return a full sync manifest: list of all notes and attachments with hashes.
    Android/Termux clients use this to diff what has changed and fetch only new/updated items.
    """
    notes_dir = services.vault.root_path / "nodes"
    images_dir = services.vault.attachments_dir / "images"

    # ── Notes ──
    notes_manifest: List[Dict[str, Any]] = []
    if notes_dir.exists():
        for md_file in sorted(notes_dir.glob("*.md")):
            note_id = md_file.stem
            notes_manifest.append({
                "id": note_id,
                "filename": md_file.name,
                "file_hash": _md5_file(md_file),
                "modified_at": _mtime_iso(md_file),
                "size_bytes": md_file.stat().st_size if md_file.exists() else 0,
            })

    # ── Attachments ──
    attachments_manifest: List[Dict[str, Any]] = []
    if images_dir.exists():
        for img_file in sorted(images_dir.iterdir()):
            if img_file.is_file() and not img_file.name.startswith("."):
                rel_path = f"attachments/images/{img_file.name}"
                attachments_manifest.append({
                    "name": img_file.name,
                    "relative_path": rel_path,
                    "file_hash": _md5_file(img_file),
                    "modified_at": _mtime_iso(img_file),
                    "size_bytes": img_file.stat().st_size,
                })

    return {
        "vault_name": services.vault.root_path.name,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "notes_count": len(notes_manifest),
        "attachments_count": len(attachments_manifest),
        "notes": notes_manifest,
        "attachments": attachments_manifest,
    }


@router.get("/notes/{note_id}/raw", response_class=PlainTextResponse)
def get_note_raw(
    note_id: str,
    services: ServiceContainer = Depends(get_services),
) -> str:
    """Return raw markdown content of a note (including YAML frontmatter) as plain text."""
    notes_dir = services.vault.root_path / "nodes"
    # Sanitize note_id to prevent path traversal
    safe_id = Path(note_id).name
    md_file = notes_dir / f"{safe_id}.md"

    if not md_file.exists() or not md_file.is_file():
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found.")

    try:
        return md_file.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read note: {e}")
