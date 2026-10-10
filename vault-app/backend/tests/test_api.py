"""Integration tests for FastAPI REST API endpoints."""

from fastapi.testclient import TestClient


def test_api_note_lifecycle(client: TestClient):
    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # 2. Create note
    create_res = client.post(
        "/api/v1/notes",
        json={
            "title": "API Lifecycle Note",
            "content": "# Hello from API\nTesting [[Another Note]].",
            "tags": ["api", "test"],
            "note_type": "concept",
        },
    )
    assert create_res.status_code == 201
    created_note = create_res.json()
    note_id = created_note["metadata"]["id"]
    assert created_note["metadata"]["title"] == "API Lifecycle Note"

    # 3. Read note
    get_res = client.get(f"/api/v1/notes/{note_id}")
    assert get_res.status_code == 200
    assert get_res.json()["metadata"]["title"] == "API Lifecycle Note"

    # 4. Update note
    update_res = client.put(
        f"/api/v1/notes/{note_id}",
        json={
            "title": "API Lifecycle Note Renamed",
            "content": "# Updated Content",
        },
    )
    assert update_res.status_code == 200
    assert update_res.json()["metadata"]["title"] == "API Lifecycle Note Renamed"

    # 5. List notes & tree
    list_res = client.get("/api/v1/notes")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    tree_res = client.get("/api/v1/notes/tree")
    assert tree_res.status_code == 200
    assert len(tree_res.json()) >= 1

    # 6. Search
    search_res = client.get("/api/v1/search?q=Updated")
    assert search_res.status_code == 200
    assert search_res.json()["total"] >= 1

    # 7. Graph
    graph_res = client.get("/api/v1/graph")
    assert graph_res.status_code == 200
    assert graph_res.json()["total_nodes"] >= 1

    # 8. Diagnostics
    diag_res = client.get("/api/v1/system/diagnostics")
    assert diag_res.status_code == 200
    assert diag_res.json()["is_vault_accessible"] is True

    # 9. Delete note
    del_res = client.delete(f"/api/v1/notes/{note_id}")
    assert del_res.status_code == 204
