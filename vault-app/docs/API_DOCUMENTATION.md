# Vault REST API v1 Specification

All endpoints are hosted locally under the loopback base path: `http://127.0.0.1:8000/api/v1`

---

## 1. Notes API

### `GET /api/v1/notes`
List summary metadata for all notes in the vault.
- **Query Parameters:**
  - `tag` (optional string): Filter by tag
  - `note_type` (optional string): Filter by type
  - `parent_id` (optional string): Filter by parent
- **Response:** `200 OK` — `List[NoteSummary]`

### `GET /api/v1/notes/tree`
Get full hierarchical tree representation of notes.
- **Response:** `200 OK` — `List[TreeNode]`

### `GET /api/v1/notes/{id}`
Retrieve a single note with frontmatter metadata and markdown content body.
- **Response:** `200 OK` — `Note`

### `POST /api/v1/notes`
Create a new note.
- **Request Body:**
  ```json
  {
    "title": "Quantum Key Distribution",
    "content": "# Quantum Key Distribution\n\nContent here...",
    "parent_id": "note_cryptography",
    "tags": ["quantum", "crypto"],
    "aliases": ["QKD"],
    "note_type": "concept"
  }
  ```
- **Response:** `201 Created` — `Note`

### `PUT /api/v1/notes/{id}`
Update an existing note with optimistic concurrency check.
- **Request Body:**
  ```json
  {
    "title": "Quantum Key Distribution (QKD)",
    "content": "# Updated Content...",
    "tags": ["quantum", "crypto", "security"],
    "expected_hash": "a1b2c3d4..."
  }
  ```
- **Response:** `200 OK` — `Note` (or `409 Conflict` if hash mismatch)

### `DELETE /api/v1/notes/{id}`
Delete note. Safe reparenting automatically lifts direct children to this note's parent.
- **Response:** `204 No Content`

### `POST /api/v1/notes/{id}/move`
Move note in the hierarchy with DAG cycle prevention.
- **Request Body:** `{"new_parent_id": "new_parent_id_or_null"}`
- **Response:** `200 OK` — `Note`

---

## 2. Graph API

### `GET /api/v1/graph`
Retrieve graph nodes and edges for visualization.
- **Query Parameters:**
  - `root_id` (optional string): If provided, returns neighborhood subgraph
  - `depth` (integer, default 2): Traversal depth for BFS
  - `tag` (optional string): Filter nodes by tag
  - `note_type` (optional string): Filter nodes by note type
  - `include_broken` (boolean, default false): Include unresolved links
- **Response:** `200 OK` — `GraphData`

### `POST /api/v1/graph/layout`
Save 2D canvas coordinates for graph nodes.
- **Request Body:**
  ```json
  {
    "positions": {
      "note_01": {"x": 250.5, "y": 120.0},
      "note_02": {"x": 400.0, "y": 300.0}
    }
  }
  ```
- **Response:** `200 OK`

### `POST /api/v1/graph/relationships`
Create explicit typed relationship between two notes.
- **Request Body:** `{"source_id": "id1", "target_id": "id2", "relation_type": "depends_on", "label": "Requires"}`
- **Response:** `201 Created`

---

## 3. Search API

### `GET /api/v1/search`
Perform full-text ranked query across vault notes.
- **Query Parameters:**
  - `q` (string): Search query
  - `tag` (optional string): Filter tag
  - `limit` (int, default 50)
- **Response:** `200 OK` — `{"results": [...], "total": 12, "query": "crypto"}`

### `GET /api/v1/search/autocomplete`
Fast link autocomplete for `[[` typing.
- **Query Parameters:** `q` (string)
- **Response:** `200 OK` — `List[AutocompleteItem]`

---

## 4. Backups API

### `GET /api/v1/backups`
List available verified backups.
- **Response:** `200 OK` — `List[BackupSummary]`

### `POST /api/v1/backups`
Create verified timestamped backup archive with SHA-256 manifest.
- **Request Body:** `{"custom_name": "pre-migration-snapshot"}`
- **Response:** `201 Created` — `BackupSummary`

### `POST /api/v1/backups/restore`
Execute staged restore of backup.
- **Request Body:**
  ```json
  {
    "backup_filename": "Vault_Backup_2026-10-10_220000.zip",
    "in_place": true,
    "create_pre_restore_backup": true
  }
  ```
- **Response:** `200 OK` — `RestoreResult`

---

## 5. Exports API

### `POST /api/v1/exports/preview`
Get estimated size, note count, and manifest of planned export.
- **Request Body:** `ExportRequest`
- **Response:** `200 OK` — `ExportPreview`

### `POST /api/v1/exports/generate`
Generate PDF, HTML, Markdown ZIP, or JSON package.
- **Request Body:** `ExportRequest`
- **Response:** `200 OK` — `ExportResult`

---

## 6. System & Diagnostics API

### `GET /health`
System liveness check and vault root status.

### `GET /api/v1/system/diagnostics`
Run integrity scan: broken links, missing attachments, orphaned attachments, disk usage.

### `POST /api/v1/system/reindex`
Reconstruct derived SQLite cache from disk Markdown files.

### `POST /api/v1/system/switch-vault`
Switch active vault directory without restarting server process.
