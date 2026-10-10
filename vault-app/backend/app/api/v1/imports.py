"""Imports API endpoints."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import ServiceContainer, get_services

router = APIRouter(prefix="/imports", tags=["Imports"])


@router.post("/file")
async def import_markdown_file(
    file: UploadFile = File(...),
    collision_policy: str = Form("rename"),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Import a markdown file into the vault."""
    content_bytes = await file.read()
    try:
        content_str = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding; UTF-8 expected.")

    return services.import_service.import_markdown_file(
        filename=file.filename or "imported_note.md",
        content_str=content_str,
        collision_policy=collision_policy,
    )


@router.post("/zip")
async def import_zip_package(
    file: UploadFile = File(...),
    collision_policy: str = Form("rename"),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Import notes and attachments from a ZIP package."""
    zip_bytes = await file.read()
    return services.import_service.import_zip_package(zip_bytes, collision_policy)
