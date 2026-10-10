"""Indexer module for building and synchronizing SQLite derived index with Vault markdown files."""

import json
from pathlib import Path
import sqlite3
import time
from typing import Dict, List, Optional, Set, Tuple
from app.core.frontmatter import parse_note_content
from app.core.links import extract_attachment_paths, extract_internal_links
from app.core.vault import VaultManager
from app.db.database import Database
from app.models.note import NoteMetadata


class Indexer:
    def __init__(self, vault_mgr: VaultManager, db: Database):
        self.vault = vault_mgr
        self.db = db

    def rebuild_full_index(self) -> Dict[str, int]:
        """Completely wipe and rebuild derived index from all markdown files in the vault."""
        start_time = time.time()
        
        with self.db.transaction() as conn:
            # Clear all indexed tables
            conn.execute("DELETE FROM attachment_refs;")
            conn.execute("DELETE FROM attachments;")
            conn.execute("DELETE FROM edges;")
            conn.execute("DELETE FROM nodes;")
            conn.execute("DELETE FROM fts_nodes;")

        # Scan and index all notes
        note_files = list(self.vault.nodes_dir.glob("*.md"))
        indexed_notes: Dict[str, Tuple[NoteMetadata, str, Path]] = {}
        title_to_id: Dict[str, str] = {}
        alias_to_id: Dict[str, str] = {}

        for file_path in note_files:
            try:
                content = file_path.read_text(encoding="utf-8")
                default_id = f"node_{file_path.stem}"
                default_title = file_path.stem.replace("-", " ").title()
                meta, body = parse_note_content(content, default_id, default_title)
                
                indexed_notes[meta.id] = (meta, body, file_path)
                title_to_id[meta.title.strip().lower()] = meta.id
                for alias in meta.aliases:
                    alias_to_id[alias.strip().lower()] = meta.id
            except Exception as e:
                print(f"Error parsing note file {file_path}: {e}")

        # Prepare batch lists
        node_records = []
        fts_records = []
        edge_records = []
        att_records = []
        att_ref_records = []

        for note_id, (meta, body, file_path) in indexed_notes.items():
            mtime = file_path.stat().st_mtime
            rel_path = file_path.relative_to(self.vault.root_path).as_posix()
            
            node_records.append(
                (
                    meta.id,
                    rel_path,
                    meta.title,
                    meta.parent_id,
                    meta.note_type,
                    json.dumps(meta.tags),
                    json.dumps(meta.aliases),
                    json.dumps(meta.custom_properties),
                    meta.created_at or "",
                    meta.modified_at or "",
                    meta.content_hash or "",
                    mtime,
                )
            )

            fts_records.append(
                (
                    meta.id,
                    meta.title,
                    " ".join(meta.aliases),
                    " ".join(meta.tags),
                    body,
                )
            )

            # Parent-child edge
            if meta.parent_id and meta.parent_id in indexed_notes:
                edge_records.append(
                    (note_id, meta.parent_id, indexed_notes[meta.parent_id][0].title, "parent_child", "Child of", 0)
                )

            # Relations
            for rel in meta.relations:
                target_id = rel.target_id
                is_broken = 1 if target_id not in indexed_notes else 0
                target_title = indexed_notes[target_id][0].title if not is_broken else rel.target_id
                edge_records.append(
                    (note_id, target_id, target_title, rel.type, rel.label, is_broken)
                )

            # Wikilinks
            parsed_links = extract_internal_links(body)
            for link in parsed_links:
                target_key = link.target.strip().lower()
                target_id = None
                is_broken = 0
                
                if link.target in indexed_notes:
                    target_id = link.target
                elif target_key in title_to_id:
                    target_id = title_to_id[target_key]
                elif target_key in alias_to_id:
                    target_id = alias_to_id[target_key]
                else:
                    target_id = link.target
                    is_broken = 1

                target_title = indexed_notes[target_id][0].title if target_id in indexed_notes else link.target
                edge_records.append(
                    (note_id, target_id, target_title, "inline_link", link.display or link.heading, is_broken)
                )

            # Attachments
            att_paths = extract_attachment_paths(body)
            for att_rel in att_paths:
                att_abs = self.vault.root_path / att_rel
                if att_abs.exists() and att_abs.is_file():
                    att_id = f"att_{att_abs.name}"
                    stat = att_abs.stat()
                    att_records.append(
                        (att_id, att_rel.replace("\\", "/"), att_abs.name, stat.st_size)
                    )
                    att_ref_records.append((note_id, att_id))

        # Single fast batch transaction
        with self.db.transaction(foreign_keys=False) as conn:
            conn.executemany(
                """
                INSERT INTO nodes (id, file_path, title, parent_id, note_type, tags, aliases, custom_properties, created_at, modified_at, content_hash, file_mtime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                node_records,
            )
            conn.executemany(
                """
                INSERT INTO fts_nodes (id, title, aliases, tags, content)
                VALUES (?, ?, ?, ?, ?)
                """,
                fts_records,
            )
            if edge_records:
                conn.executemany(
                    """
                    INSERT INTO edges (source_id, target_id, target_title, relation_type, label, is_broken)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    edge_records,
                )
            if att_records:
                conn.executemany(
                    """
                    INSERT OR IGNORE INTO attachments (id, file_path, original_name, file_size, mime_type, sha256, created_at)
                    VALUES (?, ?, ?, ?, 'application/octet-stream', '', datetime('now'))
                    """,
                    att_records,
                )
            if att_ref_records:
                conn.executemany(
                    """
                    INSERT OR IGNORE INTO attachment_refs (node_id, attachment_id)
                    VALUES (?, ?)
                    """,
                    att_ref_records,
                )

        self.update_descendant_counts()
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "notes_indexed": len(indexed_notes),
            "duration_ms": duration_ms,
        }

    def update_descendant_counts(self) -> None:
        """Calculate and update total descendant counts for all nodes efficiently."""
        with self.db.transaction() as conn:
            cursor = conn.execute("SELECT id, parent_id FROM nodes")
            rows = cursor.fetchall()
            
            parent_map: Dict[str, List[str]] = {}
            for r in rows:
                p_id = r["parent_id"]
                if p_id:
                    parent_map.setdefault(p_id, []).append(r["id"])

            memo: Dict[str, int] = {}

            def count_descendants(node_id: str, visited: Set[str]) -> int:
                if node_id in memo:
                    return memo[node_id]
                if node_id in visited:
                    return 0
                visited.add(node_id)
                children = parent_map.get(node_id, [])
                total = len(children)
                for c in children:
                    total += count_descendants(c, visited)
                memo[node_id] = total
                return total

            updates = []
            for r in rows:
                node_id = r["id"]
                desc_count = count_descendants(node_id, set())
                updates.append((desc_count, node_id))

            conn.executemany("UPDATE nodes SET descendant_count = ? WHERE id = ?", updates)

    def index_single_note(self, file_path: Path) -> None:
        """Incrementally index or re-index a single note file."""
        if not file_path.exists() or not file_path.name.endswith(".md"):
            return
        
        try:
            content = file_path.read_text(encoding="utf-8")
            default_id = f"node_{file_path.stem}"
            default_title = file_path.stem.replace("-", " ").title()
            meta, body = parse_note_content(content, default_id, default_title)
            
            mtime = file_path.stat().st_mtime
            rel_path = file_path.relative_to(self.vault.root_path).as_posix()

            with self.db.transaction() as conn:
                # Remove old edges and FTS for this note
                conn.execute("DELETE FROM edges WHERE source_id = ?", (meta.id,))
                conn.execute("DELETE FROM attachment_refs WHERE node_id = ?", (meta.id,))
                conn.execute("DELETE FROM fts_nodes WHERE id = ?", (meta.id,))
                
                conn.execute(
                    """
                    INSERT INTO nodes (id, file_path, title, parent_id, note_type, tags, aliases, custom_properties, created_at, modified_at, content_hash, file_mtime)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        file_path = excluded.file_path,
                        title = excluded.title,
                        parent_id = excluded.parent_id,
                        note_type = excluded.note_type,
                        tags = excluded.tags,
                        aliases = excluded.aliases,
                        custom_properties = excluded.custom_properties,
                        created_at = excluded.created_at,
                        modified_at = excluded.modified_at,
                        content_hash = excluded.content_hash,
                        file_mtime = excluded.file_mtime
                    """,
                    (
                        meta.id,
                        rel_path,
                        meta.title,
                        meta.parent_id,
                        meta.note_type,
                        json.dumps(meta.tags),
                        json.dumps(meta.aliases),
                        json.dumps(meta.custom_properties),
                        meta.created_at or "",
                        meta.modified_at or "",
                        meta.content_hash or "",
                        mtime,
                    ),
                )
                
                conn.execute(
                    """
                    INSERT INTO fts_nodes (id, title, aliases, tags, content)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        meta.id,
                        meta.title,
                        " ".join(meta.aliases),
                        " ".join(meta.tags),
                        body,
                    ),
                )

                # Re-index edges
                if meta.parent_id:
                    p_row = conn.execute("SELECT title FROM nodes WHERE id = ?", (meta.parent_id,)).fetchone()
                    p_title = p_row["title"] if p_row else meta.parent_id
                    conn.execute(
                        """
                        INSERT INTO edges (source_id, target_id, target_title, relation_type, label, is_broken)
                        VALUES (?, ?, ?, 'parent_child', 'Child of', ?)
                        """,
                        (meta.id, meta.parent_id, p_title, 0 if p_row else 1),
                    )

                for rel in meta.relations:
                    t_row = conn.execute("SELECT title FROM nodes WHERE id = ?", (rel.target_id,)).fetchone()
                    t_title = t_row["title"] if t_row else rel.target_id
                    conn.execute(
                        """
                        INSERT INTO edges (source_id, target_id, target_title, relation_type, label, is_broken)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (meta.id, rel.target_id, t_title, rel.type, rel.label, 0 if t_row else 1),
                    )

                parsed_links = extract_internal_links(body)
                for link in parsed_links:
                    t_row = conn.execute(
                        "SELECT id, title FROM nodes WHERE id = ? OR LOWER(title) = LOWER(?)",
                        (link.target, link.target),
                    ).fetchone()
                    
                    target_id = t_row["id"] if t_row else link.target
                    target_title = t_row["title"] if t_row else link.target
                    is_broken = 0 if t_row else 1
                    
                    conn.execute(
                        """
                        INSERT INTO edges (source_id, target_id, target_title, relation_type, label, is_broken)
                        VALUES (?, ?, ?, 'inline_link', ?, ?)
                        """,
                        (meta.id, target_id, target_title, link.display or link.heading, is_broken),
                    )

            self.update_descendant_counts()
        except Exception as e:
            print(f"Error incrementally indexing {file_path}: {e}")

    def remove_note_from_index(self, note_id: str) -> None:
        """Remove a deleted note from SQLite index."""
        with self.db.transaction() as conn:
            conn.execute("DELETE FROM nodes WHERE id = ?", (note_id,))
            conn.execute("DELETE FROM edges WHERE source_id = ? OR target_id = ?", (note_id, note_id))
            conn.execute("DELETE FROM attachment_refs WHERE node_id = ?", (note_id,))
            conn.execute("DELETE FROM fts_nodes WHERE id = ?", (note_id,))
        self.update_descendant_counts()
