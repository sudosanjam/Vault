#!/usr/bin/env python3
"""
Vault Index Rebuilder CLI Utility.
Scans all Markdown notes in nodes/ and reconstructs the SQLite WAL + FTS5 search index from scratch.
"""

import argparse
import os
from pathlib import Path
import sys
import time

# Add backend directory to sys.path
script_dir = Path(__file__).resolve().parent
backend_dir = script_dir.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.vault import VaultManager
from app.db.database import Database
from app.db.indexer import Indexer


def main():
    parser = argparse.ArgumentParser(description="Rebuild Vault SQLite Index")
    parser.add_argument(
        "--vault-dir",
        "-v",
        type=str,
        default=os.environ.get("VAULT_DIRECTORY", str(script_dir.parent.parent / "VaultSample")),
        help="Path to vault root directory",
    )

    args = parser.parse_args()
    vault_path = Path(args.vault_dir).resolve()

    if not vault_path.exists():
        print(f"Error: Vault path does not exist: {vault_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Initializing Vault indexer for: {vault_path}...")
    vault_mgr = VaultManager(vault_path)
    db = Database(vault_mgr)
    indexer = Indexer(vault_mgr, db)

    start_time = time.perf_counter()
    result = indexer.rebuild_full_index()
    elapsed = time.perf_counter() - start_time

    print(f"[+] Full SQLite index rebuild complete!")
    print(f"    Nodes indexed : {result.get('nodes_indexed', 0)}")
    print(f"    Elapsed time  : {elapsed * 1000:.2f} ms")
    print(f"    Cache path    : {vault_mgr.cache_dir / 'vault-index.db'}")


if __name__ == "__main__":
    main()
