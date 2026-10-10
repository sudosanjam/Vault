"""Search service using SQLite FTS5 with fallback, match excerpts, and autocomplete."""

import json
import re
from typing import Any, Dict, List, Optional
from app.db.database import Database


class SearchResult(Dict[str, Any]):
    pass


class SearchService:
    def __init__(self, db: Database):
        self.db = db

    def search(
        self,
        query: str = "",
        tag: Optional[str] = None,
        note_type: Optional[str] = None,
        parent_id: Optional[str] = None,
        is_orphan: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Global full-text search across titles, aliases, tags, and note markdown bodies.
        Returns match snippets with <mark> tags.
        """
        clean_q = query.strip()
        results: List[Dict[str, Any]] = []

        with self.db.get_connection() as conn:
            if clean_q:
                # Prepare FTS query - escape special characters
                safe_fts = re.sub(r'["\*\+\-\(\)]', " ", clean_q).strip()
                tokens = [f'"{t}"*' for t in safe_fts.split() if t]
                fts_expr = " AND ".join(tokens) if tokens else clean_q

                try:
                    sql = """
                        SELECT 
                            f.id,
                            n.title,
                            n.parent_id,
                            n.note_type,
                            n.tags,
                            n.modified_at,
                            snippet(fts_nodes, 4, '<mark>', '</mark>', '...', 15) AS snippet,
                            bm25(fts_nodes, 5.0, 3.0, 2.0, 1.0) AS rank
                        FROM fts_nodes f
                        JOIN nodes n ON f.id = n.id
                        WHERE fts_nodes MATCH ?
                    """
                    params: List[Any] = [fts_expr]

                    if note_type:
                        sql += " AND n.note_type = ?"
                        params.append(note_type)
                    if parent_id:
                        sql += " AND n.parent_id = ?"
                        params.append(parent_id)

                    sql += " ORDER BY rank ASC LIMIT ? OFFSET ?"
                    params.extend([limit, offset])

                    cursor = conn.execute(sql, params)
                    rows = cursor.fetchall()
                except Exception:
                    # Fallback to LIKE query if FTS query syntax error
                    like_expr = f"%{clean_q}%"
                    sql = """
                        SELECT 
                            n.id, n.title, n.parent_id, n.note_type, n.tags, n.modified_at,
                            substr(n.title, 1, 100) AS snippet
                        FROM nodes n
                        WHERE (n.title LIKE ? OR n.tags LIKE ? OR n.aliases LIKE ?)
                    """
                    params = [like_expr, like_expr, like_expr]
                    if note_type:
                        sql += " AND n.note_type = ?"
                        params.append(note_type)
                    sql += " ORDER BY n.modified_at DESC LIMIT ? OFFSET ?"
                    params.extend([limit, offset])
                    cursor = conn.execute(sql, params)
                    rows = cursor.fetchall()
            else:
                # No query text: list notes by filters or recently modified
                sql = """
                    SELECT 
                        n.id, n.title, n.parent_id, n.note_type, n.tags, n.modified_at,
                        '' AS snippet
                    FROM nodes n
                    WHERE 1=1
                """
                params = []
                if note_type:
                    sql += " AND n.note_type = ?"
                    params.append(note_type)
                if parent_id:
                    sql += " AND n.parent_id = ?"
                    params.append(parent_id)

                sql += " ORDER BY n.modified_at DESC LIMIT ? OFFSET ?"
                params.extend([limit, offset])
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()

            for r in rows:
                tags = json.loads(r["tags"]) if r["tags"] else []
                if tag and tag.lower() not in [t.lower() for t in tags]:
                    continue

                snippet_text = r["snippet"] if "snippet" in r.keys() else ""
                results.append(
                    {
                        "id": r["id"],
                        "title": r["title"],
                        "parent_id": r["parent_id"],
                        "note_type": r["note_type"],
                        "tags": tags,
                        "modified_at": r["modified_at"],
                        "snippet": snippet_text,
                    }
                )

        return {
            "results": results,
            "total": len(results),
            "query": query,
        }

    def autocomplete_links(self, query: str = "", limit: int = 10) -> List[Dict[str, Any]]:
        """
        Fast autocomplete for [[ wikilink completion in the editor.
        Matches titles and aliases, returning disambiguation context.
        """
        clean_q = query.strip().lower()
        suggestions = []

        with self.db.get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, title, parent_id, note_type, tags, aliases 
                FROM nodes 
                ORDER BY title ASC
                """
            )
            rows = cursor.fetchall()
            for r in rows:
                title = r["title"]
                aliases = json.loads(r["aliases"]) if r["aliases"] else []
                tags = json.loads(r["tags"]) if r["tags"] else []

                match = False
                matched_alias = None

                if not clean_q or clean_q in title.lower():
                    match = True
                else:
                    for alias in aliases:
                        if clean_q in alias.lower():
                            match = True
                            matched_alias = alias
                            break

                if match:
                    suggestions.append(
                        {
                            "id": r["id"],
                            "title": title,
                            "note_type": r["note_type"],
                            "tags": tags,
                            "matched_alias": matched_alias,
                        }
                    )
                    if len(suggestions) >= limit:
                        break

        return suggestions
