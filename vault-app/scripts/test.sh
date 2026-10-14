#!/usr/bin/env bash
# Vault Test Suite Runner (Linux)
# Executes all backend pytest tests and runs frontend build/type-check.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="python3"
fi

echo "========================================================"
echo "             VAULT - Comprehensive Test Suite           "
echo "========================================================"
echo ""

echo "[1/2] Running Backend Tests (pytest)..."
(
    cd "$BACKEND_DIR"
    "$VENV_PYTHON" -m pytest -v --tb=short
)

echo ""
echo "[2/2] Running Frontend Type Check & Build (tsc)..."
(
    cd "$FRONTEND_DIR"
    npm run build
)

echo ""
echo "========================================================"
echo "       All Vault Tests and Builds PASSED! (100%)       "
echo "========================================================"
