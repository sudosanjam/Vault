# Vault: Local-First Personal Knowledge Graph System

<p align="center">
  <strong>Private. Graph-Native. Plaintext-Durable. Zero Cloud Dependencies.</strong>
</p>

Vault is a production-quality, local-first personal knowledge management application. Every note is an independently addressable node stored as standard Markdown with YAML frontmatter.

---

## Quick Start (One-Click)

### Windows
- **Launch Vault:** Double-click [`start.bat`](start.bat) (or run `.\start.ps1` in PowerShell).
  - Automatically verifies all prerequisites (Python 3.10+, Node.js 18+, npm).
  - If any requirement is missing on a fresh Windows install, **it is automatically installed**.
  - Configures the Python virtualenv, installs backend packages, installs Playwright Chromium, builds the frontend SPA, launches the server, and automatically opens `http://127.0.0.1:8000`.
- **Stop Server:** Double-click [`stop.bat`](stop.bat) (or run `.\stop.ps1`).
- **Setup Only (Without Starting):** Double-click [`setup.bat`](setup.bat) (or run `.\setup.ps1`).

### Linux
- **Launch Vault (All-In-One Script):** Run [`./start.sh`](start.sh)
  ```bash
  chmod +x start.sh && ./start.sh
  ```
  - Automatically detects Linux distribution (`apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk`).
  - Checks and automatically installs missing system packages (`python3`, `python3-venv`, `python3-pip`, `nodejs`, `npm`, `curl`).
  - Configures the environment, builds the production frontend, launches the server, and opens your browser.
- **Stop Server:** Run [`./stop.sh`](stop.sh)
- **Setup Only:** Run [`./start.sh --setup-only`](start.sh) or [`./setup.sh`](setup.sh)

---

## Quick Navigation

- **Application Directory:** [`vault-app/`](vault-app/)
- **Launch Scripts:**
  - Windows: [`start.bat`](start.bat) / [`start.ps1`](start.ps1)
  - Linux: [`start.sh`](start.sh)
- **Stop Scripts:**
  - Windows: [`stop.bat`](stop.bat) / [`stop.ps1`](stop.ps1)
  - Linux: [`stop.sh`](stop.sh)
- **Setup Scripts (Manual/Prerequisites Only):**
  - Windows: [`setup.bat`](setup.bat) / [`setup.ps1`](setup.ps1)
  - Linux: [`setup.sh`](setup.sh) (or `./start.sh --setup-only`)
- **Test Runners:**
  - Windows: [`vault-app/scripts/test.bat`](vault-app/scripts/test.bat) / [`test.ps1`](vault-app/scripts/test.ps1)
  - Linux: [`vault-app/scripts/test.sh`](vault-app/scripts/test.sh)
- **Benchmark Utility:** [`vault-app/scripts/benchmark.py`](vault-app/scripts/benchmark.py)

---

## Core Capabilities

1. **Local-First & Plaintext Source of Truth**
   - Notes live in `nodes/*.md` with YAML frontmatter.
   - Attachments live in `attachments/`.
   - SQLite database cache in `.vault-cache/` is 100% derived and rebuildable at any time.
2. **Interactive 2D Knowledge Graph Visualizer**
   - Powered by React Flow (`@xyflow/react`).
   - Global graph and local subgraph BFS neighborhood inspection with adjustable depth.
   - Draggable node positioning with persistent coordinate layouts.
3. **Rich WYSIWYG & Markdown Editor**
   - Powered by Tiptap with `[[wikilink]]` typing triggers and auto-complete popup.
   - Checklist items, formatted tables, code blocks, and instant raw markdown toggle.
4. **Hierarchical Tree & Metadata Table**
   - Full nested directory/parent tree with descendant counts.
   - Sortable, filterable metadata table by title, note type, tags, modified date, link degree, and attachments.
5. **Portable Multi-Format Exports**
   - Headless Chromium (Playwright) generates standalone, self-contained PDF documents with inlined base64 images and vector layout.
   - Single-file offline HTML, Markdown ZIP packages, and Knowledge Graph JSON bundles.
6. **Cryptographic Backups & Staged Restore**
   - Timestamped ZIP archives with internal SHA-256 `manifest.json`.
   - Staged sandbox unpacking with checksum validation prior to live vault promotion.
   - Automatic pre-restore safety snapshot.
7. **Security & Performance**
   - Single-origin loopback serving on `127.0.0.1:8000` (zero cloud dependencies).
   - Strict boundary traversal protection against path injection.
   - Optimistic concurrency control via SHA-256 `content_hash` matching.
   - Benchmarked at sub-10ms search latency on 1,000+ notes.

---

## Detailed Specifications

- [System Architecture](vault-app/docs/ARCHITECTURE.md)
- [Vault Storage & Note Format](vault-app/docs/VAULT_FORMAT.md)
- [REST API v1 Reference](vault-app/docs/API_DOCUMENTATION.md)
- [Backup & Disaster Recovery Protocol](vault-app/docs/BACKUP_AND_RESTORE.md)
- [Export Specification](vault-app/docs/EXPORT_SPECIFICATION.md)
