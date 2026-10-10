"""Backup and Restore API endpoints."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services
from app.models.backup import BackupSummary, RestoreRequest

router = APIRouter(prefix="/backups", tags=["Backups"])


class CreateBackupPayload(BaseModel):
    custom_name: Optional[str] = None


@router.get("", response_model=List[BackupSummary])
def list_backups(services: ServiceContainer = Depends(get_services)):
    """List all available vault backups with manifest details."""
    return services.backup_service.list_backups()


@router.post("", response_model=BackupSummary, status_code=status.HTTP_201_CREATED)
def create_backup(
    payload: CreateBackupPayload,
    services: ServiceContainer = Depends(get_services),
):
    """Create a verified timestamped ZIP backup of the vault."""
    try:
        return services.backup_service.create_backup(payload.custom_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
def restore_backup(
    req: RestoreRequest,
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Safely restore a backup into a new directory or staged in-place."""
    try:
        return services.backup_service.restore_backup(req)
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{filename}", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup(filename: str, services: ServiceContainer = Depends(get_services)):
    """Delete a backup archive."""
    services.backup_service.delete_backup(filename)
    return None
