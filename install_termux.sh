#!/usr/bin/env bash
# ==============================================================================
# Vault - One-Click Termux (Android) Installer & Runner
# Sets up Python, Node.js, virtualenv, dependencies, builds frontend,
# and launches Vault directly on your Android phone.
#
# Python 3.14 compatibility notes:
#   Python 3.14 introduced a pip _prevent_import_hook that breaks the internal
#   subprocess pip spawned when installing C/Rust extension packages that need
#   build isolation. We work around this with three strategies:
#     1. pkg install for binary packages Termux ships pre-compiled
#     2. --system-site-packages venv so those pkg packages are accessible
#     3. Pre-install build tools + --no-build-isolation for remaining packages
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

# ── 1. Verify Termux environment ──────────────────────────────────────────────
if [ -z "$TERMUX_VERSION" ] && [[ "$PREFIX" != *"com.termux"* ]] && ! command -v pkg > /dev/null 2>&1; then
    log_warn "This script is tailored for Termux on Android."
    log_warn "For standard Linux, please run: ./start.sh or ./setup.sh"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -r choice
    if [[ ! "$choice" =~ ^[Yy]$ ]]; then exit 0; fi
fi

# ── 2. Install system packages ────────────────────────────────────────────────
log_step "[1/5] Installing Termux system packages..."
if command -v pkg > /dev/null 2>&1; then
    log_info "Updating package lists..."
    pkg update -y 2>/dev/null || true

    log_info "Installing system packages (Python, Node.js, build tools, Rust)..."
    # python-pillow: Termux ships a pre-compiled ARM64 Pillow — avoids building from source
    # libyaml: C backend for PyYAML — faster and avoids building in pip
    # libxml2 / libxslt: used by lxml (indirect dep)
    pkg install -y \
        python nodejs-lts git \
        clang make binutils pkg-config \
        libffi libxml2 libxslt libyaml \
        rust cargo \
        curl wget \
        python-pillow \
        termux-tools \
        2>/dev/null || true
else
    log_warn "pkg not found — skipping system package install."
fi

log_ok "System packages ready: $(python3 --version 2>&1), Node $(node -v 2>&1)"

# ── 3. Python Virtual Environment ─────────────────────────────────────────────
log_step "[2/5] Setting up Python virtual environment..."

# ── Why --system-site-packages ────────────────────────────────────────────────
# python-pillow installed via pkg lives in the system Python site-packages
# (/data/data/com.termux/files/usr/lib/python3.x/site-packages/).
# --system-site-packages makes those available inside the venv so we don't
# need to rebuild Pillow from source (which triggers the Python 3.14 pip bug).
#
# Why --without-pip
# python3 -m venv on Python 3.14 bundles a pip that has a broken
# _prevent_import_hook. We skip it entirely and bootstrap a clean pip below.
# ─────────────────────────────────────────────────────────────────────────────

_bootstrap_pip() {
    local GET_PIP="$VENV_DIR/get-pip.py"
    log_info "Downloading get-pip.py from PyPA..."
    if command -v curl > /dev/null 2>&1; then
        curl -fsSL https://bootstrap.pypa.io/get-pip.py -o "$GET_PIP"
    else
        wget -qO "$GET_PIP" https://bootstrap.pypa.io/get-pip.py
    fi
    "$VENV_PYTHON" "$GET_PIP" --quiet
    rm -f "$GET_PIP"
    log_ok "pip $($VENV_PIP --version | awk '{print $2}') bootstrapped"
    # Upgrade pip, wheel, setuptools — these are pure Python, safe to upgrade
    "$VENV_PIP" install --upgrade pip wheel setuptools --quiet
    log_ok "pip, wheel, setuptools up to date"
}

RECREATE=false

# If venv doesn't exist, create it fresh
if [ ! -f "$VENV_PYTHON" ]; then
    log_info "Creating virtualenv (--system-site-packages --without-pip)..."
    python3 -m venv --system-site-packages --without-pip "$VENV_DIR"
    RECREATE=true
fi

# If the existing venv's pip is broken (the Python 3.14 bug), re-bootstrap
if ! "$VENV_PIP" list > /dev/null 2>&1; then
    log_warn "Existing venv pip is broken — re-bootstrapping..."
    RECREATE=true
fi

if [ "$RECREATE" = true ]; then
    _bootstrap_pip
fi

log_ok "Virtual environment ready ($("$VENV_PYTHON" --version 2>&1))"

# ── 4. Install Python packages ────────────────────────────────────────────────
log_step "[3/5] Installing backend Python packages..."

# ── Why --no-build-isolation ──────────────────────────────────────────────────
# When pip builds a C/Rust extension package (pydantic-core, pyyaml, watchdog…)
# it normally spawns a subprocess pip to install build dependencies in an
# isolated environment. That subprocess pip hits the SAME Python 3.14
# _prevent_import_hook bug and crashes.
#
# --no-build-isolation skips that subprocess entirely. pip uses whatever is
# already installed in the active environment as the build toolchain.
# We pre-install all commonly needed build tools first so they're available.
# ─────────────────────────────────────────────────────────────────────────────

log_info "Pre-installing build tools (setuptools, wheel, pybind11, Cython)..."
"$VENV_PIP" install --upgrade \
    setuptools wheel pybind11 Cython \
    --quiet

# ── pydantic-core: Rust extension, needs special handling ─────────────────────
log_info "Checking pydantic-core..."
if ! "$VENV_PYTHON" -c "import pydantic_core" > /dev/null 2>&1; then
    PYDANTIC_OK=false

    # Try community pre-built Android ARM64 wheels first (instant, no Rust compile)
    for INDEX_URL in \
        "https://eutalix.github.io/android-pydantic-core/" \
        "https://termux-python.github.io/termux-wheels/"; do
        log_info "  Trying pre-built wheel from: $INDEX_URL"
        if "$VENV_PIP" install pydantic-core \
            --extra-index-url "$INDEX_URL" \
            --no-build-isolation \
            --quiet 2>/dev/null; then
            PYDANTIC_OK=true
            log_ok "pydantic-core installed from pre-built wheel!"
            break
        fi
    done

    if [ "$PYDANTIC_OK" = false ]; then
        log_warn "No pre-built wheel found — building pydantic-core from source (5-10 min)..."
        log_warn "Keep Termux open and device plugged in."
        CARGO_NET_GIT_FETCH_WITH_CLI=true \
            "$VENV_PIP" install --no-build-isolation pydantic-core
        PYDANTIC_OK=true
    fi

    if ! "$VENV_PYTHON" -c "import pydantic_core" > /dev/null 2>&1; then
        log_err "pydantic-core failed. Try: pkg install rust && rm -rf $VENV_DIR && ./install_termux.sh"
        exit 1
    fi
fi
log_ok "pydantic-core $("$VENV_PYTHON" -c "import pydantic_core; print(pydantic_core.__version__)" 2>/dev/null) ready"

# ── Install remaining requirements ────────────────────────────────────────────
log_info "Installing remaining backend dependencies..."

# Strip Android-incompatible packages:
#   playwright  → no headless Chromium on ARM Android
#   uvicorn[standard] → uvloop doesn't support bionic libc
#   pystray     → requires system tray / display
#   pillow      → installed via pkg (python-pillow), accessible via --system-site-packages
#   pydantic-core → already installed above
sed \
    -e 's/uvicorn\[standard\]/uvicorn/g' \
    -e '/^playwright/Id' \
    -e '/^pystray/Id' \
    -e '/^pillow/Id' \
    -e '/^pydantic-core/Id' \
    "$BACKEND_DIR/requirements.txt" > "$BACKEND_DIR/requirements-termux.tmp"

# Install with --no-build-isolation so pip never spawns a subprocess pip
# (which would hit the Python 3.14 _prevent_import_hook crash)
"$VENV_PIP" install \
    --no-build-isolation \
    -r "$BACKEND_DIR/requirements-termux.tmp" \
    --quiet

rm -f "$BACKEND_DIR/requirements-termux.tmp"
log_ok "Backend dependencies installed."

# ── Verify pillow is accessible ───────────────────────────────────────────────
if "$VENV_PYTHON" -c "from PIL import Image; print('Pillow', Image.__version__)" > /dev/null 2>&1; then
    log_ok "Pillow $("$VENV_PYTHON" -c "from PIL import Image; print(Image.__version__)" 2>/dev/null) available via system package"
else
    log_warn "Pillow not found via system-site-packages — trying pip install with --no-build-isolation..."
    if "$VENV_PIP" install --no-build-isolation pillow --quiet; then
        log_ok "Pillow installed via pip"
    else
        log_warn "Pillow could not be installed — image attachment features may be limited on Android."
    fi
fi

# ── 5. Frontend ───────────────────────────────────────────────────────────────
log_step "[4/5] Checking frontend production assets..."
if [ ! -f "$DIST_INDEX" ]; then
    log_info "Building frontend..."
    (
        cd "$FRONTEND_DIR"
        npm install --no-audit --no-fund
        npm run build
    )
    log_ok "Frontend built successfully."
else
    log_ok "Frontend assets already built."
fi

# ── 6. Termux shortcuts ───────────────────────────────────────────────────────
log_step "[5/5] Configuring Termux launcher shortcuts..."
SHORTCUTS_DIR="$HOME/.shortcuts"
if [ -d "$SHORTCUTS_DIR" ]; then
    cat << 'EOF' > "$SHORTCUTS_DIR/Vault.sh"
#!/usr/bin/env bash
exec bash -c "cd ~/Vault && ./start_termux.sh"
EOF
    chmod +x "$SHORTCUTS_DIR/Vault.sh"
    log_ok "Termux:Widget shortcut created"
fi

echo -e "\n${GREEN}========================================================${NC}"
echo -e "${GREEN}     Vault Termux Installation COMPLETED Successfully!  ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "Launch Vault anytime with: ${CYAN}./start_termux.sh${NC}"
echo -e "Sync notes to Android via: ${CYAN}./sync.sh <desktop-ip>${NC}"
echo -e "========================================================"

read -p $'\nStart Vault now? [Y/n]: ' -r start_now
if [[ "$start_now" =~ ^[Nn]$ ]]; then exit 0; fi

exec "$SCRIPT_DIR/start_termux.sh"
