"""Pydantic models for Note and Hierarchy."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class NoteRelation(BaseModel):
    target_id: str
    type: str = "references"  # references, depends_on, relates_to, implements, extends
    label: Optional[str] = None


class NoteMetadata(BaseModel):
    id: str
    title: str
    created_at: str = Field(default_factory=utc_now_iso)
    modified_at: str = Field(default_factory=utc_now_iso)
    parent_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    aliases: List[str] = Field(default_factory=list)
    note_type: str = "concept"  # concept, project, reference, daily, task, general
    relations: List[NoteRelation] = Field(default_factory=list)
    custom_properties: Dict[str, Any] = Field(default_factory=dict)
    content_hash: Optional[str] = None


class Note(BaseModel):
    metadata: NoteMetadata
    content: str = ""
    file_path: Optional[str] = None


class NoteCreateRequest(BaseModel):
    title: str
    content: str = ""
    parent_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    aliases: List[str] = Field(default_factory=list)
    note_type: str = "concept"
    relations: List[NoteRelation] = Field(default_factory=list)
    custom_properties: Dict[str, Any] = Field(default_factory=dict)


class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None
    update_parent: bool = False
    tags: Optional[List[str]] = None
    aliases: Optional[List[str]] = None
    note_type: Optional[str] = None
    relations: Optional[List[NoteRelation]] = None
    custom_properties: Optional[Dict[str, Any]] = None
    expected_hash: Optional[str] = None  # Concurrency conflict detection


class NoteMoveRequest(BaseModel):
    new_parent_id: Optional[str] = None
    target_index: Optional[int] = None


class NoteSummary(BaseModel):
    id: str
    title: str
    parent_id: Optional[str] = None
    note_type: str = "concept"
    tags: List[str] = Field(default_factory=list)
    aliases: List[str] = Field(default_factory=list)
    created_at: str
    modified_at: str
    descendant_count: int = 0
    incoming_link_count: int = 0
    outgoing_link_count: int = 0
    attachment_count: int = 0
    file_path: str


class TreeNode(BaseModel):
    id: str
    title: str
    parent_id: Optional[str] = None
    note_type: str = "concept"
    tags: List[str] = Field(default_factory=list)
    descendant_count: int = 0
    children: List["TreeNode"] = Field(default_factory=list)


TreeNode.model_rebuild()


class BacklinkItem(BaseModel):
    source_id: str
    source_title: str
    relation_type: str
    label: Optional[str] = None
    excerpt: Optional[str] = None


class OutgoingLinkItem(BaseModel):
    target_id: Optional[str] = None
    target_title: str
    relation_type: str
    label: Optional[str] = None
    is_broken: bool = False
