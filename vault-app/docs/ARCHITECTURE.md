# Vault Architecture & Technical Specification

## 1. System Overview

**Vault** is a local-first personal knowledge graph and information management system designed for longevity, security, high performance, and complete data ownership. Every note in Vault is an independently addressable node stored as standard plaintext Markdown with YAML frontmatter.

Unlike cloud-dependent or proprietary database PKMs, Vault enforces a strict **Zero-Cloud, Plaintext-Durable** architectural contract:
1. **Markdown is the Single Source of Truth:** If the database cache is completely deleted, corrupted, or wiped, 100% of the vault state (nodes, hierarchies, graph connections, tags, attachments, and metadata) is reconstructed automatically.
2. **Local-First & Single-Origin Loopback:** Operates strictly on `127.0.0.1:8000` with zero external analytics, telemetry, or network calls.
3. **Derived High-Performance SQLite Cache:** A fast SQLite database in `.vault-cache/vault-index.db` configured with Write-Ahead Logging (WAL) and FTS5 full-text indexing accelerates tree navigation, subgraph BFS traversals, and sub-10ms full-text searches.

---

## 2. Layered Architecture

```
+-----------------------------------------------------------------------+
|                    FRONTEND CLIENT (SPA)                              |
|   React 18 + Vite + TypeScript (Strict) + Tailwind CSS                |
|   - React Flow: Interactive 2D Graph Visualizer with force layout     |
|   - Tiptap: WYSIWYG / Markdown Rich Text Editor with [[wikilinks]]     |
|   - Multi-tab navigation, Explorer tree, Inspector drawer             |
|   - Dark / Light / Cyberpunk themes with CSS token variables          |
+-----------------------------------------------------------------------+
                                  |
                                  | REST API (HTTP Loopback 127.0.0.1:8000)
                                  v
+-----------------------------------------------------------------------+
|                    FASTAPI APPLICATION (v1)                           |
|   - Route Handlers: Notes, Graph, Search, Attachments, Backups,       |
|                     Exports, Imports, System Diagnostics             |
|   - CORS & Boundary Path Traversal Security Guards                    |
|   - Single-origin static asset serving for production distribution   |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|                    SERVICE & CORE LOGIC                               |
|   - NoteService: CRUD, DAG cycle detection, conflict checks           |
|   - GraphService: BFS local depth traversals, degree calculations     |
|   - SearchService: SQLite FTS5 full-text rank queries & snippets      |
|   - BackupService: Timestamped ZIPs, SHA-256 manifests, staged restore|
|   - ExportService: Playwright headless Chromium PDF, HTML, ZIP, JSON  |
|   - ImportService: Markdown directory & ZIP collision resolvers       |
+-----------------------------------------------------------------------+
                 |                                      |
                 v                                      v
+---------------------------------+   +---------------------------------+
|  DURABLE STORAGE (DISK TRUTH)   |   |   DERIVED CACHE (TRANSIENT)     |
|  - nodes/*.md (Frontmatter+MD)  |   |   - .vault-cache/vault-index.db |
|  - attachments/{images,docs,...}|   |     - SQLite WAL mode           |
|  - metadata/*.json              |   |     - FTS5 virtual table        |
|  - backups/*.zip + SHA-256      |   |     - Indices on tags, relations|
|  - exports/ (Generated outputs) |   |   100% Rebuildable anytime!     |
|  - .vault-config.yaml           |   +---------------------------------+
+---------------------------------+
```

---

## 3. Storage Hierarchy & Durability Contract

### Directory Layout
```
VaultRoot/
├── .vault-config.yaml          # Vault-level settings (name, default note type, debounce)
├── .vault-cache/
│   ├── vault-index.db          # Derived SQLite database (transient, git-ignored)
│   ├── vault-index.db-wal      # Write-Ahead Log journal
│   └── vault-index.db-shm      # Shared memory index
├── nodes/
│   ├── zero-trust-arch.md      # Markdown note with YAML frontmatter
│   ├── api-security.md
│   └── ...
├── attachments/
│   ├── images/                 # Image attachments (.png, .jpg, .svg)
│   ├── documents/              # PDF and office attachments
│   └── other/                  # Audio, archive, binary files
├── metadata/
│   ├── graph-layouts.json      # Node position coordinates in 2D graph space
│   └── .tmp/                   # Atomic write staging area
├── backups/                    # Verified timestamped ZIP archives with manifest.json
└── exports/                    # Generated PDF, HTML, JSON, and ZIP packages
```

### Atomic File Write Protocol
To prevent data corruption during unexpected system crashes or power failures, all disk writes follow an atomic write protocol:
1. Content is written to a unique temporary file in `metadata/.tmp/`.
2. The file is flushed and synced to disk.
3. An atomic filesystem move (`os.replace`) swaps the temporary file into the final destination path.

### Path Traversal Protection
Every filesystem operation checks `vault_mgr.is_safe_path(target_path)`. Any path containing `..`, absolute Windows drive roots outside the vault root, or symlink escapes immediately raises `PermissionError` with HTTP 400 rejection.

---

## 4. SQLite Index & FTS5 Search Engine

### SQLite Pragmas
The SQLite connection is configured with high-concurrency pragmas:
- `PRAGMA journal_mode = WAL;` (Concurrent readers while writing)
- `PRAGMA synchronous = NORMAL;` (High write throughput without risking DB corruption)
- `PRAGMA foreign_keys = ON;` (Referential integrity during transactions)
- `PRAGMA busy_timeout = 5000;` (Handles concurrent write locks cleanly)

### FTS5 Full-Text Virtual Table
```sql
CREATE VIRTUAL TABLE fts_nodes USING fts5(
    id UNINDEXED,
    title,
    aliases,
    tags,
    content,
    tokenize = 'porter unicode61'
);
```
Searches query `fts_nodes` with prefix matching (`query*`) and rank by match quality. Highlighted snippets are produced with `<mark>` tags using SQLite's built-in `snippet()` function.

---

## 5. Concurrency & Collision Protection

### Optimistic Concurrency Control (OCC)
Each note's frontmatter and SQLite record store a SHA-256 `content_hash`.
1. When a client opens a note, it receives the current `content_hash`.
2. When submitting an update, the client passes `expected_hash`.
3. If disk content changed on host (e.g. edited in VS Code or Obsidian externally), the hashes mismatch and the server returns `HTTP 409 Conflict` with the current disk state, preventing silent overwrites.

### Hierarchy Cycle Prevention
When updating a note's `parent_id`:
1. The service checks if `new_parent_id == note_id`.
2. The service executes an iterative traversal of the ancestor chain. If the target parent is currently a descendant of the note, the operation is blocked with a 400 error.

---

## 6. Performance Benchmarks

Measured on a Windows 11 host with Python 3.13 and SQLite 3:

| Metric | Result | Target Benchmark |
| :--- | :--- | :--- |
| **Synthetic Notes Count** | **1,000 notes** | 1,000+ |
| **Inter-note Graph Edges** | **5,313 edges** | 2,000+ |
| **Cold SQLite + FTS5 Indexing** | **7.82 seconds** (128 notes/sec) | < 15.0 s |
| **Atomic Disk Write Throughput** | **497.7 files/sec** | > 200 files/sec |
| **Hierarchy Tree Resolution** | **15.97 ms** | < 50 ms |
| **FTS5 Full-Text Search Latency** | **5.61 ms** | < 20 ms |
| **Graph BFS Local Traversal (depth=2)** | **6.63 ms** | < 25 ms |
| **Global 2D Graph Construction** | **46.71 ms** | < 100 ms |
| **SQLite DB Index Size** | **2.05 KB / note** | < 10 KB / note |
