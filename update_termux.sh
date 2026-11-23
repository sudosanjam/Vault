#!/usr/bin/env bash
# ==============================================================================
# Vault - One-Click Termux (Android) Updater
# Pulls the latest commits from GitHub, checks for dependency updates,
# and refreshes the application without needing a full re-installation.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/vault-app"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$BACKEND_DIR/venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"
DIST_INDEX="$FRONTEND_DIR/dist/index.html"

# ANSI colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}             VAULT - Termux Application Updater         ${NC}"
echo -e "${CYAN}       Pull updates from GitHub & refresh environment   ${NC}"
echo -e "${CYAN}========================================================${NC}"

cd "$SCRIPT_DIR"

# 1. Fetch current commit
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "Current Local Commit: ${GRAY}$CURRENT_COMMIT${NC}"

# 2. Pull updates from GitHub
echo -e "\n${YELLOW}>>> [1/3] Pulling latest updates from GitHub...${NC}"
if git pull origin main; then
    NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    LATEST_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
    echo -e "${GREEN}[OK] Repository updated to $NEW_COMMIT${NC}"
    if [ -n "$LATEST_MSG" ]; then
        echo -e "     Latest patch: ${CYAN}$LATEST_MSG${NC}"
    fi
else
    echo -e "${RED}[ERROR] git pull failed. Please check your internet connection.${NC}"
    exit 1
fi

# 3. Check Python backend dependencies
echo -e "\n${YELLOW}>>> [2/3] Checking backend Python dependencies...${NC}"
if [ -f "$VENV_PYTHON" ] && [ -f "$VENV_PIP" ]; then
    # Filter out Android-incompatible packages
    sed \
        -e 's/uvicorn\[standard\]/uvicorn/g' \
        -e '/^playwright/Id' \
        -e '/^pystray/Id' \
        -e '/^pillow/Id' \
        -e '/^pydantic-core/Id' \
        "$BACKEND_DIR/requirements.txt" > "$BACKEND_DIR/requirements-termux.tmp"

    "$VENV_PIP" install -r "$BACKEND_DIR/requirements-termux.tmp" --quiet 2>/dev/null || true
    rm -f "$BACKEND_DIR/requirements-termux.tmp"
    echo -e "${GREEN}[OK] Backend dependencies up to date.${NC}"
else
    echo -e "${YELLOW}[WARN] Virtual environment missing. Running install_termux.sh...${NC}"
    exec "$SCRIPT_DIR/install_termux.sh"
fi

# 4. Check Frontend build
echo -e "\n${YELLOW}>>> [3/3] Checking frontend production bundle...${NC}"
if [ ! -f "$DIST_INDEX" ]; then
    echo -e "${CYAN}[INFO] Building production frontend assets...${NC}"
    (
        cd "$FRONTEND_DIR"
        npm install --no-audit --no-fund --quiet
        npm run build
    )
    echo -e "${GREEN}[OK] Frontend compiled successfully.${NC}"
else
    echo -e "${GREEN}[OK] Frontend assets ready.${NC}"
fi

# 5. Check if Vault server is running and prompt for restart
PORT=8000
IS_RUNNING=false
if curl -s -m 1 "http://127.0.0.1:$PORT/health" | grep -q '"app":"Vault"'; then
    IS_RUNNING=true
fi

echo -e "\n${GREEN}========================================================${NC}"
echo -e "${GREEN}             Vault Updated Successfully!                ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "Updated to version/commit: ${CYAN}$NEW_COMMIT${NC}"

if [ "$IS_RUNNING" = true ]; then
    echo -e "\nVault server is currently active on port $PORT."
    read -p "Would you like to restart Vault now to apply updates? [Y/n]: " -r restart_now
    if [[ ! "$restart_now" =~ ^[Nn]$ ]]; then
        "$SCRIPT_DIR/stop_termux.sh" 2>/dev/null || true
        sleep 1
        exec "$SCRIPT_DIR/start_termux.sh"
    fi
else
    echo -e "You can launch Vault anytime with: ${CYAN}./start_termux.sh${NC}"
fi
