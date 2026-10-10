"""Main FastAPI application entrypoint for Vault."""

from contextlib import asynccontextmanager
from pathlib import Path
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.deps import ServiceContainer
from app.api.v1.api import api_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize service container & check index
    container = ServiceContainer.get_instance()
    vault_cfg = container.vault.get_config()
    
    # Auto backup on startup if enabled
    if vault_cfg.get("auto_backup_on_startup", False):
        try:
            print("[Vault] Creating automatic startup backup...")
            container.backup_service.create_backup("startup")
        except Exception as e:
            print(f"[Vault] Startup auto-backup failed: {e}")
            
    yield
    # Shutdown
    print("[Vault] Shutting down cleanly.")


app = FastAPI(
    title="Vault",
    description="Local-First Personal Knowledge Graph and Information Management System",
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if not settings.ALLOW_LAN else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 API routes
app.include_router(api_router)


@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint for launch scripts and probes."""
    container = ServiceContainer.get_instance()
    return {
        "status": "healthy",
        "app": "Vault",
        "version": settings.VERSION,
        "vault_path": str(container.vault.root_path),
        "is_accessible": container.vault.root_path.exists(),
    }


# Frontend static files mounting (for single-origin deployment)
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if settings.FRONTEND_DIST_DIR:
    frontend_dist = Path(settings.FRONTEND_DIST_DIR).resolve()

if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/") or full_path == "health":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(
            frontend_dist / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )

