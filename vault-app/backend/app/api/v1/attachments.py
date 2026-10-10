"""Attachments API endpoints."""

from pathlib import Path
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
    return att_info


@router.get("/file/{file_path:path}")
def serve_attachment(file_path: str, services: ServiceContainer = Depends(get_services)):
    """Serve attachment file safely."""
    abs_path = (services.vault.root_path / file_path).resolve()
    if not services.vault.is_safe_path(abs_path) or not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file not found.")

    return FileResponse(path=str(abs_path))


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
