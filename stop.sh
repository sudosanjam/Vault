#!/usr/bin/env bash
# Root Stop Script for Vault (Linux)
PORT="${1:-8000}"

echo "========================================================"
echo "                Stopping Vault Server                   "
echo "========================================================"

STOPPED=false

# Try fuser
if command -v fuser >/dev/null 2>&1; then
    if fuser -k "$PORT/tcp" >/dev/null 2>&1; then
        STOPPED=true
    fi
fi

# Try lsof
if [ "$STOPPED" = false ] && command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        kill -9 $PIDS >/dev/null 2>&1 || true
        STOPPED=true
    fi
fi

# Try pkill uvicorn if still running
if [ "$STOPPED" = false ]; then
    if pkill -f "uvicorn app.main:app" >/dev/null 2>&1; then
        STOPPED=true
    fi
fi

if [ "$STOPPED" = true ]; then
    echo "[OK] Vault server process terminated."
else
    echo "No active Vault server process found listening on port $PORT."
fi
