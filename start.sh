#!/usr/bin/env bash
# ==============================================================================
# Vault - All-In-One Launch & Setup Script for Linux
# Single-script execution: Checks, installs missing requirements, sets up the
# environment, compiles production frontend assets, and launches Vault PKM.
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

# Default configuration
HOST_IP="127.0.0.1"
PORT=8000
VAULT_PATH=""
NO_BROWSER=false
SETUP_ONLY=false
FORCE_SETUP=false

# ANSI color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

log_step() { echo -e "\n${YELLOW}>>> $1${NC}"; }
log_ok()   { echo -e "${GREEN}[OK] $1${NC}"; }
log_info() { echo -e "${CYAN}[INFO] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_err()  { echo -e "${RED}[ERROR] $1${NC}"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --setup-only)
            SETUP_ONLY=true
            shift
            ;;
        --force-setup)
            FORCE_SETUP=true
            shift
            ;;
        --vault-path)
            VAULT_PATH="$2"
            shift 2
            ;;
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
        -h|--help)
            echo "Usage: ./start.sh [options]"
            echo ""
            echo "Options:"
            echo "  --setup-only       Run requirement check and environment setup only"
            echo "  --force-setup      Force re-installation and rebuild of environment"
            echo "  --vault-path DIR   Set active vault root directory"
            echo "  --host IP          Listening IP (default: 127.0.0.1)"
            echo "  --port NUM         Listening port (default: 8000)"
            echo "  --no-browser       Do not automatically open default web browser"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# ------------------------------------------------------------------------------
# 1. Prerequisite Detection & Auto-Installation
# ------------------------------------------------------------------------------

check_python() {
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

check_python_venv() {
    if python3 -m venv --help >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_node() {
    if command -v node >/dev/null 2>&1; then
        if node -e "const v = parseInt(process.versions.node.split('.')[0]); process.exit(v >= 18 ? 0 : 1)" >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

check_npm() {
    command -v npm >/dev/null 2>&1
}

install_system_requirements() {
    log_warn "Missing required software detected. Attempting automated package installation..."
    
    # Determine privilege escalation
    SUDO=""
    if [ "$EUID" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
        else
            log_err "Elevated privileges (sudo) required to install missing system packages."
            exit 1
        fi
    fi

    # Detect Package Manager
    if command -v apt-get >/dev/null 2>&1; then
        log_info "Detected Debian/Ubuntu-based distribution (apt-get)..."
        $SUDO apt-get update -y
        $SUDO apt-get install -y python3 python3-venv python3-pip curl

        if ! check_node; then
            log_info "Installing Node.js LTS (20.x) via NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
            $SUDO apt-get install -y nodejs
        fi

    elif command -v dnf >/dev/null 2>&1; then
        log_info "Detected Fedora/RHEL-based distribution (dnf)..."
        $SUDO dnf install -y python3 python3-pip nodejs npm curl

    elif command -v yum >/dev/null 2>&1; then
        log_info "Detected CentOS/RHEL distribution (yum)..."
        $SUDO yum install -y python3 python3-pip nodejs npm curl

    elif command -v pacman >/dev/null 2>&1; then
        log_info "Detected Arch Linux distribution (pacman)..."
        $SUDO pacman -Sy --noconfirm python python-pip nodejs npm curl

    elif command -v zypper >/dev/null 2>&1; then
        log_info "Detected openSUSE distribution (zypper)..."
        $SUDO zypper install -y python3 python3-pip nodejs npm curl

    elif command -v apk >/dev/null 2>&1; then
        log_info "Detected Alpine Linux distribution (apk)..."
        $SUDO apk add --no-cache python3 py3-pip nodejs npm curl

    else
        log_err "Unsupported Linux package manager. Please install Python 3.10+ and Node.js 18+ manually."
        exit 1
    fi
}

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}             VAULT - Linux One-Click Runner             ${NC}"
echo -e "${CYAN}========================================================${NC}"

# Verify prerequisites
if ! check_python || ! check_python_venv || ! check_node || ! check_npm; then
    install_system_requirements
fi

if ! check_python; then
    log_err "Python 3.10+ is still missing after installation. Please verify your Python installation."
    exit 1
fi
log_ok "Python is ready: $(python3 --version)"

if ! check_node; then
    log_err "Node.js (>= 18) is still missing after installation. Please install Node.js."
    exit 1
fi
log_ok "Node.js is ready: $(node -v) (npm: $(npm -v))"

# ------------------------------------------------------------------------------
# 2. Virtual Environment & Dependencies Setup
# ------------------------------------------------------------------------------

needs_env_setup=false
if [ ! -f "$VENV_PYTHON" ] || [ ! -f "$DIST_INDEX" ] || [ "$FORCE_SETUP" = true ]; then
    needs_env_setup=true
fi

if [ "$needs_env_setup" = true ]; then
    log_step "Setting up Python virtual environment in backend/venv..."
    if [ ! -f "$VENV_PYTHON" ] || [ "$FORCE_SETUP" = true ]; then
        rm -rf "$VENV_DIR"
        python3 -m venv "$VENV_DIR"
    fi
    log_ok "Virtualenv created at $VENV_DIR"

    log_step "Upgrading pip and installing backend dependencies..."
    "$VENV_PIP" install --upgrade pip --quiet
    "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt" --quiet
    log_ok "Backend dependencies installed successfully."

    log_step "Installing Playwright Chromium for PDF exports..."
    "$VENV_PYTHON" -m playwright install chromium || log_warn "Playwright installation completed with warnings."
    log_ok "Playwright Chromium ready."

    log_step "Installing frontend dependencies & building production bundle..."
    (
        cd "$FRONTEND_DIR"
        npm install
        npm run build
    )
    log_ok "Frontend production assets compiled to frontend/dist."

    if [ ! -f "$DIST_INDEX" ]; then
        log_err "Build verification failed: $DIST_INDEX does not exist."
        exit 1
    fi
fi

if [ "$SETUP_ONLY" = true ]; then
    echo -e "\n${GREEN}========================================================${NC}"
    echo -e "${GREEN}       Vault One-Click Setup COMPLETED Successfully!   ${NC}"
    echo -e "${GREEN}========================================================${NC}"
    echo -e "To launch Vault, run: ${CYAN}./start.sh${NC}\n"
    exit 0
fi

# ------------------------------------------------------------------------------
# 3. Server Launch
# ------------------------------------------------------------------------------

# Resolve default active vault
if [ -z "$VAULT_PATH" ]; then
    if [ -n "$VAULT_DIRECTORY" ]; then
        VAULT_PATH="$VAULT_DIRECTORY"
    elif [ -d "$SCRIPT_DIR/VaultSample" ]; then
        VAULT_PATH="$SCRIPT_DIR/VaultSample"
    else
        VAULT_PATH="$SCRIPT_DIR/VaultData"
    fi
fi

mkdir -p "$VAULT_PATH"
export VAULT_DIRECTORY="$VAULT_PATH"
export HOST="$HOST_IP"
export PORT="$PORT"

# Check if port is already active
if command -v ss >/dev/null 2>&1; then
    PORT_ACTIVE=$(ss -lnt "sport = :$PORT" | grep -v "State" || true)
elif command -v lsof >/dev/null 2>&1; then
    PORT_ACTIVE=$(lsof -i ":$PORT" || true)
else
    PORT_ACTIVE=""
fi

if [ -n "$PORT_ACTIVE" ]; then
    # Test if existing process is already Vault
    if curl -s -m 2 "http://$HOST_IP:$PORT/health" | grep -q '"app":"Vault"'; then
        echo -e "${CYAN}========================================================${NC}"
        echo -e "${CYAN}[INFO] Vault server is already running on http://$HOST_IP:$PORT!${NC}"
        echo -e "${CYAN}========================================================${NC}"
        if [ "$NO_BROWSER" = false ]; then
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "http://$HOST_IP:$PORT" >/dev/null 2>&1 &
            elif command -v sensible-browser >/dev/null 2>&1; then
                sensible-browser "http://$HOST_IP:$PORT" >/dev/null 2>&1 &
            fi
        fi
        echo -e "To shut down the active server, run: ${YELLOW}./stop.sh${NC}"
        exit 0
    else
        log_warn "Port $PORT is currently occupied by another process."
        log_warn "If startup fails, specify another port via: ./start.sh --port 8080"
    fi
fi

echo -e "\n${CYAN}========================================================${NC}"
echo -e "${CYAN}                    VAULT SYSTEM                        ${NC}"
echo -e "${CYAN}   Local-First Personal Knowledge Graph and PKM         ${NC}"
echo -e "${CYAN}========================================================${NC}"
echo -e "Active Vault Root : ${GREEN}$VAULT_PATH${NC}"
echo -e "Listening Address : ${GREEN}http://${HOST_IP}:${PORT}${NC}"
echo -e "Network Isolation : ${GRAY}Loopback Only (Zero Cloud)${NC}"
echo -e "Single-Origin SPA : ${GRAY}Enabled (frontend/dist)${NC}"
echo -e "${CYAN}========================================================${NC}\n"

# Asynchronously open browser when healthy
if [ "$NO_BROWSER" = false ]; then
    (
        for i in $(seq 1 40); do
            sleep 0.4
            if curl -s -m 1 "http://$HOST_IP:$PORT/health" >/dev/null 2>&1; then
                if command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "http://$HOST_IP:$PORT" >/dev/null 2>&1 &
                elif command -v sensible-browser >/dev/null 2>&1; then
                    sensible-browser "http://$HOST_IP:$PORT" >/dev/null 2>&1 &
                elif command -v python3 >/dev/null 2>&1; then
                    python3 -m webbrowser "http://$HOST_IP:$PORT" >/dev/null 2>&1 &
                fi
                break
            fi
        done
    ) &
fi

cd "$BACKEND_DIR"
exec "$VENV_PYTHON" -m uvicorn app.main:app --host "$HOST_IP" --port "$PORT" --log-level info
