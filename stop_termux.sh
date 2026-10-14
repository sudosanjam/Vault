#!/usr/bin/env bash
# ==============================================================================
# Vault - Termux Process Stopper
# Terminates the active Vault server process on Android.
# ==============================================================================

PORT="${1:-8000}"

echo "========================================================"
echo "          Stopping Vault Server on Termux               "
echo "========================================================"

STOPPED=false

if command -v pkill >/dev/null 2>&1; then
    if pkill -f "uvicorn app.main:app" >/dev/null 2>&1; then
        STOPPED=true
    fi
fi

if [ "$STOPPED" = false ] && command -v fuser >/dev/null 2>&1; then
    if fuser -k "$PORT/tcp" >/dev/null 2>&1; then
        STOPPED=true
    fi
fi

if [ "$STOPPED" = true ]; then
    echo "[OK] Vault server process stopped."
else
    echo "No active Vault server process found."
fi
