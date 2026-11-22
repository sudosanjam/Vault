"""Attachments API endpoints."""

import os
from pathlib import Path
import subprocess
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services

router = APIRouter(prefix="/attachments", tags=["Attachments"])


class CleanupOrphansPayload(BaseModel):
    orphaned_paths: List[str]


@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Upload a file attachment with collision-resistant storage."""
    file_bytes = await file.read()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing.")

    att_info = services.att_mgr.save_attachment(file.filename, file_bytes)
    # Add direct preview/fetch URL
    att_info["url"] = f"/api/v1/attachments/file/{att_info['relative_path']}"
    return att_info


@router.get("/file/{file_path:path}")
def serve_attachment(file_path: str, services: ServiceContainer = Depends(get_services)):
    """Serve attachment file safely."""
    abs_path = (services.vault.root_path / file_path).resolve()
    if not services.vault.is_safe_path(abs_path) or not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file not found.")

    return FileResponse(path=str(abs_path))


@router.get("/list")
def list_attachments(services: ServiceContainer = Depends(get_services)) -> List[Dict[str, Any]]:
    """List all saved media and image attachments in the active vault."""
    results = []
    images_dir = services.vault.attachments_dir / "images"
    if images_dir.exists():
        for p in images_dir.iterdir():
            if p.is_file() and not p.name.startswith("_") and not p.name.startswith("."):
                stat = p.stat()
                rel_path = f"attachments/images/{p.name}"
                results.append({
                    "name": p.name,
                    "relative_path": rel_path,
                    "url": f"/api/v1/attachments/file/{rel_path}",
                    "size_bytes": stat.st_size,
                    "modified_at": stat.st_mtime,
                })
    # Sort newest first
    results.sort(key=lambda x: x["modified_at"], reverse=True)
    return results


@router.post("/open-folder")
def open_attachments_folder(services: ServiceContainer = Depends(get_services)) -> Dict[str, Any]:
    """Open attachments/images directory on host machine in File Explorer / Finder."""
    target_dir = services.vault.attachments_dir / "images"
    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        if os.name == "nt":
            os.startfile(str(target_dir))
        elif os.uname().sysname == "Darwin":
            subprocess.run(["open", str(target_dir)], check=False)
        else:
            subprocess.run(["xdg-open", str(target_dir)], check=False)
        return {"status": "opened", "path": str(target_dir)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")


@router.get("/orphans")
def list_orphaned_attachments(services: ServiceContainer = Depends(get_services)) -> List[Dict[str, Any]]:
    """List attachments on disk not referenced by any note markdown."""
    with services.db.get_connection() as conn:
        cursor = conn.execute("SELECT file_path FROM attachments")
        referenced = {r["file_path"] for r in cursor.fetchall()}

    return services.att_mgr.find_orphaned_attachments(referenced)


@router.post("/cleanup")
def cleanup_orphaned_attachments(
    payload: CleanupOrphansPayload,
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Delete confirmed orphaned attachments."""
    deleted = services.att_mgr.cleanup_orphans(payload.orphaned_paths)
    return {"deleted_count": len(deleted), "deleted_files": deleted}
