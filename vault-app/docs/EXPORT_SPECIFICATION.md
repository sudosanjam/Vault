# Vault Portable Export Specification

## 1. Export Overview

Vault provides multi-format, multi-scope export engines that transform local knowledge graphs into portable documents and standalone archives.

Exports are generated on-demand and stored in `exports/`.

---

## 2. Export Scopes

1. **Single Note (`single`):**
   - Exports the selected active note and its referenced attachments.
2. **Subtree Hierarchy (`subtree`):**
   - Recursively traverses from a root note down all child branches.
   - Orders notes logically based on hierarchy depth.
3. **Entire Vault (`vault`):**
   - Bundles all notes, hierarchical relationships, attachments, and metadata.
4. **Arbitrary Selection (`selection`):**
   - Exports an explicit list of note IDs chosen by the user.

---

## 3. Supported Export Formats

### 1. High-Fidelity PDF (`format=pdf`)
- Rendered locally using **headless Chromium (Playwright)**.
- Full CSS typography, code syntax highlighting, embedded tables, and vector layout.
- Self-contained: Images and attachments are inlined as base64 data URIs so that the PDF requires zero external resources.
- Configurable margins, headers, and footer page numbering.

### 2. Standalone HTML (`format=html`)
- Single self-contained HTML file.
- Embedded CSS styles and base64 encoded images.
- Ideal for sharing research notes via email or viewing offline in any browser without installing dependencies.

### 3. Portable Markdown Archive (`format=markdown` / `zip`)
- ZIP archive containing clean, portable Markdown files.
- Internal wiki-links (`[[Note Title]]`) are preserved or optionally rewritten to relative Markdown links (`[Note Title](note-title.md)`).
- All referenced image and document attachments are bundled in an `attachments/` folder.

### 4. Machine-Readable Knowledge Graph JSON (`format=json`)
- Graph interchange format containing:
  ```json
  {
    "export_format": "vault-graph-v1",
    "exported_at": "2026-10-10T22:15:00Z",
    "nodes": [
      {
        "id": "note_01",
        "title": "Zero-Trust Architecture",
        "tags": ["security"],
        "note_type": "concept",
        "parent_id": null,
        "content": "..."
      }
    ],
    "edges": [
      {
        "source": "note_01",
        "target": "note_02",
        "relation_type": "references"
      }
    ]
  }
  ```

---

## 4. Link Resolution Policies

When exporting a subset of notes (Single or Subtree):
- **`preserve`:** Keeps `[[Note Title]]` as plaintext wiki-links.
- **`mark`:** Adds a subtle visual indicator (e.g. `[[Target Note (External)]]`) showing that the target note is outside the exported scope.
- **`include`:** Automatically pulls in 1-hop neighbor notes referenced by the exported set.
