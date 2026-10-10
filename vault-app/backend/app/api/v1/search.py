"""Search and Autocomplete API endpoints."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query

from app.api.deps import ServiceContainer, get_services

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("")
def search_notes(
    q: str = Query("", description="Search query"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    note_type: Optional[str] = Query(None, description="Filter by note type"),
    parent_id: Optional[str] = Query(None, description="Filter by parent note"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    services: ServiceContainer = Depends(get_services),
) -> Dict[str, Any]:
    """Execute FTS5 full-text search with match highlighting."""
    return services.search_service.search(
        query=q,
        tag=tag,
        note_type=note_type,
        parent_id=parent_id,
        limit=limit,
        offset=offset,
    )


@router.get("/autocomplete")
def autocomplete_links(
    q: str = Query("", description="Prefix query for [[ wikilinks"),
    limit: int = Query(10, ge=1, le=50),
    services: ServiceContainer = Depends(get_services),
) -> List[Dict[str, Any]]:
    """Autocomplete suggestions for internal note links."""
    return services.search_service.autocomplete_links(query=q, limit=limit)
