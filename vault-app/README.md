# Vault — Local-First Personal Knowledge Graph & Information Management System

<p align="center">
  <strong>Private. Graph-Native. Plaintext-Durable. Zero Cloud Dependencies.</strong>
</p>

---

## Highlights

- **Local-First & Plaintext Source of Truth:** Every note is an independently addressable Markdown file with YAML frontmatter. If the database cache is lost, the entire vault reconstructs in seconds.
- **Fast SQLite & FTS5 Indexing:** Sub-10ms full-text searches, automatic backlinks, and high-performance graph queries powered by SQLite WAL mode.
- **Interactive Knowledge Graph:** 2D interactive canvas powered by React Flow with global graph view, local neighborhood depth traversal, customizable layout saving, and typed edges.
- **Rich Editor & Markdown Preview:** WYSIWYG rich text editing powered by Tiptap with `[[wikilink]]` autocomplete, checklists, tables, code blocks, and instant raw markdown toggle.
- **Portable Multi-Scope Exports:** Generate professional PDF reports with embedded Chromium, standalone single-file HTML pages, Markdown ZIP bundles, or JSON knowledge graphs.
- **Cryptographic Backups & Staged Restore:** SHA-256 verified ZIP archives, staged integrity verification sandbox, and automatic pre-restore safety snapshots.
- **Zero Cloud & Security Guardrails:** Runs strictly on `127.0.0.1:8000` with boundary traversal protection and optimistic concurrency collision detection.

---

## Quickstart

### Prerequisites (Auto-Installed if Missing)
- Python 3.10+ (Tested on Python 3.13)
- Node.js 18+ & npm
*(On a clean Windows or Linux machine, the launch and setup scripts detect missing prerequisites and install them automatically!)*

### One-Click Launch (Windows)
Double-click `start.bat` in the repository root (or run in PowerShell):
```powershell
.\start.ps1
```
This single script will:
1. Verify Python and Node.js/npm (automatically installing them if missing).
2. Set up the Python virtual environment and install backend requirements.
3. Install headless Chromium via Playwright for PDF export.
4. Install frontend npm dependencies and compile the production bundle.
5. Launch the local FastAPI server and open `http://127.0.0.1:8000` in your default browser.

### One-Click Launch (Linux)
Run the single all-in-one script:
```bash
chmod +x start.sh && ./start.sh
```
This automatically detects your Linux distribution package manager (`apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk`), installs required system packages, builds frontend assets, and launches the server.

### Manual Setup Only (Without Starting Server)
- **Windows:** Double-click `setup.bat` or run `.\setup.ps1`
- **Linux:** Run `./start.sh --setup-only` or `./setup.sh`

### Stopping Vault Server
- **Windows:** Double-click `stop.bat` or run `.\stop.ps1`
- **Linux:** Run `./stop.sh`

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Ctrl + K`** | Open Global Search modal with full-text search & snippet preview |
| **`Ctrl + N`** | Create a new note |
| **`Ctrl + S`** | Save current active note immediately |
| **`Ctrl + E`** | Open Export & Sharing modal |
| **`Ctrl + B`** | Open Backups & Snapshots modal |
| **`Ctrl + 1`** | Switch to Note Editor view |
| **`Ctrl + 2`** | Switch to Interactive Graph view |
| **`Ctrl + 3`** | Switch to Tabular Metadata view |
| **`Ctrl + \`** | Toggle Left Explorer sidebar |
| **`Ctrl + ]`** | Toggle Right Inspector sidebar |

---

## Technical Architecture

```
vault-app/
├── backend/
│   ├── app/
│   │   ├── api/v1/         # FastAPI REST routers (notes, graph, search, etc.)
│   │   ├── core/           # Frontmatter parser, link extractor, VaultManager
│   │   ├── db/             # SQLite connection pool, schema, FTS5 indexer
│   │   ├── models/         # Pydantic data schemas & response models
│   │   ├── services/       # Note CRUD, Graph BFS, Search, Backups, Exports
│   │   └── main.py         # App lifespan, CORS, and single-origin static mount
│   ├── tests/              # Pytest test suite (17 tests, 100% passing)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Editor, GraphView, TableView, Explorer, Modals
│   │   ├── state/          # VaultContext & ThemeContext
│   │   ├── api/            # Type-safe API client
│   │   └── types/          # TypeScript interface definitions
│   ├── dist/               # Production bundle served by FastAPI
│   └── package.json
├── docs/                   # Detailed architectural and format specs
└── scripts/                # Setup, launch, testing, and benchmark utilities
```

---

## Documentation Links

- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Vault Storage & Note Format Specification](docs/VAULT_FORMAT.md)
- [REST API v1 Documentation](docs/API_DOCUMENTATION.md)
- [Backup, Verification & Staged Restore Protocol](docs/BACKUP_AND_RESTORE.md)
- [Portable Export Specification](docs/EXPORT_SPECIFICATION.md)

---

## Running Benchmarks & Tests

### Run Test Suite
```powershell
.\scripts\test.ps1
```

### Run Performance Benchmarks
```bash
python scripts/benchmark.py --count 1000
```
Measures throughput on 1,000 synthetic notes:
- **Disk write throughput:** ~500 files/sec
- **Index rebuild speed:** ~130 notes/sec
- **FTS5 search latency:** ~5.6 ms
- **Local Graph BFS (depth 2):** ~6.6 ms
- **Hierarchy tree build:** ~16 ms
