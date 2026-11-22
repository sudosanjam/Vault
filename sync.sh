#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════╗
# ║          Vault LAN Sync — Termux / Linux              ║
# ║  Pull your desktop Vault notes to this device         ║
# ╚═══════════════════════════════════════════════════════╝
#
# Usage:
#   ./sync.sh <desktop-ip> [port] [output-dir] [--watch]
#
# Examples:
#   ./sync.sh 192.168.1.42
#   ./sync.sh 192.168.1.42 8000 ~/vault-sync
#   ./sync.sh 192.168.1.42 8000 ~/vault-sync --watch
#
# Requirements (Termux):
#   pkg install python
#
# To find your desktop IP:
#   Windows: run `ipconfig` in cmd and look for IPv4 Address
#   macOS:   run `ifconfig | grep inet`

set -euo pipefail

# ── Determine script location ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_CLIENT="$SCRIPT_DIR/vault-app/scripts/sync_client.py"

# ── Parse arguments ───────────────────────────────────────────────────────────
HOST="${1:-}"
PORT="${2:-8000}"
OUTPUT="${3:-$HOME/vault-sync}"
EXTRA="${4:-}"

if [ -z "$HOST" ]; then
  echo ""
  echo "  Vault LAN Sync"
  echo "  ──────────────"
  echo "  Usage: $0 <desktop-ip> [port] [output-dir] [--watch]"
  echo ""
  echo "  Examples:"
  echo "    $0 192.168.1.42"
  echo "    $0 192.168.1.42 8000 ~/vault-sync --watch"
  echo ""
  echo "  Tip: Find your desktop IP with 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)"
  echo ""
  exit 1
fi

# ── Check sync client script exists ───────────────────────────────────────────
if [ ! -f "$SYNC_CLIENT" ]; then
  echo "[ERROR] sync_client.py not found at: $SYNC_CLIENT"
  echo "        Make sure you are running this from the Vault repository root."
  exit 1
fi

# ── Find Python ───────────────────────────────────────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "[ERROR] Python not found."
  echo "        Install it with: pkg install python   (Termux)"
  echo "                     or: sudo apt install python3  (Debian/Ubuntu)"
  exit 1
fi

echo "Using Python: $PYTHON ($($PYTHON --version 2>&1))"

# ── Run sync ──────────────────────────────────────────────────────────────────
exec "$PYTHON" "$SYNC_CLIENT" \
  --host "$HOST" \
  --port "$PORT" \
  --output "$OUTPUT" \
  ${EXTRA:+"$EXTRA"}
