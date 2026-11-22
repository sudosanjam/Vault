#!/usr/bin/env bash
# ==============================================================================
# Vault - One-Click Termux (Android) Installer & Runner
# Sets up Python, Node.js, virtualenv, dependencies, builds frontend,
# and launches Vault directly on your Android phone.
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

# ANSI color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_step() { echo -e "\n${YELLOW}>>> $1${NC}"; }
log_ok()   { echo -e "${GREEN}[OK] $1${NC}"; }
log_info() { echo -e "${CYAN}[INFO] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_err()  { echo -e "${RED}[ERROR] $1${NC}"; }

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}             VAULT - Android Termux Installer           ${NC}"
echo -e "${CYAN}       Local-First Personal Knowledge Graph on Android  ${NC}"
echo -e "${CYAN}========================================================${NC}"

# 1. Verify Termux environment
if [ -z "$TERMUX_VERSION" ] && [[ "$PREFIX" != *"com.termux"* ]] && ! command -v pkg > /dev/null 2>&1; then
    log_warn "This script is tailored for Termux on Android."
    log_warn "For standard Linux, please run: ./start.sh or ./setup.sh"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -r choice
    if [[ ! "$choice" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# 2. Update Termux repositories & install system packages
log_step "[1/5] Checking and installing Termux packages..."
if command -v pkg > /dev/null 2>&1; then
    log_info "Updating package lists via pkg..."
    pkg update -y 2>/dev/null || apt-get update -y 2>/dev/null || true

    log_info "Installing Python, Node.js, and native build dependencies..."
    pkg install -y python nodejs-lts git clang make libffi libxml2 libxslt libyaml rust binutils curl termux-tools 2>/dev/null || \
        apt-get install -y python nodejs git clang make libffi libxml2 libxslt libyaml rust binutils curl 2>/dev/null || true
else
    log_warn "pkg package manager not found. Assuming prerequisites are already installed."
fi

PYTHON_VER=$(python3 --version 2>&1)
log_ok "Termux system packages ready: $PYTHON_VER, Node.js $(node -v 2>&1)"

# 3. Setup Python Virtual Environment
log_step "[2/5] Setting up Python virtual environment in backend/venv..."

# ── The Python 3.14 pip bug ────────────────────────────────────────────────────
# Python 3.14 introduced an import-prevention hook inside pip that raises:
#   ImportError: No module named 'pip._internal.operations.install.wheel'
# when ANY pip install is attempted — including upgrading pip itself.
# This affects the pip bundled inside the venv by python3 -m venv.
#
# Root fix: create the venv WITHOUT pip (--without-pip), then bootstrap a
# FRESH pip using get-pip.py downloaded from PyPA. This gives us a clean pip
# that doesn't have the broken hook baked in.
# ─────────────────────────────────────────────────────────────────────────────

_bootstrap_pip() {
    local GET_PIP_URL="https://bootstrap.pypa.io/get-pip.py"
    local GET_PIP_PATH="$VENV_DIR/get-pip.py"

    log_info "Bootstrapping fresh pip via get-pip.py..."
    if command -v curl > /dev/null 2>&1; then
        curl -fsSL "$GET_PIP_URL" -o "$GET_PIP_PATH"
    elif command -v wget > /dev/null 2>&1; then
        wget -qO "$GET_PIP_PATH" "$GET_PIP_URL"
    else
        log_err "Neither curl nor wget found. Install one: pkg install curl"
        exit 1
    fi

    "$VENV_PYTHON" "$GET_PIP_PATH" --quiet
    rm -f "$GET_PIP_PATH"

    # Verify pip works
    if "$VENV_PIP" --version > /dev/null 2>&1; then
        log_ok "pip $($VENV_PIP --version | awk '{print $2}') bootstrapped successfully"
    else
        log_err "pip bootstrap failed — try: pkg install python && ./install_termux.sh"
        exit 1
    fi

    # Now safe to upgrade (bootstrap pip doesn't have the broken hook)
    "$VENV_PIP" install --upgrade pip wheel setuptools --quiet
    log_ok "pip, wheel, setuptools up to date"
}

NEEDS_BOOTSTRAP=false

if [ ! -f "$VENV_PYTHON" ]; then
    log_info "Creating virtual environment (without bundled pip)..."
    # --without-pip avoids installing the broken Python 3.14 bundled pip
    python3 -m venv --without-pip "$VENV_DIR"
    NEEDS_BOOTSTRAP=true
fi

# If the venv exists but pip is broken, re-bootstrap
if [ "$NEEDS_BOOTSTRAP" = false ] && ! "$VENV_PIP" --version > /dev/null 2>&1; then
    log_warn "Existing pip in venv is broken — re-bootstrapping..."
    NEEDS_BOOTSTRAP=true
fi

# If pip exists but throws the operations.install.wheel error, re-bootstrap
if [ "$NEEDS_BOOTSTRAP" = false ]; then
    if ! "$VENV_PIP" list > /dev/null 2>&1; then
        log_warn "Venv pip reports errors — re-bootstrapping..."
        NEEDS_BOOTSTRAP=true
    fi
fi

if [ "$NEEDS_BOOTSTRAP" = true ]; then
    _bootstrap_pip
fi

log_ok "Python virtual environment ready ($("$VENV_PYTHON" --version 2>&1))"

# ─── Backend Python packages ──────────────────────────────────────────────────
log_step "[3/5] Installing backend Python packages..."

# ── pydantic-core for Android/ARM ─────────────────────────────────────────────
# Install strategy (fastest → slowest):
#   1. Pre-built Android/ARM wheel from community indexes → instant, no Rust
#   2. Build from source using system Rust toolchain     → ~5-10 min
#
# --no-build-isolation is key: it uses system Rust directly without pip needing
# to install maturin (which also hits the Python 3.14 pip bug).
log_info "Checking pydantic-core for Android/ARM..."
if ! "$VENV_PYTHON" -c "import pydantic_core" > /dev/null 2>&1; then
    log_info "pydantic-core not installed — trying pre-built Android wheels..."
    PYDANTIC_OK=false

    for INDEX_URL in \
        "https://eutalix.github.io/android-pydantic-core/" \
        "https://termux-python.github.io/termux-wheels/"; do
        log_info "  Trying: $INDEX_URL"
        if "$VENV_PIP" install pydantic-core \
            --extra-index-url "$INDEX_URL" --quiet 2>/dev/null; then
            PYDANTIC_OK=true
            log_ok "pydantic-core installed from pre-built wheel!"
            break
        fi
    done

    if [ "$PYDANTIC_OK" = false ]; then
        log_warn "No pre-built wheel found — building pydantic-core from source via system Rust."
        log_warn "This may take 5-10 minutes. Keep Termux open and plugged in."
        CARGO_NET_GIT_FETCH_WITH_CLI=true \
            "$VENV_PIP" install --no-build-isolation pydantic-core
        PYDANTIC_OK=true
    fi

    if ! "$VENV_PYTHON" -c "import pydantic_core" > /dev/null 2>&1; then
        log_err "pydantic-core installation failed."
        log_err "Try: pkg install rust && rm -rf $VENV_DIR && ./install_termux.sh"
        exit 1
    fi
fi

PYDANTIC_VER=$("$VENV_PYTHON" -c "import pydantic_core; print(pydantic_core.__version__)" 2>/dev/null || echo "unknown")
log_ok "pydantic-core $PYDANTIC_VER ready"

# ── Install remaining requirements ────────────────────────────────────────────
# Strip Android-incompatible packages:
#   playwright  → no headless Chromium on Android ARM
#   uvicorn[standard] → uvloop doesn't work on Android bionic libc
#   pystray     → needs a system tray/display, N/A on Android
log_info "Installing backend dependencies..."
sed \
    -e 's/uvicorn\[standard\]/uvicorn/g' \
    -e '/^playwright/d' \
    -e '/^pystray/d' \
    "$BACKEND_DIR/requirements.txt" > "$BACKEND_DIR/requirements-termux.tmp"
"$VENV_PIP" install -r "$BACKEND_DIR/requirements-termux.tmp"
rm -f "$BACKEND_DIR/requirements-termux.tmp"
log_ok "Backend dependencies installed successfully."

# 4. Frontend Dependencies & Build
log_step "[4/5] Checking frontend production assets..."
if [ ! -f "$DIST_INDEX" ]; then
    log_info "Installing frontend node_modules..."
    (
        cd "$FRONTEND_DIR"
        npm install --no-audit --no-fund
        log_info "Compiling production bundle (npm run build)..."
        npm run build
    )
    log_ok "Frontend production assets compiled to frontend/dist."
else
    log_ok "Frontend assets already built and up to date."
fi

# 5. Termux Home Screen Widget Support (Termux:Widget)
log_step "[5/5] Configuring Termux launcher shortcuts..."
SHORTCUTS_DIR="$HOME/.shortcuts"
if [ -d "$SHORTCUTS_DIR" ]; then
    cat << 'EOF' > "$SHORTCUTS_DIR/Vault.sh"
#!/usr/bin/env bash
cd "$(dirname "$0")"
exec bash -c "cd ~/Vault && ./start_termux.sh"
EOF
    chmod +x "$SHORTCUTS_DIR/Vault.sh"
    log_ok "Created Termux:Widget shortcut at $SHORTCUTS_DIR/Vault.sh"
fi

echo -e "\n${GREEN}========================================================${NC}"
echo -e "${GREEN}     Vault Termux Installation COMPLETED Successfully!  ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "You can launch Vault at any time on Android using:"
echo -e "  ${CYAN}./start_termux.sh${NC}"
echo -e "========================================================"

read -p $'\nWould you like to start Vault right now? [Y/n]: ' -r start_now
if [[ "$start_now" =~ ^[Nn]$ ]]; then
    exit 0
fi

exec "$SCRIPT_DIR/start_termux.sh"
