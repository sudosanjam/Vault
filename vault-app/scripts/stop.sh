#!/usr/bin/env bash
# Forward to root stop.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
exec "$ROOT_DIR/stop.sh" "$@"
