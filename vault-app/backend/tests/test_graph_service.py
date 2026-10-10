"""Tests for graph visualization queries, local subgraph traversal, and relationship editing."""

from app.models.graph import GraphLayoutPayload
from app.models.note import NoteCreateRequest, NoteRelation


def test_graph_data_and_traversal(test_container):
    svc = test_container.note_service
    graph_svc = test_container.graph_service

    # Create interconnected nodes
    n1 = svc.create_note(NoteCreateRequest(title="Node 1"))
    n2 = svc.create_note(NoteCreateRequest(title="Node 2", parent_id=n1.metadata.id))
    n3 = svc.create_note(
        NoteCreateRequest(
            title="Node 3",
            relations=[NoteRelation(target_id=n2.metadata.id, type="depends_on", label="Depends on 2")],
        )
    )
    n_orphan = svc.create_note(NoteCreateRequest(title="Orphan Node"))

    # 1. Global graph
    global_graph = graph_svc.get_graph()
    assert global_graph.total_nodes == 4
    assert global_graph.total_edges >= 2

    # Check orphan detection
    orphan_node = next(n for n in global_graph.nodes if n.id == n_orphan.metadata.id)
    assert orphan_node.is_orphan is True

    # 2. Local graph with root_id and depth=1
    local_graph = graph_svc.get_graph(root_id=n1.metadata.id, depth=1)
    node_ids = {n.id for n in local_graph.nodes}
    assert n1.metadata.id in node_ids
    assert n2.metadata.id in node_ids
    assert n_orphan.metadata.id not in node_ids

    # 3. Save layout coordinates
    graph_svc.save_layout(
        GraphLayoutPayload(
            positions={n1.metadata.id: {"x": 100.0, "y": 200.0}}
        )
    )
    reloaded_graph = graph_svc.get_graph(root_id=n1.metadata.id, depth=1)
    n1_loaded = next(n for n in reloaded_graph.nodes if n.id == n1.metadata.id)
    assert n1_loaded.x == 100.0
    assert n1_loaded.y == 200.0
