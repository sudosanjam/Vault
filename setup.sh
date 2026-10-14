#!/usr/bin/env bash
# Root Setup Script for Vault (Linux)
# Executes the all-in-one script with --setup-only flag.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/start.sh" --setup-only "$@"
