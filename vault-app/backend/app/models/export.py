"""Export models."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ExportScope(str, Enum):
    SINGLE = "single"
    SUBTREE = "subtree"
    VAULT = "vault"
    SELECTION = "selection"


class ExportFormat(str, Enum):
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "markdown"
    JSON = "json"
    ZIP = "zip"


class ExternalLinkPolicy(str, Enum):
    PRESERVE = "preserve"  # Keep as [[Title]] or reference text
    INCLUDE = "include"    # Pull in referenced notes
    MARK = "mark"          # Mark as [External Reference: Title]


class ExportRequest(BaseModel):
    scope: ExportScope = ExportScope.SINGLE
    root_id: Optional[str] = None
    selected_ids: List[str] = Field(default_factory=list)
    include_descendants: bool = True
    format: ExportFormat = ExportFormat.PDF
    include_attachments: bool = True
    external_link_policy: ExternalLinkPolicy = ExternalLinkPolicy.PRESERVE
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None


class ExportPreview(BaseModel):
    scope: ExportScope
    format: ExportFormat
    note_count: int
    attachment_count: int
    estimated_size_bytes: int
    note_titles: List[str]
    output_filename: str


class ExportResult(BaseModel):
    filename: str
    download_url: str
    file_size_bytes: int
    note_count: int
    attachment_count: int
    format: str
    content_type: str
