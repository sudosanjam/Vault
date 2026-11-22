"""System health, diagnostics, configuration, directory browsing, and reindex API endpoints."""

import os
from pathlib import Path
import string
import subprocess
from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services
from app.models.diagnostics import SystemDiagnostics

router = APIRouter(prefix="/system", tags=["System"])


class ReconfigureVaultPayload(BaseModel):
    vault_path: str


class CreateVaultPayload(BaseModel):
    parent_path: str
    name: str


class ConfigUpdatePayload(BaseModel):
    config: Dict[str, Any]


@router.get("/diagnostics", response_model=SystemDiagnostics)
def get_diagnostics(services: ServiceContainer = Depends(get_services)):
    """Run full system diagnostics and data integrity health check."""
    return services.diagnostics_service.run_diagnostics()


@router.post("/reindex")
def rebuild_index(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Reconstruct derived SQLite index from all source markdown files."""
    result = services.indexer.rebuild_full_index()
    return {
        "status": "success",
        "message": "Index rebuilt successfully",
        **result,
    }


@router.get("/config")
def get_config(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Get active vault configuration."""
    return {
        "vault_path": str(services.vault.root_path),
        "config": services.vault.get_config(),
    }


@router.put("/config")
def update_config(
    payload: ConfigUpdatePayload,
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Update vault configuration."""
    services.vault.save_config(payload.config)
    return {"status": "saved", "config": payload.config}


@router.post("/switch-vault")
def switch_vault(payload: ReconfigureVaultPayload):
    """Switch active vault directory without restarting server."""
    new_path = Path(payload.vault_path).resolve()
    if not new_path.exists():
        new_path.mkdir(parents=True, exist_ok=True)
    
    new_container = ServiceContainer.reconfigure_vault_path(new_path)
    new_container.indexer.rebuild_full_index()
    return {
        "status": "success",
        "vault_path": str(new_path),
    }


@router.get("/browse-folders")
def browse_folders(
    path: Optional[str] = Query(None, description="Directory path to inspect"),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Browse directory tree on the host machine to select or explore vault folders."""
    if not path or not path.strip():
        curr_dir = services.vault.root_path.parent
    else:
        curr_dir = Path(path).resolve()
    
    if not curr_dir.exists() or not curr_dir.is_dir():
        curr_dir = services.vault.root_path.parent

    # Detect available disk drives on Windows
    drives = []
    if os.name == "nt":
        for letter in string.ascii_uppercase:
            drive_root = f"{letter}:\\"
            if os.path.exists(drive_root):
                drives.append(drive_root)

    folders = []
    try:
        for entry in os.scandir(curr_dir):
            if entry.is_dir(follow_symlinks=False):
                # Ignore hidden directories like .git or system folders, but keep .vault-cache if needed
                if entry.name.startswith(".") and entry.name != ".vault-cache":
                    continue
                if entry.name.startswith("$") or entry.name in ["System Volume Information"]:
                    continue
                is_vault = (
                    (Path(entry.path) / ".vault-cache").exists()
                    or (Path(entry.path) / "nodes").exists()
                    or (Path(entry.path) / ".vault-config.yaml").exists()
                )
                folders.append({
                    "name": entry.name,
                    "path": str(Path(entry.path).resolve()),
                    "is_vault": is_vault,
                })
    except (PermissionError, OSError):
        pass

    folders.sort(key=lambda x: (not x["is_vault"], x["name"].lower()))

    parent_path = str(curr_dir.parent) if curr_dir.parent != curr_dir else None
    is_current_vault = (
        (curr_dir / ".vault-cache").exists()
        or (curr_dir / "nodes").exists()
        or (curr_dir / ".vault-config.yaml").exists()
    )

    return {
        "current_path": str(curr_dir),
        "parent_path": parent_path,
        "is_current_vault": is_current_vault,
        "active_vault_path": str(services.vault.root_path),
        "folders": folders,
        "drives": drives,
    }


@router.post("/create-vault")
def create_vault(payload: CreateVaultPayload):
    """Create a new vault directory inside parent_path and switch to it."""
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Vault folder name cannot be empty.")
    
    parent = Path(payload.parent_path).resolve()
    if not parent.exists():
        parent.mkdir(parents=True, exist_ok=True)
    
    new_vault_dir = parent / clean_name
    new_vault_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize and switch
    new_container = ServiceContainer.reconfigure_vault_path(new_vault_dir)
    new_container.indexer.rebuild_full_index()
    return {
        "status": "created",
        "vault_path": str(new_vault_dir),
    }


@router.get("/check-updates")
async def check_updates(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Check GitHub repository for updates and release versions."""
    vault_cfg = services.vault.get_config()
    auto_check = vault_cfg.get("auto_check_updates", True)
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent

    local_commit = "unknown"
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=False,
        )
        if res.returncode == 0:
            local_commit = res.stdout.strip()
    except Exception:
        pass

    remote_info = None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://api.github.com/repos/sudosanjam/Vault/commits/main",
                headers={
                    "User-Agent": "Vault-Application-Updater",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                latest_sha = data.get("sha", "")
                commit_msg = data.get("commit", {}).get("message", "").split("\n")[0]
                commit_date = data.get("commit", {}).get("committer", {}).get("date", "")
                update_available = (
                    local_commit != "unknown"
                    and bool(latest_sha)
                    and local_commit != latest_sha
                )
                remote_info = {
                    "update_available": update_available,
                    "current_commit": local_commit[:7] if local_commit != "unknown" else "v1.0.0",
                    "latest_commit": latest_sha[:7] if latest_sha else "latest",
                    "latest_sha": latest_sha,
                    "commit_message": commit_msg,
                    "commit_date": commit_date,
                    "repo_url": "https://github.com/sudosanjam/Vault",
                    "auto_check_updates": auto_check,
                }
    except Exception:
        pass

    if remote_info:
        return remote_info

    return {
        "update_available": False,
        "current_commit": local_commit[:7] if local_commit != "unknown" else "v1.0.0",
        "latest_commit": local_commit[:7] if local_commit != "unknown" else "v1.0.0",
        "commit_message": "Vault is running the latest local build.",
        "commit_date": "",
        "repo_url": "https://github.com/sudosanjam/Vault",
        "auto_check_updates": auto_check,
    }


@router.post("/apply-update")
def apply_update(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Pull the latest updates from GitHub."""
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    try:
        pull_res = subprocess.run(
            ["git", "pull", "origin", "main"],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=False,
        )
        if pull_res.returncode == 0:
            return {
                "status": "success",
                "message": "Vault updated successfully from GitHub! Please restart the application.",
                "output": pull_res.stdout,
            }
        else:
            return {
                "status": "error",
                "message": f"Update failed: {pull_res.stderr or pull_res.stdout}",
                "output": pull_res.stderr,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update Vault: {str(e)}")

