"""Service layer for Note CRUD, hierarchy, link updates, and cycle prevention."""

from datetime import datetime, timezone
import json
from pathlib import Path
import re
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from app.core.frontmatter import compute_content_hash, parse_note_content, serialize_note_content
from app.core.links import extract_internal_links, rewrite_link_target
from app.core.vault import VaultManager, sanitize_filename
from app.db.database import Database
from app.db.indexer import Indexer
from app.models.note import (
    BacklinkItem,
    Note,
    NoteCreateRequest,
    NoteMetadata,
    NoteMoveRequest,
    NoteRelation,
    NoteSummary,
    NoteUpdateRequest,
    OutgoingLinkItem,
    TreeNode,
    utc_now_iso,
)


class NoteService:
    def __init__(self, vault_mgr: VaultManager, db: Database, indexer: Indexer):
        self.vault = vault_mgr
        self.db = db
        self.indexer = indexer

    def _generate_node_id(self, title: str) -> str:
        slug = sanitize_filename(title, max_length=30)
        short_uid = uuid.uuid4().hex[:8]
        return f"node_{slug}_{short_uid}"

    def _get_note_file_path(self, note_id: str, title: str) -> Path:
        slug = sanitize_filename(title, max_length=50)
        return self.vault.nodes_dir / f"{slug}.md"

    def get_all_notes_summary(self) -> List[NoteSummary]:
        """Fetch all notes as flat summary list for table and explorer."""
        with self.db.get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT 
                    n.id, n.title, n.parent_id, n.note_type, n.tags, n.aliases,
                    n.created_at, n.modified_at, n.descendant_count, n.file_path,
                    (SELECT COUNT(*) FROM edges WHERE target_id = n.id) AS incoming_link_count,
                    (SELECT COUNT(*) FROM edges WHERE source_id = n.id) AS outgoing_link_count,
                    (SELECT COUNT(*) FROM attachment_refs WHERE node_id = n.id) AS attachment_count
                FROM nodes n
                ORDER BY n.modified_at DESC
                """
            )
            rows = cursor.fetchall()
            summaries = []
            for r in rows:
                summaries.append(
                    NoteSummary(
                        id=r["id"],
                        title=r["title"],
                        parent_id=r["parent_id"],
                        note_type=r["note_type"],
                        tags=json.loads(r["tags"]) if r["tags"] else [],
                        aliases=json.loads(r["aliases"]) if r["aliases"] else [],
                        created_at=r["created_at"],
                        modified_at=r["modified_at"],
                        descendant_count=r["descendant_count"],
                        incoming_link_count=r["incoming_link_count"],
                        outgoing_link_count=r["outgoing_link_count"],
                        attachment_count=r["attachment_count"],
                        file_path=r["file_path"],
                    )
                )
            return summaries

    def get_hierarchy_tree(self) -> List[TreeNode]:
        """Construct hierarchical tree of nodes."""
        with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT id, title, parent_id, note_type, tags, descendant_count FROM nodes ORDER BY title ASC")
            rows = cursor.fetchall()

            node_map: Dict[str, TreeNode] = {}
            parent_child_map: Dict[Optional[str], List[str]] = {}

            for r in rows:
                tags = json.loads(r["tags"]) if r["tags"] else []
                tn = TreeNode(
                    id=r["id"],
                    title=r["title"],
                    parent_id=r["parent_id"],
                    note_type=r["note_type"],
                    tags=tags,
                    descendant_count=r["descendant_count"],
                    children=[],
                )
                node_map[r["id"]] = tn
                parent_child_map.setdefault(r["parent_id"], []).append(r["id"])

            def build_subtree(pid: Optional[str]) -> List[TreeNode]:
                children_ids = parent_child_map.get(pid, [])
                result = []
                for cid in children_ids:
                    node = node_map[cid]
                    node.children = build_subtree(cid)
                    result.append(node)
                return result

            return build_subtree(None)

    def get_note_by_id(self, note_id: str) -> Optional[Note]:
        """Load full note model from disk and index."""
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT file_path FROM nodes WHERE id = ?", (note_id,)).fetchone()
            if not row:
                return None
            
            abs_path = self.vault.root_path / row["file_path"]
            if not abs_path.exists():
                return None

            content = self.vault.read_file(abs_path)
            meta, body = parse_note_content(content, default_id=note_id, default_title=abs_path.stem)
            
            return Note(
                metadata=meta,
                content=body,
                file_path=row["file_path"],
            )

    def create_note(self, req: NoteCreateRequest) -> Note:
        """Create a new note, write to disk, and index."""
        note_id = self._generate_node_id(req.title)
        now = utc_now_iso()
        
        # Determine file path
        target_path = self._get_note_file_path(note_id, req.title)
        counter = 1
        stem = target_path.stem
        while target_path.exists():
            target_path = self.vault.nodes_dir / f"{stem}-{counter}.md"
            counter += 1

        meta = NoteMetadata(
            id=note_id,
            title=req.title.strip(),
            created_at=now,
            modified_at=now,
            parent_id=req.parent_id,
            tags=req.tags,
            aliases=req.aliases,
            note_type=req.note_type,
            relations=req.relations,
            custom_properties=req.custom_properties,
        )

        full_text = serialize_note_content(meta, req.content)
        meta.content_hash = compute_content_hash(full_text)
        
        self.vault.atomic_write(target_path, full_text)
        self.indexer.index_single_note(target_path)

        rel_path = target_path.relative_to(self.vault.root_path).as_posix()
        return Note(metadata=meta, content=req.content, file_path=rel_path)

    def update_note(self, note_id: str, req: NoteUpdateRequest) -> Note:
        """Update existing note with concurrency protection."""
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT file_path, content_hash FROM nodes WHERE id = ?", (note_id,)).fetchone()
            if not row:
                raise ValueError(f"Note with ID '{note_id}' not found.")
            
            abs_path = self.vault.root_path / row["file_path"]
            if not abs_path.exists():
                raise FileNotFoundError(f"Note file {abs_path} not found.")

            current_content = self.vault.read_file(abs_path)
            meta, body = parse_note_content(current_content, default_id=note_id, default_title=abs_path.stem)

            # Concurrency conflict detection: check if expected_hash matches
            if req.expected_hash and meta.content_hash and req.expected_hash != meta.content_hash:
                raise ValueError(
                    f"Conflict detected: Note '{meta.title}' was modified externally or by another session. "
                    "Please reload and re-apply changes."
                )

            # Apply updates
            old_title = meta.title
            if req.title is not None and req.title.strip():
                meta.title = req.title.strip()
            
            if req.update_parent:
                # Cycle check if parent is changing
                if req.parent_id != meta.parent_id:
                    self._assert_no_parent_cycle(note_id, req.parent_id)
                meta.parent_id = req.parent_id
            
            if req.tags is not None:
                meta.tags = req.tags
            if req.aliases is not None:
                meta.aliases = req.aliases
            if req.note_type is not None:
                meta.note_type = req.note_type
            if req.relations is not None:
                meta.relations = req.relations
            if req.custom_properties is not None:
                meta.custom_properties = req.custom_properties

            new_body = req.content if req.content is not None else body
            meta.modified_at = utc_now_iso()

            full_text = serialize_note_content(meta, new_body)
            meta.content_hash = compute_content_hash(full_text)
            
            self.vault.atomic_write(abs_path, full_text)
            self.indexer.index_single_note(abs_path)

            # If title changed, update links in other notes
            if req.title and req.title.strip() != old_title:
                self._rewrite_links_for_renamed_note(old_title, req.title.strip())

            return Note(metadata=meta, content=new_body, file_path=row["file_path"])

    def move_note(self, note_id: str, req: NoteMoveRequest) -> Note:
        """Move note to a new parent in hierarchy with cycle prevention."""
        self._assert_no_parent_cycle(note_id, req.new_parent_id)
        return self.update_note(note_id, NoteUpdateRequest(parent_id=req.new_parent_id, update_parent=True))

    def _assert_no_parent_cycle(self, node_id: str, new_parent_id: Optional[str]) -> None:
        """Ensure moving node_id under new_parent_id does not create a cycle."""
        if not new_parent_id:
            return
        if node_id == new_parent_id:
            raise ValueError("A note cannot be its own parent.")

        # Check if new_parent_id is currently a descendant of node_id
        descendants = self._get_descendant_ids(node_id)
        if new_parent_id in descendants:
            raise ValueError(f"Cannot move note '{node_id}' under its own descendant '{new_parent_id}'.")

    def _get_descendant_ids(self, node_id: str) -> Set[str]:
        """Get all descendant node IDs recursively."""
        descendants: Set[str] = set()
        with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT id, parent_id FROM nodes")
            rows = cursor.fetchall()
            
            parent_map: Dict[str, List[str]] = {}
            for r in rows:
                p_id = r["parent_id"]
                if p_id:
                    parent_map.setdefault(p_id, []).append(r["id"])

            def collect(current_id: str):
                for child_id in parent_map.get(current_id, []):
                    if child_id not in descendants:
                        descendants.add(child_id)
                        collect(child_id)

            collect(node_id)
        return descendants

    def _rewrite_links_for_renamed_note(self, old_title: str, new_title: str) -> None:
        """Rewrite [[old_title]] to [[new_title]] across all vault markdown files."""
        for note_file in self.vault.nodes_dir.glob("*.md"):
            try:
                content = note_file.read_text(encoding="utf-8")
                updated = rewrite_link_target(content, old_title, new_title)
                if updated != content:
                    self.vault.atomic_write(note_file, updated)
                    self.indexer.index_single_note(note_file)
            except Exception as e:
                print(f"Error rewriting links in {note_file}: {e}")

    def delete_note(self, note_id: str) -> None:
        """Safely delete note, reassigning direct children to the deleted note's parent."""
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT file_path, parent_id FROM nodes WHERE id = ?", (note_id,)).fetchone()
            if not row:
                return
            
            parent_id = row["parent_id"]
            abs_path = self.vault.root_path / row["file_path"]

            # Reassign direct children to grandparent or null
            child_rows = conn.execute("SELECT id, file_path FROM nodes WHERE parent_id = ?", (note_id,)).fetchall()
            for child in child_rows:
                c_path = self.vault.root_path / child["file_path"]
                if c_path.exists():
                    c_content = self.vault.read_file(c_path)
                    c_meta, c_body = parse_note_content(c_content, child["id"], c_path.stem)
                    c_meta.parent_id = parent_id
                    c_text = serialize_note_content(c_meta, c_body)
                    self.vault.atomic_write(c_path, c_text)
                    self.indexer.index_single_note(c_path)

            # Delete physical file
            self.vault.delete_file(abs_path)
            # Remove from index
            self.indexer.remove_note_from_index(note_id)

    def get_backlinks(self, note_id: str) -> List[BacklinkItem]:
        """Get notes that link to note_id (incoming links) with context excerpts."""
        with self.db.get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT e.source_id, n.title AS source_title, e.relation_type, e.label
                FROM edges e
                JOIN nodes n ON e.source_id = n.id
                WHERE e.target_id = ?
                ORDER BY n.title ASC
                """,
                (note_id,),
            )
            rows = cursor.fetchall()
            backlinks = []
            for r in rows:
                backlinks.append(
                    BacklinkItem(
                        source_id=r["source_id"],
                        source_title=r["source_title"],
                        relation_type=r["relation_type"],
                        label=r["label"],
                    )
                )
            return backlinks

    def get_outgoing_links(self, note_id: str) -> List[OutgoingLinkItem]:
        """Get outgoing links from note_id."""
        with self.db.get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT target_id, target_title, relation_type, label, is_broken
                FROM edges
                WHERE source_id = ?
                ORDER BY target_title ASC
                """,
                (note_id,),
            )
            rows = cursor.fetchall()
            out_links = []
            for r in rows:
                out_links.append(
                    OutgoingLinkItem(
                        target_id=r["target_id"] if not r["is_broken"] else None,
                        target_title=r["target_title"] or r["target_id"],
                        relation_type=r["relation_type"],
                        label=r["label"],
                        is_broken=bool(r["is_broken"]),
                    )
                )
            return out_links
