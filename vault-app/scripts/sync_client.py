#!/usr/bin/env python3
"""
Vault LAN Sync Client
─────────────────────
Pull notes and attachments from a Vault desktop server over your local network.
Works on Android (Termux), Linux, macOS, and Windows.

Usage:
  python sync_client.py --host 192.168.1.42
  python sync_client.py --host 192.168.1.42 --port 8000 --output ~/vault-sync
  python sync_client.py --host 192.168.1.42 --watch --interval 120

Requirements: Python 3.6+ (stdlib only — no pip packages needed)
"""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


# ─── ANSI colors (auto-disabled if terminal doesn't support them) ─────────────
def _supports_color():
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

GREEN  = "\033[92m"  if _supports_color() else ""
YELLOW = "\033[93m"  if _supports_color() else ""
RED    = "\033[91m"  if _supports_color() else ""
CYAN   = "\033[96m"  if _supports_color() else ""
BOLD   = "\033[1m"   if _supports_color() else ""
RESET  = "\033[0m"   if _supports_color() else ""


# ─── HTTP helpers ─────────────────────────────────────────────────────────────

def fetch_json(base_url: str, path: str):
    """Fetch and parse a JSON response from the Vault API."""
    url = f"{base_url}{path}"
    try:
        req = Request(url, headers={"Accept": "application/json", "User-Agent": "VaultSyncClient/1.0"})
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        print(f"{RED}[HTTP {e.code}]{RESET} GET {url}: {e.reason}")
        return None
    except URLError as e:
        print(f"{RED}[ERROR]{RESET} Cannot reach {url}: {e.reason}")
        return None
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} GET {url}: {e}")
        return None


def fetch_raw(base_url: str, path: str) -> bytes | None:
    """Fetch raw binary content from the Vault API (for notes and images)."""
    url = f"{base_url}{path}"
    try:
        req = Request(url, headers={"User-Agent": "VaultSyncClient/1.0"})
        with urlopen(req, timeout=30) as resp:
            return resp.read()
    except HTTPError as e:
        print(f"{RED}[HTTP {e.code}]{RESET} GET {url}: {e.reason}")
        return None
    except URLError as e:
        print(f"{RED}[ERROR]{RESET} Cannot reach {url}: {e.reason}")
        return None
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} GET {url}: {e}")
        return None


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


# ─── Core sync logic ──────────────────────────────────────────────────────────

def sync_once(base_url: str, out_dir: Path, verbose: bool = True) -> bool:
    """
    Perform a single sync pass: fetch manifest, compare hashes, download changed files.
    Returns True on success, False if the manifest couldn't be fetched.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    nodes_dir  = out_dir / "nodes"
    images_dir = out_dir / "attachments" / "images"
    nodes_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    manifest = fetch_json(base_url, "/api/v1/sync/manifest")
    if manifest is None:
        print(f"{RED}[FAIL]{RESET} Could not fetch manifest. Is Vault running and LAN mode enabled?")
        return False

    notes       = manifest.get("notes", [])
    attachments = manifest.get("attachments", [])
    synced_notes   = 0
    synced_attach  = 0
    skipped_notes  = 0
    skipped_attach = 0

    # ── Sync notes ────────────────────────────────────────────────────────────
    for note in notes:
        note_id      = note["id"]
        remote_hash  = note.get("file_hash", "")
        filename     = note.get("filename", f"{note_id}.md")
        local_path   = nodes_dir / filename

        local_hash = md5(local_path.read_bytes()) if local_path.exists() else ""
        if local_hash == remote_hash and local_path.exists():
            skipped_notes += 1
            continue

        raw = fetch_raw(base_url, f"/api/v1/sync/notes/{note_id}/raw")
        if raw is not None:
            local_path.write_bytes(raw)
            synced_notes += 1
            if verbose:
                print(f"{GREEN}[NOTE]{RESET}  {filename} ({len(raw):,} bytes)")
        else:
            print(f"{YELLOW}[SKIP]{RESET}  Could not fetch note: {note_id}")

    # ── Sync attachments ──────────────────────────────────────────────────────
    for att in attachments:
        rel        = att.get("relative_path", "")
        remote_hash = att.get("file_hash", "")
        filename   = att["name"]
        local_path = images_dir / filename

        local_hash = md5(local_path.read_bytes()) if local_path.exists() else ""
        if local_hash == remote_hash and local_path.exists():
            skipped_attach += 1
            continue

        raw = fetch_raw(base_url, f"/api/v1/attachments/file/{rel}")
        if raw is not None:
            local_path.write_bytes(raw)
            synced_attach += 1
            if verbose:
                print(f"{CYAN}[IMG]{RESET}   {filename} ({len(raw):,} bytes)")
        else:
            print(f"{YELLOW}[SKIP]{RESET}  Could not fetch image: {filename}")

    # ── Summary ───────────────────────────────────────────────────────────────
    total = synced_notes + synced_attach
    if total == 0:
        print(
            f"{GREEN}[OK]{RESET} Everything up to date — "
            f"{len(notes)} notes, {len(attachments)} images "
            f"({skipped_notes + skipped_attach} unchanged)"
        )
    else:
        print(
            f"{GREEN}[OK]{RESET} Synced {synced_notes} notes, {synced_attach} images "
            f"| Unchanged: {skipped_notes} notes, {skipped_attach} images"
        )
    return True


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Vault LAN Sync — pull notes from your desktop Vault to this device.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sync_client.py --host 192.168.1.42
  python sync_client.py --host 192.168.1.42 --output ~/vault-sync
  python sync_client.py --host 192.168.1.42 --watch --interval 120
        """,
    )
    parser.add_argument("--host",     required=True,  help="Desktop IP address (e.g. 192.168.1.42)")
    parser.add_argument("--port",     type=int, default=8000, help="Vault server port (default: 8000)")
    parser.add_argument("--output",   default=str(Path.home() / "vault-sync"), help="Local directory for synced files (default: ~/vault-sync)")
    parser.add_argument("--watch",    action="store_true", help="Run continuously and re-sync at --interval seconds")
    parser.add_argument("--interval", type=int, default=300, help="Re-sync interval in seconds for --watch mode (default: 300)")
    parser.add_argument("--quiet",    action="store_true", help="Suppress per-file output; only show summary")
    args = parser.parse_args()

    base_url = f"http://{args.host}:{args.port}"
    out_dir  = Path(args.output).expanduser().resolve()

    print(f"\n{BOLD}Vault LAN Sync Client{RESET}")
    print(f"  Server  : {CYAN}{base_url}{RESET}")
    print(f"  Output  : {out_dir}")

    # ── Probe server info ─────────────────────────────────────────────────────
    info = fetch_json(base_url, "/api/v1/sync/info")
    if info:
        print(f"  Vault   : {BOLD}{info.get('vault_name', 'Unknown')}{RESET}")
        lan_ok = info.get("lan_enabled", False)
        if not lan_ok:
            print(f"\n{YELLOW}[WARNING]{RESET} LAN sync is DISABLED on the server.")
            print(f"  → Open Vault Settings > Local Network Sync and enable LAN access, then restart Vault.\n")
    else:
        print(f"\n{YELLOW}[WARNING]{RESET} Could not reach server. Make sure:")
        print("  1. Vault is running on the desktop")
        print("  2. LAN mode is enabled in Settings > Local Network Sync")
        print(f"  3. Both devices are on the same Wi-Fi network")
        print(f"  4. Firewall allows port {args.port}\n")

    print()

    # ── Run sync ──────────────────────────────────────────────────────────────
    if args.watch:
        print(f"Watch mode — re-syncing every {args.interval}s. Press Ctrl+C to stop.\n")
        while True:
            timestamp = time.strftime("%H:%M:%S")
            print(f"[{timestamp}] Syncing...")
            sync_once(base_url, out_dir, verbose=not args.quiet)
            print(f"  Next sync in {args.interval}s...")
            time.sleep(args.interval)
    else:
        success = sync_once(base_url, out_dir, verbose=not args.quiet)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Sync stopped.{RESET}")
        sys.exit(0)
