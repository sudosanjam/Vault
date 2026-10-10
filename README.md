# Vault: Local-First Personal Knowledge Graph System

<p align="center">
  <strong>Private. Graph-Native. Plaintext-Durable. Zero Cloud Dependencies.</strong>
</p>

Vault is a production-quality, local-first personal knowledge management application. Every note is an independently addressable node stored as standard Markdown with YAML frontmatter.

---

## Quick Start (One-Click)

- **First-Time Setup & Launch:** Double-click [`start.bat`](start.bat) (or run `./start.ps1`) in the root directory.
  - Automatically installs dependencies, builds the frontend, starts the local server, and opens `http://127.0.0.1:8000`.
- **Manual Setup Only:** Double-click [`setup.bat`](setup.bat) (or run `./setup.ps1`).

---

## Quick Navigation

- **Application Directory:** [`vault-app/`](vault-app/)
- **Launch Script:** [`start.bat`](start.bat) (PowerShell: [`start.ps1`](start.ps1))
- **Setup Script:** [`setup.bat`](setup.bat) (PowerShell: [`setup.ps1`](setup.ps1))
- **Test Runner:** [`vault-app/scripts/test.bat`](vault-app/scripts/test.bat) (PowerShell: [`test.ps1`](vault-app/scripts/test.ps1))
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
