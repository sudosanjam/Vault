"""Notes and Hierarchy API endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import ServiceContainer, get_services
from app.models.note import (
    BacklinkItem,
    Note,
    NoteCreateRequest,
    NoteMoveRequest,
    NoteSummary,
    NoteUpdateRequest,
    OutgoingLinkItem,
    TreeNode,
)

router = APIRouter(prefix="/notes", tags=["Notes"])


@router.get("", response_model=List[NoteSummary])
def list_notes(services: ServiceContainer = Depends(get_services)):
    """Fetch all notes as flat summary list for tables, explorer, and quick navigation."""
    return services.note_service.get_all_notes_summary()


@router.get("/tree", response_model=List[TreeNode])
def get_hierarchy_tree(services: ServiceContainer = Depends(get_services)):
    """Get full hierarchical tree structure of notes."""
    return services.note_service.get_hierarchy_tree()


@router.post("", response_model=Note, status_code=status.HTTP_201_CREATED)
def create_note(req: NoteCreateRequest, services: ServiceContainer = Depends(get_services)):
    """Create a new note with YAML frontmatter, atomic disk write, and indexing."""
    try:
        return services.note_service.create_note(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{note_id}", response_model=Note)
def get_note(note_id: str, services: ServiceContainer = Depends(get_services)):
    """Get full note content and metadata by ID."""
    note = services.note_service.get_note_by_id(note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found.")
    return note


@router.put("/{note_id}", response_model=Note)
def update_note(note_id: str, req: NoteUpdateRequest, services: ServiceContainer = Depends(get_services)):
    """Update note content, title, parent, or metadata with concurrency checking."""
    try:
        return services.note_service.update_note(note_id, req)
    except ValueError as e:
        # Conflict or validation error
        raise HTTPException(status_code=409 if "Conflict" in str(e) else 400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: str, services: ServiceContainer = Depends(get_services)):
    """Delete note and reassign children safely."""
    services.note_service.delete_note(note_id)
    return None


@router.post("/{note_id}/move", response_model=Note)
def move_note(note_id: str, req: NoteMoveRequest, services: ServiceContainer = Depends(get_services)):
    """Move note under a new parent with cycle prevention."""
    try:
        return services.note_service.move_note(note_id, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{note_id}/backlinks", response_model=List[BacklinkItem])
def get_backlinks(note_id: str, services: ServiceContainer = Depends(get_services)):
    """Get all incoming backlinks to this note."""
    return services.note_service.get_backlinks(note_id)


@router.get("/{note_id}/outgoing", response_model=List[OutgoingLinkItem])
def get_outgoing_links(note_id: str, services: ServiceContainer = Depends(get_services)):
    """Get all outgoing links from this note."""
    return services.note_service.get_outgoing_links(note_id)
