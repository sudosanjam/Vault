#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║       Vault LAN Sync — Termux / Linux one-liner          ║
# ║  Bidirectional sync of notes between desktop and Android ║
# ╚══════════════════════════════════════════════════════════╝
#
# Usage:
#   ./sync.sh <desktop-ip> [port] [output-dir] [--push|--bidirectional] [--watch]
#
# Examples:
#   ./sync.sh 192.168.1.42                              # pull desktop → phone
#   ./sync.sh 192.168.1.42 8000 ~/vault-sync --push     # push phone → desktop
#   ./sync.sh 192.168.1.42 8000 ~/vault-sync --bidirectional --watch
#
# Requirements (Termux):
#   pkg install python
#
# To find your desktop IP:
#   Windows: run `ipconfig` in cmd and look for IPv4 Address
#   macOS:   run `ifconfig | grep inet`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_CLIENT="$SCRIPT_DIR/vault-app/scripts/sync_client.py"

HOST="${1:-}"
PORT="${2:-8000}"
OUTPUT="${3:-$HOME/vault-sync}"

# Remaining args (--push, --bidirectional, --watch, --quiet, etc.) passed through
shift 3 2>/dev/null || shift $# 2>/dev/null || true
EXTRA_ARGS="$*"

if [ -z "$HOST" ]; then
  echo ""
  echo "  Vault LAN Sync"
  echo "  ──────────────"
  echo "  Usage: $0 <desktop-ip> [port] [output-dir] [mode] [--watch]"
  echo ""
  echo "  Modes (default is pull):"
  echo "    (none)           Pull from desktop → this device"
  echo "    --push           Push from this device → desktop"
  echo "    --bidirectional  Full two-way sync"
  echo ""
  echo "  Examples:"
  echo "    $0 192.168.1.42"
  echo "    $0 192.168.1.42 8000 ~/vault-sync --bidirectional --watch"
  echo ""
  echo "  Tip: Find your desktop IP with 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)"
  echo ""
  exit 1
fi

# Check sync client exists
if [ ! -f "$SYNC_CLIENT" ]; then
  echo "[ERROR] sync_client.py not found at: $SYNC_CLIENT"
  echo "        Make sure you are in the Vault repository root."
  exit 1
fi

# Find Python
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "[ERROR] Python not found."
  echo "        In Termux: pkg install python"
  exit 1
fi

echo "Using $($PYTHON --version 2>&1)"

# shellcheck disable=SC2086
exec "$PYTHON" "$SYNC_CLIENT" \
  --host "$HOST" \
  --port "$PORT" \
  --output "$OUTPUT" \
  $EXTRA_ARGS
