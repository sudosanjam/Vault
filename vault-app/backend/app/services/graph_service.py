"""Graph visualization service for node neighborhoods, global graph, and layout persistence."""

import json
from typing import Any, Dict, List, Optional, Set
from app.core.vault import VaultManager
from app.db.database import Database
from app.models.graph import GraphData, GraphEdge, GraphLayoutPayload, GraphNode
from app.models.note import NoteRelation, NoteUpdateRequest
from app.services.note_service import NoteService


class GraphService:
    def __init__(self, vault_mgr: VaultManager, db: Database, note_service: NoteService):
        self.vault = vault_mgr
        self.db = db
        self.note_service = note_service

    def get_graph(
        self,
        root_id: Optional[str] = None,
        depth: int = 2,
        tag_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        include_broken: bool = False,
        layout_name: Optional[str] = None,
    ) -> GraphData:
        """
        Build graph data.
        If root_id is provided, performs BFS up to `depth` from root_id.
        Otherwise, returns all vault nodes and edges filtered by tags/type.
        """
        layouts_data = self.vault.get_graph_layouts()
        chosen_layout = layout_name or layouts_data.get("active_layout", "default")
        named_layouts = layouts_data.get("layouts", {})
        if chosen_layout in named_layouts and "positions" in named_layouts[chosen_layout]:
            saved_positions = named_layouts[chosen_layout]["positions"]
        else:
            saved_positions = layouts_data.get("positions", {})


        with self.db.get_connection() as conn:
            # 1. Fetch all nodes
            node_query = "SELECT id, title, note_type, tags, parent_id FROM nodes WHERE 1=1"
            params: List[str] = []
            if type_filter:
                node_query += " AND note_type = ?"
                params.append(type_filter)
            
            cursor = conn.execute(node_query, params)
            all_db_nodes = {r["id"]: r for r in cursor.fetchall()}

            # 2. Filter nodes by tag in memory if specified
            if tag_filter:
                filtered_nodes = {}
                for nid, row in all_db_nodes.items():
                    tags = json.loads(row["tags"]) if row["tags"] else []
                    if tag_filter.lower() in [t.lower() for t in tags]:
                        filtered_nodes[nid] = row
                all_db_nodes = filtered_nodes

            # 3. Determine active nodes
            active_node_ids: Set[str] = set()
            
            if root_id and root_id in all_db_nodes:
                # Local graph BFS traversal
                active_node_ids.add(root_id)
                current_frontier = {root_id}
                
                for _ in range(depth):
                    next_frontier: Set[str] = set()
                    for curr_id in current_frontier:
                        # Find neighbors in edges table
                        edge_rows = conn.execute(
                            "SELECT source_id, target_id FROM edges WHERE source_id = ? OR target_id = ?",
                            (curr_id, curr_id),
                        ).fetchall()
                        for er in edge_rows:
                            neighbor = er["target_id"] if er["source_id"] == curr_id else er["source_id"]
                            if neighbor in all_db_nodes and neighbor not in active_node_ids:
                                active_node_ids.add(neighbor)
                                next_frontier.add(neighbor)
                    current_frontier = next_frontier
            else:
                # Global graph
                active_node_ids = set(all_db_nodes.keys())

            # 4. Fetch edges between active nodes
            edges: List[GraphEdge] = []
            in_degrees: Dict[str, int] = {nid: 0 for nid in active_node_ids}
            out_degrees: Dict[str, int] = {nid: 0 for nid in active_node_ids}

            if active_node_ids:
                placeholders = ",".join("?" * len(active_node_ids))
                edge_sql = f"""
                    SELECT id, source_id, target_id, relation_type, label, is_broken 
                    FROM edges 
                    WHERE source_id IN ({placeholders}) AND target_id IN ({placeholders})
                """
                edge_params = list(active_node_ids) + list(active_node_ids)
                if not include_broken:
                    edge_sql += " AND is_broken = 0"

                edge_cursor = conn.execute(edge_sql, edge_params)
                for er in edge_cursor.fetchall():
                    s_id = er["source_id"]
                    t_id = er["target_id"]
                    edges.append(
                        GraphEdge(
                            id=f"e_{er['id']}_{s_id}_{t_id}",
                            source=s_id,
                            target=t_id,
                            relation_type=er["relation_type"],
                            label=er["label"],
                            is_broken=bool(er["is_broken"]),
                        )
                    )
                    out_degrees[s_id] = out_degrees.get(s_id, 0) + 1
                    in_degrees[t_id] = in_degrees.get(t_id, 0) + 1

            # 5. Build GraphNode objects
            nodes: List[GraphNode] = []
            for nid in active_node_ids:
                row = all_db_nodes[nid]
                tags = json.loads(row["tags"]) if row["tags"] else []
                pos = saved_positions.get(nid, {})
                deg = in_degrees.get(nid, 0) + out_degrees.get(nid, 0)
                
                nodes.append(
                    GraphNode(
                        id=nid,
                        label=row["title"],
                        title=row["title"],
                        note_type=row["note_type"],
                        tags=tags,
                        parent_id=row["parent_id"],
                        is_orphan=(deg == 0),
                        in_degree=in_degrees.get(nid, 0),
                        out_degree=out_degrees.get(nid, 0),
                        x=pos.get("x"),
                        y=pos.get("y"),
                    )
                )

            return GraphData(
                nodes=nodes,
                edges=edges,
                total_nodes=len(nodes),
                total_edges=len(edges),
            )

    def get_layouts(self) -> Dict[str, Any]:
        """Fetch all named graph layouts and the current active layout."""
        data = self.vault.get_graph_layouts()
        layouts = data.get("layouts", {})
        if "positions" in data and "default" not in layouts:
            layouts["default"] = {"positions": data["positions"]}
        return {
            "active_layout": data.get("active_layout", "default"),
            "layouts": layouts,
        }

    def save_layout(self, payload: GraphLayoutPayload) -> None:
        """Save user-customized node positions, supporting named layouts."""
        layouts_data = self.vault.get_graph_layouts()
        layout_name = payload.layout_name or "default"
        named_layouts = layouts_data.get("layouts", {})

        existing_pos = named_layouts.get(layout_name, {}).get("positions", {})
        existing_pos.update(payload.positions)
        named_layouts[layout_name] = {"positions": existing_pos}

        layouts_data["layouts"] = named_layouts
        if payload.set_active:
            layouts_data["active_layout"] = layout_name
            layouts_data["positions"] = existing_pos
        self.vault.save_graph_layouts(layouts_data)

    def create_relationship(self, source_id: str, target_id: str, relation_type: str = "references", label: Optional[str] = None) -> None:
        """Create a new typed relationship edge between two nodes in frontmatter."""
        source_note = self.note_service.get_note_by_id(source_id)
        if not source_note:
            raise ValueError(f"Source note '{source_id}' not found.")
        
        # Check if relation already exists
        existing = source_note.metadata.relations
        for rel in existing:
            if rel.target_id == target_id and rel.type == relation_type:
                return  # already exists

        new_relations = list(existing) + [NoteRelation(target_id=target_id, type=relation_type, label=label)]
        self.note_service.update_note(source_id, NoteUpdateRequest(relations=new_relations))

    def update_relationship(
        self,
        source_id: str,
        old_target_id: str,
        old_relation_type: str,
        new_target_id: str,
        new_relation_type: str = "references",
        new_label: Optional[str] = None,
    ) -> None:
        """Edit an existing typed relationship in frontmatter."""
        source_note = self.note_service.get_note_by_id(source_id)
        if not source_note:
            raise ValueError(f"Source note '{source_id}' not found.")
        
        new_relations = []
        replaced = False
        for r in source_note.metadata.relations:
            if not replaced and r.target_id == old_target_id and r.type == old_relation_type:
                new_relations.append(NoteRelation(target_id=new_target_id, type=new_relation_type, label=new_label))
                replaced = True
            else:
                new_relations.append(r)
        
        if not replaced:
            new_relations.append(NoteRelation(target_id=new_target_id, type=new_relation_type, label=new_label))
            
        self.note_service.update_note(source_id, NoteUpdateRequest(relations=new_relations))

    def delete_relationship(self, source_id: str, target_id: str, relation_type: str) -> None:
        """Remove a typed relationship from source note frontmatter."""
        source_note = self.note_service.get_note_by_id(source_id)
        if not source_note:
            return
        
        filtered = [r for r in source_note.metadata.relations if not (r.target_id == target_id and r.type == relation_type)]
        self.note_service.update_note(source_id, NoteUpdateRequest(relations=filtered))

