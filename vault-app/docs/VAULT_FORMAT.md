# Vault Storage & Note Format Specification

## 1. Node Plaintext Format

Every note in Vault is an independently readable and editable Markdown (`.md`) file located in the `nodes/` directory. Notes begin with a YAML frontmatter block enclosed between triple dashes (`---`).

```markdown
---
id: note_20261010_01
title: Zero-Trust Architecture Principles
created_at: '2026-10-10T21:57:38Z'
modified_at: '2026-10-10T22:15:00Z'
parent_id: note_20261010_root
tags:
  - architecture
  - security
  - zerotrust
aliases:
  - ZTA
  - BeyondCorp Model
note_type: concept
relations:
  - target_id: note_identity_governance
    type: depends_on
    label: Requires strong identity foundation
  - target_id: note_microsegmentation
    type: implements
    label: Network layer enforcement
custom_properties:
  criticality: tier-1
  compliance: nist-800-207
content_hash: a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0
---

# Zero-Trust Architecture Principles

Zero-Trust is a security paradigm founded on the core principle: **Never Trust, Always Verify**.

## Core Tenets
1. Continuous verification across all access requests.
2. Explicit authorization relying on dynamic context.
3. Least privilege access controls.

## Related Concepts
- Read more about [[Identity and Access Governance]]
- Inspect our [[Microsegmentation Blueprint]]

![Zero-Trust Architecture Diagram](attachments/images/zta-reference-diagram.png)
```

---

## 2. Frontmatter Schema Details

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Stable unique identifier for the note (e.g. slug or uuid). |
| `title` | `string` | **Yes** | Human-readable title of the note. |
| `created_at` | `string` (ISO 8601) | **Yes** | UTC creation timestamp (e.g. `2026-10-10T21:57:38Z`). |
| `modified_at` | `string` (ISO 8601) | **Yes** | UTC modification timestamp. |
| `parent_id` | `string \| null` | No | Parent note ID in the organizational hierarchy (`null` = root). |
| `tags` | `string[]` | No | List of descriptive tags without `#` prefix (lowercase normalized). |
| `aliases` | `string[]` | No | Alternative titles for link autocomplete and resolution. |
| `note_type` | `string` | No | Semantic category: `concept`, `project`, `standard`, `reference`, `daily`, `journal`. |
| `relations` | `array` | No | Explicit typed relationships (see Section 3). |
| `custom_properties` | `object` | No | Arbitrary user-defined key-value metadata. |
| `content_hash` | `string` | Internal | SHA-256 hash of normalized frontmatter + content body. |

---

## 3. Link & Relationship Syntax

### Inline Wiki-Links
Vault supports standard double-bracket wiki-link formats inside note bodies:

1. **Title Link:** `[[Zero-Trust Architecture Principles]]`
2. **Aliased Link:** `[[Zero-Trust Architecture Principles|ZTA Architecture]]`
3. **Anchor Link:** `[[Zero-Trust Architecture Principles#Core Tenets]]`
4. **Anchor + Display:** `[[Zero-Trust Architecture Principles#Core Tenets|Tenets]]`

When a note is renamed, Vault provides link rewriting across the vault to preserve cross-note integrity.

### Explicit Typed Relations
In addition to body wiki-links, notes support directed, typed graph edges defined in the YAML frontmatter:

```yaml
relations:
  - target_id: target_note_id
    type: references   # references | depends_on | relates_to | implements | extends
    label: Contextual descriptor
```

---

## 4. Attachment Management

Attachments reside in `attachments/`:
- `attachments/images/` : `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`
- `attachments/documents/` : `.pdf`, `.docx`, `.xlsx`, `.txt`, `.csv`
- `attachments/other/` : Archives, binaries, and miscellaneous assets

Embedded in Markdown using standard relative link syntax:
- Image: `![Diagram](attachments/images/sample.png)`
- File link: `[Spec Document](attachments/documents/spec.pdf)`

---

## 5. Configuration File (`.vault-config.yaml`)

```yaml
vault_version: "1.0.0"
vault_name: "Personal Cybersecurity Vault"
created_at: "2026-10-10T21:57:38Z"
default_note_type: "concept"
autosave_debounce_ms: 2000
backup_retention_count: 10
auto_backup_on_startup: false
```
