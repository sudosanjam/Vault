<p align="center">
  <img src="vault-app/frontend/public/logo.png" alt="Vault Logo" width="128" height="128" style="image-rendering: pixelated;" />
</p>

# Vault: Local-First Personal Knowledge Graph System

<p align="center">
  <strong>Private. Graph-Native. Plaintext-Durable. Zero Cloud Dependencies.</strong>
</p>

Vault is a production-quality, local-first personal knowledge management application. Every note is an independently addressable node stored as standard Markdown with YAML frontmatter.

---

## Quick Start (Classic Game Executables & Scripts)

### Windows Executable Suite (Classic Game Style)
- **First-Time Setup:** Run [`setup.exe`](setup.exe) ([`setup.ico`](setup.ico))
  - Vintage PC installer console that validates Python 3 and Node.js, installs dependencies, builds the frontend, links attachments, and **generates `vault.exe`**.
- **Launch Vault:** Double-click [`vault.exe`](vault.exe) ([`vault.ico`](vault.ico)) (generated upon running `setup.exe`).
- **Update Application:** Run [`update.exe`](update.exe) ([`update.ico`](update.ico))
  - Checks GitHub (`sudosanjam/Vault`) for incoming patches, compares commits, pulls updates, rebuilds the application, and relaunches `vault.exe`.
- **Scripts Alternative:** [`start.bat`](start.bat) / [`start.ps1`](start.ps1) and [`stop.bat`](stop.bat) / [`stop.ps1`](stop.ps1).

---

## Color Themes & Atmospheric Palettes

| Palette | Base Canvas | Accent Primary | Accent Secondary | Atmosphere |
| --- | --- | --- | --- | --- |
| **Obsidian** | `#0e0f15` (Slate Obsidian) | `#89b4fa` (Celestial Blue) | `#cba6f7` (Mocha Lavender) | Clean Apple Pro modern dark |
| **Coffee** | `#120e0c` (Espresso Dark) | `#d4a373` (Caramel Mocha) | `#e0a96d` (Warm Hazelnut) | Warm roasted dark brown |
| **Ruby** | `#13080b` (Midnight Bordeaux) | `#f38ba8` (Velvet Crimson) | `#f2cdcd` (Pastel Rose) | Rich burgundy velvet |
| **Sapphire** | `#080d16` (Ocean Abyss) | `#38bdf8` (Electric Cyan) | `#818cf8` (Royal Azure) | Deep midnight oceanic navy |
| **Emerald** | `#07120d` (Pine Forest) | `#5eead4` (Pastel Mint) | `#a6e3a1` (Sage Green) | Botanical alpine pine |
| **Amethyst** | `#0e0817` (Deep Cosmic) | `#c084fc` (Radiant Violet) | `#f5c2e7` (Lilac Stardust) | Cosmic cyber lavender |

Switch palettes seamlessly inside **System Preferences** (Preferences & Settings).

---

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

### Android (Termux)
- **One-Click Install & Run:** Run [`./install_termux`](install_termux) (or [`./install_termux.sh`](install_termux.sh))
  ```bash
  pkg update && pkg install git
  git clone https://github.com/sudosanjam/Vault.git
  cd Vault
  chmod +x install_termux install_termux.sh start_termux.sh stop_termux.sh
  ./install_termux
  ```
  - Automatically installs Termux Python, Node.js LTS, and native compiler packages.
  - Prepares virtualenv and compiles production frontend SPA.
  - Launches Vault on `127.0.0.1:8000` and automatically opens Chrome or your default Android browser.
- **Start Later:** Run [`./start_termux.sh`](start_termux.sh)
- **Stop Server:** Run [`./stop_termux.sh`](stop_termux.sh)

---

## Quick Navigation

- **Application Directory:** [`vault-app/`](vault-app/)
- **Launch Scripts:**
  - Windows: [`start.bat`](start.bat) / [`start.ps1`](start.ps1)
  - Linux: [`start.sh`](start.sh)
  - Android (Termux): [`install_termux`](install_termux) / [`start_termux.sh`](start_termux.sh)
- **Stop Scripts:**
  - Windows: [`stop.bat`](stop.bat) / [`stop.ps1`](stop.ps1)
  - Linux: [`stop.sh`](stop.sh)
  - Android (Termux): [`stop_termux.sh`](stop_termux.sh)
- **Setup Scripts (Manual/Prerequisites Only):**
  - Windows: [`setup.bat`](setup.bat) / [`setup.ps1`](setup.ps1)
  - Linux: [`setup.sh`](setup.sh) (or `./start.sh --setup-only`)
  - Android (Termux): [`install_termux.sh`](install_termux.sh)
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
