"""LAN Sync API endpoints — bidirectional pull/push of Vault notes & media over local network."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import socket
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
import httpx
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services
from app.config import load_session_state, save_session_state

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


def _normalize_peer_url(url: str, default_port: int = 8000) -> str:
    """Normalize input like '192.168.1.56' or '192.168.1.56:8000' into a full HTTP URL."""
    clean = url.strip()
    if not clean:
        raise ValueError("Peer URL or IP cannot be empty.")
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = f"http://{clean}"
    # If no port is specified in http://192.168.1.x, append default port
    match = re.match(r"^https?://[a-zA-Z0-9.-]+$", clean)
    if match:
        clean = f"{clean}:{default_port}"
    return clean.rstrip("/")


def _probe_ip(ip: str, port: int = 8000) -> Optional[Dict[str, Any]]:
    """Quickly probe an IP for an active Vault server."""
    url = f"http://{ip}:{port}/health"
    try:
        with httpx.Client(timeout=0.35) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("app") == "Vault":
                    vault_name = Path(data.get("vault_path", "Vault")).name
                    return {
                        "ip": ip,
                        "port": port,
                        "url": f"http://{ip}:{port}",
                        "vault_name": vault_name,
                        "version": data.get("version", "1.0.0"),
                    }
    except Exception:
        pass
    return None


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SyncConfigPayload(BaseModel):
    lan_enabled: bool = True
    lan_port: int = 8000


class PeerSyncPayload(BaseModel):
    peer_url: str
    direction: str = "bidirectional"  # "bidirectional", "pull", "push"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/info")
def get_sync_info(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Return server identity, IP addresses, and LAN sync configuration for connecting clients."""
    cfg = services.vault.get_config()
    lan_enabled: bool = cfg.get("lan_enabled", True)
    lan_port: int = int(cfg.get("lan_port", 8000))
    vault_name = services.vault.root_path.name
    lan_ip = _get_lan_ip()

    return {
        "vault_name": vault_name,
        "lan_enabled": lan_enabled,
        "server_ip": lan_ip,
        "port": lan_port,
        "local_url": f"http://127.0.0.1:{lan_port}",
        "lan_url": f"http://{lan_ip}:{lan_port}",
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
        "message": "LAN sync settings updated successfully.",
    }


@router.get("/manifest")
def get_sync_manifest(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """
    Return a full sync manifest: list of all notes and image attachments with hashes.
    Clients use this to diff what has changed and fetch only new/updated items.
    """
    notes_dir = services.vault.root_path / "nodes"
    images_dir = services.vault.attachments_dir / "images"

    # Notes
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

    # Attachments
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
    safe_id = Path(note_id).name
    md_file = notes_dir / f"{safe_id}.md"

    if not md_file.exists() or not md_file.is_file():
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found.")

    try:
        return md_file.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read note: {e}")


@router.post("/push/note")
async def push_note(
    note_id: str = Form(...),
    content: str = Form(...),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Receive a note pushed from a peer and save it to the local vault."""
    notes_dir = services.vault.root_path / "nodes"
    notes_dir.mkdir(parents=True, exist_ok=True)

    safe_id = Path(note_id).name
    if not safe_id or safe_id.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid note_id.")

    md_file = notes_dir / f"{safe_id}.md"
    existed = md_file.exists()
    old_hash = _md5_file(md_file) if existed else ""

    md_file.write_text(content, encoding="utf-8")
    new_hash = _md5_file(md_file)

    action = "updated" if existed else "created"
    return {
        "status": "ok",
        "action": action,
        "note_id": safe_id,
        "changed": old_hash != new_hash,
    }


@router.post("/push/image")
async def push_image(
    file: UploadFile = File(...),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Receive an image pushed from a peer and save it to attachments/images."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing.")

    images_dir = services.vault.attachments_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename).name
    if not safe_name or safe_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    data = await file.read()
    local_path = images_dir / safe_name
    existed = local_path.exists()
    old_hash = _md5_file(local_path) if existed else ""
    new_hash = hashlib.md5(data).hexdigest()

    if old_hash == new_hash:
        return {"status": "ok", "action": "skipped", "filename": safe_name, "changed": False}

    local_path.write_bytes(data)
    action = "updated" if existed else "created"
    return {
        "status": "ok",
        "action": action,
        "filename": safe_name,
        "changed": True,
        "size_bytes": len(data),
    }


# ─── Peer Discovery & One-Click Trigger ───────────────────────────────────────

@router.get("/peers")
def get_peers(scan: bool = True) -> Dict[str, Any]:
    """
    Return local device IP, remembered peer URL, and perform a fast LAN subnet scan
    to detect any active Vault servers running on the same Wi-Fi.
    """
    my_ip = _get_lan_ip()
    session = load_session_state()
    remembered_peer = session.get("last_peer_url")
    last_sync_time = session.get("last_sync_time")

    discovered: List[Dict[str, Any]] = []

    # If scan is requested and we have a valid LAN IPv4 (e.g. 192.168.x.x or 10.x.x.x)
    if scan and my_ip != "127.0.0.1" and "." in my_ip:
        parts = my_ip.split(".")
        subnet = f"{parts[0]}.{parts[1]}.{parts[2]}."
        my_last_octet = int(parts[3])

        # Probe subnet IPs concurrently
        ips_to_probe = [f"{subnet}{i}" for i in range(1, 255) if i != my_last_octet]

        with ThreadPoolExecutor(max_workers=60) as executor:
            future_to_ip = {executor.submit(_probe_ip, ip, 8000): ip for ip in ips_to_probe}
            for future in as_completed(future_to_ip):
                res = future.result()
                if res:
                    discovered.append(res)

    return {
        "my_ip": my_ip,
        "my_port": 8000,
        "my_url": f"http://{my_ip}:8000",
        "remembered_peer": remembered_peer,
        "last_sync_time": last_sync_time,
        "discovered_peers": discovered,
    }


@router.post("/sync-with-peer")
async def sync_with_peer(
    payload: PeerSyncPayload,
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """
    One-click peer synchronization endpoint.
    Connects to target peer (e.g. Android phone or desktop PC), diffs notes & images,
    performs bidirectional transfer, rebuilds local SQLite index, and saves peer in session.
    """
    try:
        target_url = _normalize_peer_url(payload.peer_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 1. Connect to peer and verify health
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            health_resp = await client.get(f"{target_url}/health")
            if health_resp.status_code != 200 or health_resp.json().get("app") != "Vault":
                raise HTTPException(
                    status_code=502,
                    detail=f"Target {target_url} is not a responsive Vault server.",
                )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot reach Vault on peer at {target_url}. Ensure both devices are on the same Wi-Fi. Error: {str(e)}",
        )

    # 2. Fetch peer manifest
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            manifest_resp = await client.get(f"{target_url}/api/v1/sync/manifest")
            if manifest_resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to fetch peer sync manifest.")
            remote_manifest = manifest_resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch manifest from {target_url}: {e}")

    remote_notes = remote_manifest.get("notes", [])
    remote_attachments = remote_manifest.get("attachments", [])
    remote_note_hashes = {n["id"]: n.get("file_hash", "") for n in remote_notes}
    remote_img_hashes = {a["name"]: a.get("file_hash", "") for a in remote_attachments}

    local_notes_dir = services.vault.root_path / "nodes"
    local_images_dir = services.vault.attachments_dir / "images"
    local_notes_dir.mkdir(parents=True, exist_ok=True)
    local_images_dir.mkdir(parents=True, exist_ok=True)

    notes_pulled = 0
    images_pulled = 0
    notes_pushed = 0
    images_pushed = 0

    direction = payload.direction.lower()
    do_pull = direction in ["bidirectional", "pull"]
    do_push = direction in ["bidirectional", "push"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ── Step A: PULL (Peer -> Local) ───────────────────────────────────────
        if do_pull:
            # Pull Notes
            for r_note in remote_notes:
                note_id = r_note["id"]
                remote_hash = r_note.get("file_hash", "")
                filename = r_note.get("filename", f"{note_id}.md")
                local_file = local_notes_dir / filename

                local_hash = _md5_file(local_file) if local_file.exists() else ""
                if local_hash != remote_hash:
                    resp = await client.get(f"{target_url}/api/v1/sync/notes/{note_id}/raw")
                    if resp.status_code == 200:
                        local_file.write_text(resp.text, encoding="utf-8")
                        notes_pulled += 1

            # Pull Images
            for r_img in remote_attachments:
                name = r_img["name"]
                rel_path = r_img.get("relative_path", f"attachments/images/{name}")
                remote_hash = r_img.get("file_hash", "")
                local_img = local_images_dir / name

                local_hash = _md5_file(local_img) if local_img.exists() else ""
                if local_hash != remote_hash:
                    resp = await client.get(f"{target_url}/api/v1/attachments/file/{rel_path}")
                    if resp.status_code == 200:
                        local_img.write_bytes(resp.content)
                        images_pulled += 1

        # ── Step B: PUSH (Local -> Peer) ───────────────────────────────────────
        if do_push:
            # Push Notes
            for md_file in sorted(local_notes_dir.glob("*.md")):
                note_id = md_file.stem
                local_hash = _md5_file(md_file)
                if remote_note_hashes.get(note_id) != local_hash:
                    content = md_file.read_text(encoding="utf-8")
                    resp = await client.post(
                        f"{target_url}/api/v1/sync/push/note",
                        data={"note_id": note_id, "content": content},
                    )
                    if resp.status_code == 200:
                        notes_pushed += 1

            # Push Images
            for img_file in sorted(local_images_dir.iterdir()):
                if img_file.is_file() and not img_file.name.startswith("."):
                    local_hash = _md5_file(img_file)
                    if remote_img_hashes.get(img_file.name) != local_hash:
                        data = img_file.read_bytes()
                        resp = await client.post(
                            f"{target_url}/api/v1/sync/push/image",
                            files={"file": (img_file.name, data, "application/octet-stream")},
                        )
                        if resp.status_code == 200:
                            images_pushed += 1

    # 3. Rebuild local SQLite index if any notes or images changed
    total_changes = notes_pulled + images_pulled + notes_pushed + images_pushed
    if notes_pulled > 0 or images_pulled > 0:
        services.indexer.rebuild_full_index()

    # 4. Update session state
    now_iso = datetime.now(tz=timezone.utc).isoformat()
    save_session_state({
        "last_peer_url": target_url,
        "last_sync_time": now_iso,
    })

    return {
        "status": "success",
        "peer_url": target_url,
        "peer_vault_name": remote_manifest.get("vault_name", "Vault"),
        "direction": direction,
        "notes_pulled": notes_pulled,
        "notes_pushed": notes_pushed,
        "images_pulled": images_pulled,
        "images_pushed": images_pushed,
        "total_synced": total_changes,
        "synced_at": now_iso,
        "message": f"Successfully synced {notes_pulled + notes_pushed} notes and {images_pulled + images_pushed} images.",
    }
