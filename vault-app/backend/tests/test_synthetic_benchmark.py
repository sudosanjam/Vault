"""Performance benchmark validation with synthetic large vault (5,000 notes and thousands of relationships)."""

import time
from pathlib import Path
import random
import pytest

from app.core.frontmatter import serialize_note_content
from app.models.backup import RestoreRequest
from app.models.export import ExportFormat, ExportRequest, ExportScope
from app.models.note import NoteMetadata, NoteRelation


def test_synthetic_large_vault_benchmark(test_container):
    """
    Generate 5,000 synthetic notes with hierarchical parent-child trees,
    typed relationships, and wikilinks to measure real-world performance.
    """
    vault = test_container.vault
    indexer = test_container.indexer
    note_svc = test_container.note_service
    search_svc = test_container.search_service
    graph_svc = test_container.graph_service
    backup_svc = test_container.backup_service
    exp_svc = test_container.export_service

    TOTAL_NOTES = 5000
    print(f"\n[Benchmark] Generating {TOTAL_NOTES} synthetic markdown notes...")

    tags_pool = ["security", "networking", "crypto", "database", "distributed", "ai", "hardware", "iot", "systems", "cloud"]
    types_pool = ["concept", "project", "reference", "daily", "task"]
    
    gen_start = time.time()
    
    # 1. Generate files on disk directly to simulate existing vault
    node_ids = [f"node_bench_{i:05d}" for i in range(TOTAL_NOTES)]
    
    for i in range(TOTAL_NOTES):
        node_id = node_ids[i]
        title = f"Benchmark Note {i:05d} Topic {i % 50}"
        
        # Build hierarchy: parent is earlier node
        parent_id = node_ids[i // 10] if i > 0 else None
        
        # Relations to other notes
        relations = []
        if i > 5:
            target_idx = random.randint(0, i - 1)
            relations.append(
                NoteRelation(
                    target_id=node_ids[target_idx],
                    type=random.choice(["references", "depends_on", "relates_to", "implements"]),
                    label=f"Link to {target_idx}",
                )
            )

        tags = random.sample(tags_pool, k=random.randint(1, 3))
        note_type = random.choice(types_pool)

        meta = NoteMetadata(
            id=node_id,
            title=title,
            parent_id=parent_id,
            tags=tags,
            note_type=note_type,
            relations=relations,
        )

        body = f"""# {title}

This is a synthetic benchmark note generated for Vault performance validation.
It covers domain concepts related to {', '.join(tags)}.

## Linked References
- See [[{node_ids[(i + 1) % TOTAL_NOTES]}]] for next sequence.
- Related parent reference: [[{parent_id or 'Root'}]]

```python
def process_node_{i}():
    return {{"node_id": "{node_id}", "status": "active"}}
```
"""
        full_text = serialize_note_content(meta, body)
        note_file = vault.nodes_dir / f"bench-note-{i:05d}.md"
        note_file.write_text(full_text, encoding="utf-8")

    gen_duration = time.time() - gen_start
    print(f"[Benchmark] Generated {TOTAL_NOTES} files in {gen_duration:.2f}s")

    # 2. Benchmark Full Index Rebuild Time
    idx_start = time.time()
    rebuild_stat = indexer.rebuild_full_index()
    idx_duration = time.time() - idx_start
    print(f"[Benchmark] Full Index Rebuild Time for {TOTAL_NOTES} notes: {idx_duration:.3f}s ({TOTAL_NOTES / idx_duration:.0f} notes/sec)")
    assert rebuild_stat["notes_indexed"] == TOTAL_NOTES
    assert idx_duration < 60.0  # Index 5,000 notes within 60 seconds on disk

    # 3. Benchmark Note Fetch Latency
    fetch_start = time.time()
    sample_note = note_svc.get_note_by_id(node_ids[2500])
    fetch_duration_ms = (time.time() - fetch_start) * 1000
    print(f"[Benchmark] Single Note Fetch Latency: {fetch_duration_ms:.2f}ms")
    assert sample_note is not None
    assert fetch_duration_ms < 50.0  # Under 50ms to open a note

    # 4. Benchmark FTS5 Search Latency
    search_start = time.time()
    search_res = search_svc.search(query="synthetic benchmark")
    search_duration_ms = (time.time() - search_start) * 1000
    print(f"[Benchmark] Full-Text Search Latency across {TOTAL_NOTES} notes: {search_duration_ms:.2f}ms (Found: {search_res['total']})")
    assert search_duration_ms < 100.0  # Under 100ms FTS query

    # 5. Benchmark Local Graph Query (Depth 2 BFS)
    graph_start = time.time()
    local_graph = graph_svc.get_graph(root_id=node_ids[100], depth=2)
    graph_duration_ms = (time.time() - graph_start) * 1000
    print(f"[Benchmark] Local Subgraph Query (Depth 2): {graph_duration_ms:.2f}ms (Nodes: {local_graph.total_nodes}, Edges: {local_graph.total_edges})")
    assert graph_duration_ms < 100.0

    # 6. Benchmark Subtree Export to JSON
    export_start = time.time()
    exp_res = exp_svc.execute_export(
        ExportRequest(
            scope=ExportScope.SUBTREE,
            root_id=node_ids[10],
            format=ExportFormat.JSON,
        )
    )
    exp_duration = time.time() - export_start
    print(f"[Benchmark] Subtree Export to JSON ({exp_res.note_count} notes): {exp_duration:.3f}s")
    assert exp_duration < 5.0

    # 7. Benchmark Full Backup Creation Time & Size
    backup_start = time.time()
    backup_sum = backup_svc.create_backup("bench_run")
    backup_duration = time.time() - backup_start
    backup_mb = backup_sum.file_size_bytes / (1024 * 1024)
    print(f"[Benchmark] Full Vault Backup ({TOTAL_NOTES} notes): {backup_duration:.2f}s, Archive Size: {backup_mb:.2f} MB")
    assert backup_duration < 10.0
    assert backup_sum.is_valid is True
