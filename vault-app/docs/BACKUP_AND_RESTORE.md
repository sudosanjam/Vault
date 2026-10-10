# Vault Backup, Verification & Staged Restore Specification

## 1. Overview

Vault treats user notes and assets as mission-critical data. The backup and restoration engine provides:
1. **Deterministic Cryptographic Verification:** Every backup archive includes an internal `manifest.json` with file paths, sizes, and SHA-256 hashes for all included files.
2. **Safe Staged Restoration:** Backups are unpacked into a temporary sandbox and cryptographically validated before touching live vault files.
3. **Automatic Pre-Restore Safety Snapshots:** Prior to any in-place restoration, a safety snapshot of the active vault state is created automatically.
4. **Path Traversal Protection:** Archive extractors inspect all paths to prevent `ZipSlip` directory traversal attacks.

---

## 2. Backup Archive Structure

```
Vault_Backup_2026-10-10_221500_milestone.zip
├── manifest.json              # Signed file list with SHA-256 hashes
├── .vault-config.yaml         # Configuration file
├── nodes/                     # All markdown notes
│   ├── note-01.md
│   └── note-02.md
├── attachments/               # All attachments
│   ├── images/
│   └── documents/
└── metadata/                  # Graph layouts and user properties
    └── graph-layouts.json
```

### `manifest.json` Format
```json
{
  "backup_format_version": "1.0.0",
  "app_version": "1.0.0",
  "vault_name": "Personal Cybersecurity Vault",
  "created_at": "2026-10-10T22:15:00Z",
  "note_count": 42,
  "attachment_count": 8,
  "total_size_bytes": 1420580,
  "files": [
    {
      "path": "nodes/zero-trust.md",
      "size_bytes": 1824,
      "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
    },
    {
      "path": "attachments/images/diagram.png",
      "size_bytes": 128900,
      "sha256": "8a05c747970d4c82c334005b4e33918a2d33d45c85d778d9b1c775ec0b4e073c"
    }
  ]
}
```

---

## 3. Staged Restoration Protocol

```
[User triggers Restore]
         │
         ▼
[1. Path Traversal Check] ──► Checks archive member filenames for ".." or absolute paths
         │
         ▼
[2. Temporary Sandbox Extraction] ──► Extracts into metadata/.tmp/staged_restore_xxxx/
         │
         ▼
[3. SHA-256 Manifest Verification] ──► Computes hash of every file and compares with manifest.json
         │
         ├─► Integrity mismatch? ──► Abort & delete sandbox (Error returned to user)
         │
         ▼
[4. Automatic Safety Snapshot] ──► Creates "pre_restore_safety_snapshot.zip" of current vault
         │
         ▼
[5. Atomic Promotion to Live Vault] ──► Moves validated files into nodes/ & attachments/
         │
         ▼
[6. SQLite Index Reconstruction] ──► Indexer runs rebuild_full_index()
         │
         ▼
[7. Sandbox Cleanup & Success Confirmation]
```

---

## 4. Disaster Recovery & CLI Usage

Backups can be inspected, created, and restored completely outside the web UI via the Python CLI scripts:

### Create a Backup via CLI
```bash
python scripts/backup.py create --name "pre-upgrade"
```

### List and Verify Backups
```bash
python scripts/backup.py list
python scripts/backup.py verify Vault_Backup_2026-10-10_221500.zip
```

### Restore Vault from Backup
```bash
python scripts/restore.py Vault_Backup_2026-10-10_221500.zip
```

### Extract into a Clean Directory (Non-destructive)
```bash
python scripts/restore.py Vault_Backup_2026-10-10_221500.zip --target-dir "C:\RestoredVault"
```
