"""Exports API endpoints."""

from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.api.deps import ServiceContainer, get_services
from app.models.export import ExportPreview, ExportRequest, ExportResult

router = APIRouter(prefix="/exports", tags=["Exports"])


@router.post("/preview", response_model=ExportPreview)
def preview_export(req: ExportRequest, services: ServiceContainer = Depends(get_services)):
    """Preview export scope, note count, attachments count, and filename before generating."""
    return services.export_service.preview_export(req)


@router.post("/generate", response_model=ExportResult)
def generate_export(req: ExportRequest, services: ServiceContainer = Depends(get_services)):
    """Generate export in PDF, HTML, Markdown, JSON, or ZIP format."""
    try:
        return services.export_service.execute_export(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
def download_export(filename: str, services: ServiceContainer = Depends(get_services)):
    """Download generated export file."""
    file_path = (services.vault.exports_dir / filename).resolve()
    if not services.vault.is_safe_path(file_path) or not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found.")

    return FileResponse(path=str(file_path), filename=filename)
