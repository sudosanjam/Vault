"""System health, diagnostics, configuration, and reindex API endpoints."""

from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services
from app.models.diagnostics import SystemDiagnostics

router = APIRouter(prefix="/system", tags=["System"])


class ReconfigureVaultPayload(BaseModel):
    vault_path: str


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
