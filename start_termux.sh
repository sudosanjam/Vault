#!/usr/bin/env bash
# ==============================================================================
# Vault - Termux (Android) Server Launcher
# Launches the Vault backend and opens your Android web browser.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/vault-app"
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"

HOST_IP="127.0.0.1"
PORT=8000
NO_BROWSER=false

# ANSI colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
NC='\033[0m'

# Check if setup is needed
if [ ! -f "$VENV_PYTHON" ] || [ ! -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
    echo -e "${YELLOW}[!] Setup not detected. Running install_termux.sh first...${NC}"
    exec "$SCRIPT_DIR/install_termux.sh"
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)
            HOST_IP="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --no-browser)
            NO_BROWSER=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Resolve active vault directory
# If Android shared storage is set up, prefer storing in shared Documents or local
if [ -z "$VAULT_DIRECTORY" ]; then
    if [ -d "$HOME/storage/shared/Documents/Vault" ]; then
        VAULT_DIRECTORY="$HOME/storage/shared/Documents/Vault"
    elif [ -d "$SCRIPT_DIR/VaultSample" ]; then
        VAULT_DIRECTORY="$SCRIPT_DIR/VaultSample"
    else
        VAULT_DIRECTORY="$SCRIPT_DIR/VaultData"
    fi
fi

mkdir -p "$VAULT_DIRECTORY"
export VAULT_DIRECTORY
export HOST="$HOST_IP"
export PORT="$PORT"

# Check if port is already active
PORT_ACTIVE=""
if command -v ss >/dev/null 2>&1; then
    PORT_ACTIVE=$(ss -lnt "sport = :$PORT" | grep -v "State" || true)
fi

open_android_browser() {
    local url="http://${HOST_IP}:${PORT}"
    if [ "$NO_BROWSER" = true ]; then
        return
    fi

    # Wait for server to become responsive
    (
        for i in $(seq 1 30); do
            sleep 0.4
            if curl -s -m 1 "$url/health" >/dev/null 2>&1; then
                # Attempt Termux URL opener
                if command -v termux-open-url >/dev/null 2>&1; then
                    termux-open-url "$url" >/dev/null 2>&1 &
                elif command -v am >/dev/null 2>&1; then
                    am start -a android.intent.action.VIEW -d "$url" >/dev/null 2>&1 &
                elif command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "$url" >/dev/null 2>&1 &
                fi
                break
            fi
        done
    ) &
}

if [ -n "$PORT_ACTIVE" ]; then
    if curl -s -m 2 "http://$HOST_IP:$PORT/health" | grep -q '"app":"Vault"'; then
        echo -e "${CYAN}========================================================${NC}"
        echo -e "${CYAN}[INFO] Vault is already running on http://$HOST_IP:$PORT!${NC}"
        echo -e "${CYAN}========================================================${NC}"
        open_android_browser
        echo -e "Opening Android browser..."
        echo -e "To stop Vault, run: ${YELLOW}./stop_termux.sh${NC}"
        exit 0
    fi
fi

echo -e "\n${CYAN}========================================================${NC}"
echo -e "${CYAN}              VAULT - Running on Android                ${NC}"
echo -e "${CYAN}   Local-First Personal Knowledge Graph (Termux)        ${NC}"
echo -e "${CYAN}========================================================${NC}"
echo -e "Active Vault Root : ${GREEN}$VAULT_DIRECTORY${NC}"
echo -e "Listening Address : ${GREEN}http://${HOST_IP}:${PORT}${NC}"
echo -e "Single-Origin SPA : ${GRAY}Enabled (frontend/dist)${NC}"
echo -e "${CYAN}========================================================${NC}\n"

open_android_browser

cd "$BACKEND_DIR"
exec "$VENV_PYTHON" -m uvicorn app.main:app --host "$HOST_IP" --port "$PORT" --log-level info
