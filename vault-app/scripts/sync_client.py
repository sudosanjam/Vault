#!/usr/bin/env python3
"""
Vault LAN Sync Client
─────────────────────
Bidirectional sync of notes and images between a Vault desktop server
and this device (Android/Termux/Linux) over local Wi-Fi.

Modes:
  --pull           Pull from desktop → this device  (default)
  --push           Push from this device → desktop
  --bidirectional  Pull first, then push any local-only changes

Usage:
  python sync_client.py --host 192.168.1.42
  python sync_client.py --host 192.168.1.42 --push
  python sync_client.py --host 192.168.1.42 --bidirectional
  python sync_client.py --host 192.168.1.42 --bidirectional --watch --interval 120
  python sync_client.py --host 192.168.1.42 --output ~/vault-sync

Requirements: Python 3.6+ (stdlib only — no pip packages needed)
"""

import argparse
import hashlib
import io
import json
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

try:
    from urllib.parse import urlencode
except ImportError:
    pass


# ─── ANSI colors ──────────────────────────────────────────────────────────────
def _supports_color() -> bool:
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

GREEN  = "\033[92m"  if _supports_color() else ""
YELLOW = "\033[93m"  if _supports_color() else ""
RED    = "\033[91m"  if _supports_color() else ""
CYAN   = "\033[96m"  if _supports_color() else ""
BOLD   = "\033[1m"   if _supports_color() else ""
RESET  = "\033[0m"   if _supports_color() else ""


# ─── HTTP helpers (stdlib only) ───────────────────────────────────────────────

def fetch_json(base_url: str, path: str):
    url = f"{base_url}{path}"
    try:
        req = Request(url, headers={"Accept": "application/json", "User-Agent": "VaultSyncClient/1.1"})
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        print(f"{RED}[HTTP {e.code}]{RESET} GET {url}: {e.reason}")
        return None
    except URLError as e:
        print(f"{RED}[NET ERROR]{RESET} Cannot reach {url}: {e.reason}")
        return None
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} GET {url}: {e}")
        return None


def fetch_raw(base_url: str, path: str):
    url = f"{base_url}{path}"
    try:
        req = Request(url, headers={"User-Agent": "VaultSyncClient/1.1"})
        with urlopen(req, timeout=30) as resp:
            return resp.read()
    except HTTPError as e:
        print(f"{RED}[HTTP {e.code}]{RESET} GET {url}: {e.reason}")
        return None
    except URLError as e:
        print(f"{RED}[NET ERROR]{RESET} Cannot reach {url}: {e.reason}")
        return None
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} GET {url}: {e}")
        return None


def _multipart_encode(fields: dict, files: dict) -> tuple:
    """Minimal stdlib multipart/form-data encoder."""
    boundary = "----VaultSyncBoundary" + hashlib.md5(str(time.time()).encode()).hexdigest()[:12]
    body = io.BytesIO()

    for name, value in fields.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(value.encode("utf-8") + b"\r\n")

    for field_name, (filename, data, content_type) in files.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode()
        )
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode())
        body.write(data + b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    return body.getvalue(), f"multipart/form-data; boundary={boundary}"


def post_form(base_url: str, path: str, fields: dict) -> dict:
    """POST application/x-www-form-urlencoded."""
    url = f"{base_url}{path}"
    try:
        data = urlencode(fields).encode("utf-8")
        req = Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "VaultSyncClient/1.1",
            },
        )
        with urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"{RED}[HTTP {e.code}]{RESET} POST {url}: {e.reason} — {body[:200]}")
        return {}
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} POST {url}: {e}")
        return {}


def post_file(base_url: str, path: str, filename: str, data: bytes, content_type: str = "application/octet-stream") -> dict:
    """POST multipart/form-data with a single file field."""
    url = f"{base_url}{path}"
    try:
        body, ctype = _multipart_encode({}, {"file": (filename, data, content_type)})
        req = Request(
            url,
            data=body,
            headers={
                "Content-Type": ctype,
                "User-Agent": "VaultSyncClient/1.1",
            },
        )
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body_str = e.read().decode("utf-8", errors="replace")
        print(f"{RED}[HTTP {e.code}]{RESET} POST {url}: {e.reason} — {body_str[:200]}")
        return {}
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} POST {url}: {e}")
        return {}


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def md5_file(path: Path) -> str:
    return md5(path.read_bytes()) if path.exists() else ""


# ─── Pull: Desktop → This device ─────────────────────────────────────────────

def pull(base_url: str, out_dir: Path, verbose: bool = True) -> bool:
    """Download all changed notes and images from the desktop server."""
    out_dir.mkdir(parents=True, exist_ok=True)
    nodes_dir  = out_dir / "nodes"
    images_dir = out_dir / "attachments" / "images"
    nodes_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    manifest = fetch_json(base_url, "/api/v1/sync/manifest")
    if manifest is None:
        print(f"{RED}[FAIL]{RESET} Cannot fetch manifest — is LAN sync enabled on the desktop?")
        return False

    notes       = manifest.get("notes", [])
    attachments = manifest.get("attachments", [])
    pulled_notes = pulled_imgs = skipped = 0

    for note in notes:
        note_id     = note["id"]
        remote_hash = note.get("file_hash", "")
        filename    = note.get("filename", f"{note_id}.md")
        local_path  = nodes_dir / filename
        if md5_file(local_path) == remote_hash:
            skipped += 1
            continue
        raw = fetch_raw(base_url, f"/api/v1/sync/notes/{note_id}/raw")
        if raw is not None:
            local_path.write_bytes(raw)
            pulled_notes += 1
            if verbose:
                print(f"{GREEN}[PULL NOTE]{RESET}  {filename} ({len(raw):,} B)")

    for att in attachments:
        rel         = att.get("relative_path", "")
        remote_hash = att.get("file_hash", "")
        filename    = att["name"]
        local_path  = images_dir / filename
        if md5_file(local_path) == remote_hash:
            skipped += 1
            continue
        raw = fetch_raw(base_url, f"/api/v1/attachments/file/{rel}")
        if raw is not None:
            local_path.write_bytes(raw)
            pulled_imgs += 1
            if verbose:
                print(f"{CYAN}[PULL IMG]{RESET}   {filename} ({len(raw):,} B)")

    total = pulled_notes + pulled_imgs
    if total == 0:
        print(f"{GREEN}[PULL OK]{RESET} Everything up to date ({len(notes)} notes, {len(attachments)} images, {skipped} unchanged).")
    else:
        print(f"{GREEN}[PULL OK]{RESET} {pulled_notes} notes, {pulled_imgs} images downloaded | {skipped} unchanged.")
    return True


# ─── Push: This device → Desktop ─────────────────────────────────────────────

def push(base_url: str, local_dir: Path, verbose: bool = True) -> bool:
    """Upload local notes and images that differ from the desktop manifest."""
    nodes_dir  = local_dir / "nodes"
    images_dir = local_dir / "attachments" / "images"

    if not nodes_dir.exists() and not images_dir.exists():
        print(f"{YELLOW}[PUSH]{RESET} No local vault data found at {local_dir}. Run --pull first.")
        return False

    # Fetch desktop manifest to avoid re-pushing identical files
    manifest = fetch_json(base_url, "/api/v1/sync/manifest")
    if manifest is None:
        print(f"{YELLOW}[WARN]{RESET} Cannot fetch manifest — pushing all local files (no diff possible).")
        remote_note_hashes = {}
        remote_img_hashes  = {}
    else:
        remote_note_hashes = {n["id"]: n.get("file_hash", "") for n in manifest.get("notes", [])}
        remote_img_hashes  = {a["name"]: a.get("file_hash", "") for a in manifest.get("attachments", [])}

    pushed_notes = pushed_imgs = skipped = 0

    # ── Push notes ─────────────────────────────────────────────────────────────
    if nodes_dir.exists():
        for md_file in sorted(nodes_dir.glob("*.md")):
            note_id    = md_file.stem
            local_hash = md5_file(md_file)
            if remote_note_hashes.get(note_id) == local_hash:
                skipped += 1
                continue
            content = md_file.read_text(encoding="utf-8")
            result  = post_form(base_url, "/api/v1/sync/push/note", {
                "note_id": note_id,
                "content": content,
            })
            if result.get("status") == "ok":
                pushed_notes += 1
                if verbose:
                    action = result.get("action", "pushed")
                    print(f"{GREEN}[PUSH NOTE]{RESET}  {md_file.name} → {action}")
            else:
                print(f"{YELLOW}[WARN]{RESET} Failed to push note: {md_file.name}")

    # ── Push images ────────────────────────────────────────────────────────────
    if images_dir.exists():
        for img_file in sorted(images_dir.iterdir()):
            if not img_file.is_file() or img_file.name.startswith("."):
                continue
            local_hash = md5_file(img_file)
            if remote_img_hashes.get(img_file.name) == local_hash:
                skipped += 1
                continue
            data   = img_file.read_bytes()
            ctype  = _guess_mime(img_file.name)
            result = post_file(base_url, "/api/v1/sync/push/image", img_file.name, data, ctype)
            if result.get("status") == "ok":
                action = result.get("action", "pushed")
                if action != "skipped":
                    pushed_imgs += 1
                    if verbose:
                        print(f"{CYAN}[PUSH IMG]{RESET}   {img_file.name} → {action}")
                else:
                    skipped += 1
            else:
                print(f"{YELLOW}[WARN]{RESET} Failed to push image: {img_file.name}")

    total = pushed_notes + pushed_imgs
    if total == 0:
        print(f"{GREEN}[PUSH OK]{RESET} Desktop is up to date ({skipped} unchanged).")
    else:
        print(f"{GREEN}[PUSH OK]{RESET} {pushed_notes} notes, {pushed_imgs} images uploaded | {skipped} unchanged.")
    return True


def _guess_mime(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".bmp": "image/bmp",
    }.get(ext, "application/octet-stream")


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Vault LAN Sync — bidirectional pull/push of notes over local Wi-Fi.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Sync modes:
  (default)        Pull from desktop → this device
  --push           Push from this device → desktop
  --bidirectional  Pull first, then push any local-only changes

Examples:
  python sync_client.py --host 192.168.1.42
  python sync_client.py --host 192.168.1.42 --push
  python sync_client.py --host 192.168.1.42 --bidirectional --watch
        """,
    )
    parser.add_argument("--host",          required=True,          help="Desktop IP address (e.g. 192.168.1.42)")
    parser.add_argument("--port",          type=int, default=8000, help="Vault server port (default: 8000)")
    parser.add_argument("--output",        default=str(Path.home() / "vault-sync"), help="Local vault directory (default: ~/vault-sync)")
    parser.add_argument("--push",          action="store_true",    help="Push local notes to desktop")
    parser.add_argument("--bidirectional", action="store_true",    help="Pull then push (full two-way sync)")
    parser.add_argument("--watch",         action="store_true",    help="Repeat sync at --interval seconds")
    parser.add_argument("--interval",      type=int, default=300,  help="Re-sync interval in seconds for --watch (default: 300)")
    parser.add_argument("--quiet",         action="store_true",    help="Only show summary lines")
    args = parser.parse_args()

    base_url = f"http://{args.host}:{args.port}"
    out_dir  = Path(args.output).expanduser().resolve()
    verbose  = not args.quiet

    mode = "bidirectional" if args.bidirectional else ("push" if args.push else "pull")

    print(f"\n{BOLD}Vault LAN Sync Client{RESET}")
    print(f"  Server  : {CYAN}{base_url}{RESET}")
    print(f"  Local   : {out_dir}")
    print(f"  Mode    : {BOLD}{mode}{RESET}")

    # Probe server
    info = fetch_json(base_url, "/api/v1/sync/info")
    if info:
        print(f"  Vault   : {BOLD}{info.get('vault_name', 'Unknown')}{RESET}")
        if not info.get("lan_enabled", False):
            print(f"\n{YELLOW}[WARNING]{RESET} LAN sync is DISABLED on the server.")
            print("  → Open Vault Settings > Local Network Sync and enable it, then restart Vault.\n")
    else:
        print(f"\n{YELLOW}[WARNING]{RESET} Cannot reach server. Check:")
        print(f"  1. Vault is running on the desktop")
        print(f"  2. LAN mode is enabled in Settings > Local Network Sync")
        print(f"  3. Both devices are on the same Wi-Fi")
        print(f"  4. Windows Firewall allows port {args.port}\n")

    def run_sync():
        if mode == "pull":
            return pull(base_url, out_dir, verbose)
        elif mode == "push":
            return push(base_url, out_dir, verbose)
        else:  # bidirectional
            ok  = pull(base_url, out_dir, verbose)
            ok2 = push(base_url, out_dir, verbose)
            return ok and ok2

    print()
    if args.watch:
        print(f"Watch mode — syncing every {args.interval}s. Press Ctrl+C to stop.\n")
        while True:
            timestamp = time.strftime("%H:%M:%S")
            print(f"[{timestamp}] Running {mode} sync...")
            run_sync()
            print(f"  Next sync in {args.interval}s...")
            time.sleep(args.interval)
    else:
        success = run_sync()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Sync stopped.{RESET}")
        sys.exit(0)
