"""V1 API Router aggregation."""

from fastapi import APIRouter
from app.api.v1.attachments import router as attachments_router
from app.api.v1.backups import router as backups_router
from app.api.v1.exports import router as exports_router
from app.api.v1.graph import router as graph_router
from app.api.v1.imports import router as imports_router
from app.api.v1.notes import router as notes_router
from app.api.v1.search import router as search_router
from app.api.v1.system import router as system_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(notes_router)
api_router.include_router(graph_router)
api_router.include_router(search_router)
api_router.include_router(attachments_router)
api_router.include_router(backups_router)
api_router.include_router(exports_router)
api_router.include_router(imports_router)
api_router.include_router(system_router)
