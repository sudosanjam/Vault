#!/usr/bin/env python3
"""
Vault Restore CLI Utility.
Safely restores a backup archive with SHA-256 verification and atomic file updates.
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
from app.models.backup import RestoreRequest
from app.services.backup_service import BackupService


def main():
    parser = argparse.ArgumentParser(description="Vault Restore Management CLI")
    parser.add_argument("backup_file", type=str, help="Filename of backup archive in backups/ or absolute path")
    parser.add_argument(
        "--vault-dir",
        "-v",
        type=str,
        default=os.environ.get("VAULT_DIRECTORY", str(script_dir.parent.parent / "VaultSample")),
        help="Path to live vault directory",
    )
    parser.add_argument(
        "--target-dir",
        "-t",
        type=str,
        default=None,
        help="Optional new directory to extract into instead of live vault",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        default=True,
        help="Restore into live vault directory",
    )
    parser.add_argument(
        "--no-pre-backup",
        action="store_true",
        help="Skip automatic pre-restore safety snapshot",
    )

    args = parser.parse_args()
    vault_path = Path(args.vault_dir).resolve()

    vault_mgr = VaultManager(vault_path)
    db = Database(vault_mgr)
    indexer = Indexer(vault_mgr, db)
    backup_service = BackupService(vault_mgr, indexer)

    backup_name = args.backup_file
    if Path(backup_name).is_file():
        backup_name = Path(backup_name).name

    req = RestoreRequest(
        backup_filename=backup_name,
        in_place=args.target_dir is None,
        target_directory=args.target_dir,
        create_pre_restore_backup=not args.no_pre_backup,
    )

    print(f"[*] Restoring vault from backup: {backup_name}...")
    try:
        res = backup_service.restore_backup(req)
        print(f"[+] Restore completed successfully!")
        print(f"    Restored files : {res['restored_files_count']}")
        print(f"    Target path    : {res['target_path']}")
        if res.get("pre_restore_backup"):
            print(f"    Safety backup  : {res['pre_restore_backup']}")
    except Exception as e:
        print(f"[-] Restore error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
