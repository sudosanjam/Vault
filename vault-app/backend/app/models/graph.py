"""Graph models for Vault."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    label: str
    title: str
    note_type: str = "concept"
    tags: List[str] = Field(default_factory=list)
    parent_id: Optional[str] = None
    is_orphan: bool = False
    in_degree: int = 0
    out_degree: int = 0
    x: Optional[float] = None
    y: Optional[float] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str = "references"  # parent_child, references, depends_on, relates_to, implements, extends, inline_link
    label: Optional[str] = None
    is_broken: bool = False


class GraphData(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    total_nodes: int = 0
    total_edges: int = 0


class GraphLayoutPayload(BaseModel):
    positions: Dict[str, Dict[str, float]]  # {node_id: {x: 100, y: 200}}
