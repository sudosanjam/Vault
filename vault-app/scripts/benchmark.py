#!/usr/bin/env python3
"""
Vault Performance & Benchmark Utility.
Generates synthetic high-scale vaults (1,000 - 5,000 notes) with interconnected graphs
and measures throughput for:
1. Batch Indexing & SQLite FTS5 population
2. FTS5 Full-Text Search latency
3. Graph BFS traversal latency at varying depths
4. Hierarchy tree resolution
5. Memory & disk storage efficiency
"""

import argparse
import os
from pathlib import Path
import random
import shutil
import sys
import tempfile
import time

script_dir = Path(__file__).resolve().parent
backend_dir = script_dir.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.frontmatter import serialize_note_content
from app.core.vault import VaultManager, sanitize_filename
from app.db.database import Database
from app.db.indexer import Indexer
from app.models.note import NoteMetadata, NoteRelation
from app.services.graph_service import GraphService
from app.services.note_service import NoteService
from app.services.search_service import SearchService


def generate_benchmark_vault(vault_mgr: VaultManager, count: int = 1000):
    print(f"[*] Generating {count} interconnected synthetic notes...")
    types = ["concept", "project", "standard", "reference", "daily"]
    tag_pool = ["architecture", "security", "database", "ai", "crypto", "performance", "frontend", "linux", "cloud", "algorithms"]
    
    note_ids = [f"bench_note_{i:04d}" for i in range(count)]
    titles = {nid: f"Benchmark Note {i} - Topic {random.choice(tag_pool).capitalize()}" for i, nid in enumerate(note_ids)}
    
    # Generate notes with links and parent-child hierarchy
    for i, nid in enumerate(note_ids):
        parent_id = note_ids[random.randint(0, i - 1)] if i > 0 and random.random() < 0.4 else None
        tags = random.sample(tag_pool, k=random.randint(1, 3))
        note_type = random.choice(types)
        
        # Link to 2-5 other existing notes
        linked_targets = random.sample(note_ids[:max(1, i)], k=min(i, random.randint(1, 4))) if i > 0 else []
        link_md = "\n".join(f"- Reference to [[{titles[t]}]]" for t in linked_targets)
        
        body = f"# {titles[nid]}\n\nThis is a benchmark node generated for stress-testing Vault index throughput and SQLite FTS5 search engines.\n\n## References\n{link_md}\n"
        
        meta = NoteMetadata(
            id=nid,
            title=titles[nid],
            created_at="2026-10-10T22:00:00Z",
            modified_at="2026-10-10T22:00:00Z",
            parent_id=parent_id,
            tags=tags,
            aliases=[f"Alias {i}"],
            note_type=note_type,
            relations=[NoteRelation(target_id=t, type="references") for t in linked_targets],
            custom_properties={"bench_index": i},
        )
        
        file_text = serialize_note_content(meta, body)
        file_name = f"{sanitize_filename(titles[nid])}.md"
        vault_mgr.atomic_write(vault_mgr.nodes_dir / file_name, file_text)

    print(f"[+] Successfully wrote {count} markdown files to disk.")


def run_benchmarks(count: int = 1000):
    temp_dir = Path(tempfile.mkdtemp(prefix="vault_bench_"))
    try:
        print("=" * 70)
        print(f"           VAULT BENCHMARK SUITE ({count:,} Nodes)          ")
        print("=" * 70)
        
        vault_mgr = VaultManager(temp_dir)
        db = Database(vault_mgr)
        indexer = Indexer(vault_mgr, db)
        note_service = NoteService(vault_mgr, db, indexer)
        graph_service = GraphService(vault_mgr, db, note_service)
        search_service = SearchService(db)

        # 1. Note Generation
        t0 = time.perf_counter()
        generate_benchmark_vault(vault_mgr, count)
        gen_time = (time.perf_counter() - t0) * 1000

        # 2. Cold Index Rebuild
        t0 = time.perf_counter()
        indexer.rebuild_full_index()
        index_time = (time.perf_counter() - t0) * 1000
        rate = count / (index_time / 1000)

        # 3. Hierarchy Tree Resolution
        t0 = time.perf_counter()
        note_service.get_hierarchy_tree()
        tree_time = (time.perf_counter() - t0) * 1000

        # 4. FTS5 Full-Text Search (10 iterations)
        queries = ["architecture", "security", "benchmark", "database", "stress-testing"]
        search_latencies = []
        for q in queries * 2:
            t0 = time.perf_counter()
            search_service.search(q, limit=20)
            search_latencies.append((time.perf_counter() - t0) * 1000)
        avg_search = sum(search_latencies) / len(search_latencies)

        # 5. Graph Local Subgraph BFS Traversal (depth=2)
        graph_latencies = []
        sample_nodes = [f"bench_note_{random.randint(0, count - 1):04d}" for _ in range(10)]
        for nid in sample_nodes:
            t0 = time.perf_counter()
            graph_service.get_graph(root_id=nid, depth=2)
            graph_latencies.append((time.perf_counter() - t0) * 1000)
        avg_graph = sum(graph_latencies) / len(graph_latencies)

        # 6. Global Graph Generation
        t0 = time.perf_counter()
        global_graph = graph_service.get_graph()
        global_graph_time = (time.perf_counter() - t0) * 1000

        # Output Results
        print("\n" + "-" * 70)
        print("PERFORMANCE RESULTS:")
        print("-" * 70)
        print(f"  File Generation (Disk Write) : {gen_time:>8.2f} ms  ({count / (gen_time / 1000):>7.1f} files/sec)")
        print(f"  SQLite + FTS5 Full Index     : {index_time:>8.2f} ms  ({rate:>7.1f} notes/sec)")
        print(f"  Hierarchy Tree Generation    : {tree_time:>8.2f} ms")
        print(f"  FTS5 Search Query Latency    : {avg_search:>8.2f} ms  (Average over {len(search_latencies)} queries)")
        print(f"  Graph Local BFS (depth=2)    : {avg_graph:>8.2f} ms  (Average over {len(graph_latencies)} traversals)")
        print(f"  Global Graph Build           : {global_graph_time:>8.2f} ms  ({len(global_graph.nodes)} nodes, {len(global_graph.edges)} edges)")
        print("-" * 70)
        
        db_size = (vault_mgr.cache_dir / "vault-index.db").stat().st_size / 1024
        print(f"  SQLite Database Index Size   : {db_size:>8.2f} KB ({db_size / count:.2f} KB/node)")
        print("=" * 70 + "\n")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vault Performance Benchmark")
    parser.add_argument("--count", "-c", type=int, default=1000, help="Number of synthetic notes to benchmark")
    args = parser.parse_args()
    run_benchmarks(args.count)
