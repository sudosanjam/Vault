#!/usr/bin/env python3
"""
Vault Backup CLI Utility.
Allows creating, listing, and verifying cryptographic SHA-256 backup archives directly from terminal.
"""

import argparse
import os
from pathlib import Path
import sys

# Add backend directory to sys.path
script_dir = Path(__file__).resolve().parent
backend_dir = script_dir.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.vault import VaultManager
from app.db.database import Database
from app.db.indexer import Indexer
from app.services.backup_service import BackupService


def main():
    parser = argparse.ArgumentParser(description="Vault Backup Management CLI")
    parser.add_argument(
        "--vault-dir",
        "-v",
        type=str,
        default=os.environ.get("VAULT_DIRECTORY", str(script_dir.parent.parent / "VaultSample")),
        help="Path to vault root directory",
    )
    
    subparsers = parser.add_subparsers(dest="action", help="Backup action")
    
    # Create
    create_p = subparsers.add_parser("create", help="Create a new timestamped backup")
    create_p.add_argument("--name", "-n", type=str, default=None, help="Custom memo or descriptor")
    
    # List
    subparsers.add_parser("list", help="List all existing backup snapshots")
    
    # Verify
    verify_p = subparsers.add_parser("verify", help="Verify SHA-256 manifest integrity of a backup")
    verify_p.add_argument("filename", type=str, help="Backup ZIP filename")

    args = parser.parse_args()

    vault_path = Path(args.vault_dir).resolve()
    if not vault_path.exists():
        print(f"Error: Vault path does not exist: {vault_path}", file=sys.stderr)
        sys.exit(1)

    vault_mgr = VaultManager(vault_path)
    db = Database(vault_mgr)
    indexer = Indexer(vault_mgr, db)
    backup_service = BackupService(vault_mgr, indexer)

    if args.action == "create" or args.action is None:
        name = getattr(args, "name", None)
        print(f"[*] Creating backup of vault: {vault_path}...")
        summary = backup_service.create_backup(custom_name=name)
        print(f"[+] Backup created successfully!")
        print(f"    Filename : {summary.filename}")
        print(f"    Notes    : {summary.note_count}")
        print(f"    Files    : {summary.file_size_bytes} bytes")
        print(f"    Manifest : {'Verified (SHA-256)' if summary.is_valid else 'No manifest'}")

    elif args.action == "list":
        backups = backup_service.list_backups()
        print(f"Found {len(backups)} backups in {vault_mgr.backups_dir}:")
        print("-" * 75)
        for b in backups:
            mb = b.file_size_bytes / (1024 * 1024)
            print(f"  {b.filename:<45} {mb:>6.2f} MB | {b.note_count:>4} notes | {b.created_at}")
        print("-" * 75)

    elif args.action == "verify":
        archive_path = vault_mgr.backups_dir / args.filename
        if not archive_path.exists():
            print(f"Error: Backup file not found: {archive_path}", file=sys.stderr)
            sys.exit(1)

        print(f"[*] Verifying archive integrity: {args.filename}...")
        is_valid, msg, manifest = backup_service.verify_backup_archive(archive_path)
        if is_valid:
            print(f"[+] Backup verification PASSED: {msg}")
            if manifest:
                print(f"    Manifest version : {manifest.backup_format_version}")
                print(f"    Total files      : {len(manifest.files)}")
                print(f"    Created at       : {manifest.created_at}")
        else:
            print(f"[-] Backup verification FAILED: {msg}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
