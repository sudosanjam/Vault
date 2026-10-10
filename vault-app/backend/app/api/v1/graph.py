"""Graph API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import ServiceContainer, get_services
from app.models.graph import GraphData, GraphLayoutPayload

router = APIRouter(prefix="/graph", tags=["Graph"])


class CreateRelationshipPayload(BaseModel):
    source_id: str
    target_id: str
    relation_type: str = "references"
    label: Optional[str] = None


class DeleteRelationshipPayload(BaseModel):
    source_id: str
    target_id: str
    relation_type: str


@router.get("", response_model=GraphData)
def get_graph(
    root_id: Optional[str] = Query(None, description="Center node for local graph traversal"),
    depth: int = Query(2, ge=1, le=5, description="Traversal depth for local graph"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    note_type: Optional[str] = Query(None, description="Filter by note type"),
    include_broken: bool = Query(False, description="Include broken link edges"),
    services: ServiceContainer = Depends(get_services),
):
    """Fetch graph nodes and edges for visualization."""
    return services.graph_service.get_graph(
        root_id=root_id,
        depth=depth,
        tag_filter=tag,
        type_filter=note_type,
        include_broken=include_broken,
    )


@router.post("/layout")
def save_layout(payload: GraphLayoutPayload, services: ServiceContainer = Depends(get_services)):
    """Save custom node coordinates."""
    services.graph_service.save_layout(payload)
    return {"status": "saved"}


@router.post("/relationships")
def create_relationship(payload: CreateRelationshipPayload, services: ServiceContainer = Depends(get_services)):
    """Create a new typed edge between two nodes."""
    try:
        services.graph_service.create_relationship(
            payload.source_id, payload.target_id, payload.relation_type, payload.label
        )
        return {"status": "created"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/relationships")
def delete_relationship(payload: DeleteRelationshipPayload, services: ServiceContainer = Depends(get_services)):
    """Delete a relationship edge between two nodes."""
    services.graph_service.delete_relationship(payload.source_id, payload.target_id, payload.relation_type)
    return {"status": "deleted"}
