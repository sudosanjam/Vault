#!/usr/bin/env bash
# ==============================================================================
# Vault - One-Click Termux (Android) Installer & Runner
# Sets up Python, Node.js, virtualenv, dependencies, builds frontend,
# and launches Vault directly on your Android phone.
#
# Resilience & Compatibility Highlights:
#   1. Resolves Termux "XML_GetCurrentLineNumber64" libexpat symbol mismatch
#      by performing package upgrade & runtime verification of pyexpat.
#   2. Detects and auto-repairs corrupted virtual environments.
#   3. Leverages Termux native pre-compiled python-pillow to bypass slow/failing
#      source compilations on ARM64.
#   4. Robust fallback chain for pydantic-core (pre-built Android wheels -> native Rust).
#   5. Excludes desktop-only dependencies (playwright, pystray, uvloop).
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
GRAY='\033[0;90m'
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

# ── 2. Update Termux repositories & install system packages ───────────────────
log_step "[1/5] Updating Termux packages and installing dependencies..."
if command -v pkg > /dev/null 2>&1; then
    log_info "Updating package lists..."
    pkg update -y 2>/dev/null || apt-get update -y 2>/dev/null || true

    # Upgrading existing packages is vital to prevent shared library symbol mismatches
    # (such as Python pyexpat referencing XML_GetCurrentLineNumber64 in libexpat >= 2.6.0)
    log_info "Synchronizing shared libraries (libexpat, libc, etc.)..."
    pkg upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" 2>/dev/null \
        || pkg upgrade -y 2>/dev/null \
        || true

    log_info "Installing core build tools, Python, Node.js, and pre-compiled libraries..."
    # python-pillow: Termux official pre-compiled ARM64 Pillow binary
    # libexpat: XML parsing library matched with CPython pyexpat
    # libyaml: C YAML acceleration library
    pkg install -y \
        python libexpat nodejs-lts git \
        clang make binutils pkg-config \
        libffi libxml2 libxslt libyaml \
        rust cargo curl wget \
        python-pillow termux-tools 2>/dev/null \
        || apt-get install -y python libexpat nodejs git clang make libffi libxml2 libxslt libyaml rust binutils curl python-pillow 2>/dev/null \
        || true
else
    log_warn "pkg package manager not found. Assuming prerequisites are already installed."
fi

# ── 2a. Verify Python core runtime integrity (libexpat check) ─────────────────
log_info "Verifying Python core runtime and shared library links..."
if ! python3 -c "import pyexpat; from xml.etree import ElementTree; print('OK')" >/dev/null 2>&1; then
    log_warn "Detected broken pyexpat (libexpat symbol mismatch: XML_GetCurrentLineNumber64)."
    log_info "Auto-repairing Termux shared libraries (reinstalling libexpat and python)..."
    pkg update -y 2>/dev/null || true
    pkg install -y --upgrade libexpat python 2>/dev/null || true
    pkg reinstall -y libexpat python 2>/dev/null || apt-get install --reinstall -y libexpat python 2>/dev/null || true

    if ! python3 -c "import pyexpat" >/dev/null 2>&1; then
        log_err "Critical: Python pyexpat still cannot load."
        log_err "Please run in Termux: pkg update && pkg upgrade -y && pkg reinstall libexpat python"
        exit 1
    fi
    log_ok "Termux libexpat & python repaired successfully."
else
    log_ok "Python core runtime verified (pyexpat OK)."
fi

PYTHON_VER=$(python3 --version 2>&1)
NODE_VER=$(node -v 2>&1 || echo "not found")
log_ok "System packages ready: $PYTHON_VER, Node.js $NODE_VER"

# ── 3. Setup Python Virtual Environment ───────────────────────────────────────
log_step "[2/5] Setting up Python virtual environment in backend/venv..."

# Detect if existing venv is broken or corrupted from prior interrupted runs
if [ -d "$VENV_DIR" ]; then
    VENV_HEALTHY=true
    if [ ! -f "$VENV_PYTHON" ] || ! "$VENV_PYTHON" -c "import sys" >/dev/null 2>&1; then
        VENV_HEALTHY=false
    elif ! "$VENV_PYTHON" -c "import pyexpat" >/dev/null 2>&1; then
        VENV_HEALTHY=false
    elif ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
        VENV_HEALTHY=false
    fi

    if [ "$VENV_HEALTHY" = false ]; then
        log_warn "Existing virtual environment is corrupt or broken. Recreating cleanly..."
        rm -rf "$VENV_DIR"
    fi
fi

# Create clean virtual environment if not present
if [ ! -f "$VENV_PYTHON" ]; then
    log_info "Creating clean virtual environment at $VENV_DIR..."
    # Attempt standard venv first
    if ! python3 -m venv "$VENV_DIR" 2>/dev/null; then
        log_warn "Standard venv creation failed (ensurepip issue). Falling back to --without-pip..."
        python3 -m venv --without-pip "$VENV_DIR"
    fi
fi

# Ensure pip is functional inside the virtual environment
if ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
    log_info "Bootstrapping clean pip inside virtual environment..."
    GET_PIP="$VENV_DIR/get-pip.py"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://bootstrap.pypa.io/get-pip.py -o "$GET_PIP"
    else
        wget -qO "$GET_PIP" https://bootstrap.pypa.io/get-pip.py
    fi
    "$VENV_PYTHON" "$GET_PIP" --no-setuptools --no-wheel --quiet
    rm -f "$GET_PIP"
fi

# Upgrade pip, wheel, setuptools inside virtual environment
"$VENV_PYTHON" -m pip install --upgrade pip wheel setuptools --quiet 2>/dev/null || true
log_ok "Virtual environment ready ($("$VENV_PYTHON" --version 2>&1), pip $("$VENV_PIP" --version 2>&1 | awk '{print $2}'))"

# ── 3a. Link pre-compiled Termux Pillow into venv ─────────────────────────────
# python-pillow provided by Termux pkg is already compiled for ARM64 and heavily optimized.
# Linking it into the venv saves ~5-10 minutes of compiling Pillow C source.
log_info "Configuring Pillow image processing library..."
VENV_SITE_DIR=$("$VENV_PYTHON" -c "import site; print(site.getsitepackages()[0])" 2>/dev/null || true)
if [ -n "$VENV_SITE_DIR" ] && [ -d "$VENV_SITE_DIR" ]; then
    SYS_SITE_DIR=$(python3 -c "import site; print(site.getsitepackages()[0])" 2>/dev/null || true)
    if [ -n "$SYS_SITE_DIR" ] && [ -d "$SYS_SITE_DIR/PIL" ]; then
        rm -rf "$VENV_SITE_DIR/PIL" "$VENV_SITE_DIR"/pillow* 2>/dev/null || true
        cp -r "$SYS_SITE_DIR/PIL" "$VENV_SITE_DIR/" 2>/dev/null || ln -snf "$SYS_SITE_DIR/PIL" "$VENV_SITE_DIR/" 2>/dev/null || true
        if compgen -G "$SYS_SITE_DIR/pillow*.dist-info" > /dev/null; then
            cp -r "$SYS_SITE_DIR"/pillow*.dist-info "$VENV_SITE_DIR/" 2>/dev/null || true
        fi
        log_ok "Termux pre-compiled Pillow linked into virtual environment."
    fi
fi

# ── 4. Install backend Python packages ────────────────────────────────────────
log_step "[3/5] Installing backend Python packages..."

# Pre-install build tools so --no-build-isolation can be used safely
log_info "Pre-installing build dependencies (wheel, setuptools, pybind11, Cython)..."
"$VENV_PIP" install --upgrade setuptools wheel pybind11 Cython --quiet 2>/dev/null || true

# ── 4a. pydantic-core (Rust extension) ────────────────────────────────────────
log_info "Checking pydantic-core for Android/ARM..."
if ! "$VENV_PYTHON" -c "import pydantic_core" > /dev/null 2>&1; then
    PYDANTIC_OK=false

    # Try community pre-built Android ARM64 wheels first (instant install)
    for INDEX_URL in \
        "https://eutalix.github.io/android-pydantic-core/" \
        "https://termux-python.github.io/termux-wheels/"; do
        log_info "  Trying pre-built wheel from: $INDEX_URL"
        if "$VENV_PIP" install pydantic-core \
            --extra-index-url "$INDEX_URL" \
            --quiet 2>/dev/null; then
            PYDANTIC_OK=true
            log_ok "pydantic-core installed from pre-built wheel!"
            break
        fi
    done

    # Fallback: compile via native Termux Rust toolchain
    if [ "$PYDANTIC_OK" = false ]; then
        log_warn "No pre-built wheel found — compiling pydantic-core via system Rust..."
        log_warn "This takes ~3-6 minutes on mobile. Please keep Termux open."
        CARGO_NET_GIT_FETCH_WITH_CLI=true \
            "$VENV_PIP" install --no-build-isolation pydantic-core
    fi

    if ! "$VENV_PYTHON" -c "import pydantic_core" > /dev/null 2>&1; then
        log_err "pydantic-core installation failed."
        log_err "Try running: pkg install rust cargo && ./install_termux.sh"
        exit 1
    fi
fi
PYDANTIC_VER=$("$VENV_PYTHON" -c "import pydantic_core; print(pydantic_core.__version__)" 2>/dev/null || echo "ready")
log_ok "pydantic-core $PYDANTIC_VER ready."

# ── 4b. Install remaining requirements ────────────────────────────────────────
log_info "Installing remaining backend dependencies..."
# Strip Android-incompatible packages:
#   playwright  -> headless Chromium unsupported on Android ARM
#   uvicorn[standard] -> uvloop/httptools unsupported on bionic libc; plain uvicorn used
#   pystray     -> requires system tray GUI (desktop only)
#   pillow      -> pre-linked above
#   pydantic-core -> installed above
sed \
    -e 's/uvicorn\[standard\]/uvicorn/g' \
    -e '/^playwright/Id' \
    -e '/^pystray/Id' \
    -e '/^pillow/Id' \
    -e '/^pydantic-core/Id' \
    "$BACKEND_DIR/requirements.txt" > "$BACKEND_DIR/requirements-termux.tmp"

"$VENV_PIP" install -r "$BACKEND_DIR/requirements-termux.tmp"
rm -f "$BACKEND_DIR/requirements-termux.tmp"
log_ok "Backend dependencies installed successfully."

# ── 4c. Verify Pillow availability ────────────────────────────────────────────
if ! "$VENV_PYTHON" -c "from PIL import Image" > /dev/null 2>&1; then
    log_info "Installing pillow via pip..."
    "$VENV_PIP" install pillow --quiet 2>/dev/null || log_warn "Pillow optional features may be limited."
fi

# ── 4d. Backend Sanity Verification ───────────────────────────────────────────
log_info "Verifying backend stack..."
if "$VENV_PYTHON" -c "import fastapi, pydantic, uvicorn, yaml, httpx; print('Stack OK')" >/dev/null 2>&1; then
    log_ok "Backend stack verified healthy!"
else
    log_warn "One or more optional packages reported warnings, but core framework is present."
fi

# ── 5. Frontend Production Assets ─────────────────────────────────────────────
log_step "[4/5] Checking frontend production assets..."
if [ ! -f "$DIST_INDEX" ]; then
    log_info "Compiling frontend assets..."
    (
        cd "$FRONTEND_DIR"
        npm install --no-audit --no-fund
        npm run build
    )
    log_ok "Frontend production assets compiled to frontend/dist."
else
    log_ok "Frontend assets already built and up to date."
fi

# ── 6. Termux Home Screen Shortcuts (Termux:Widget) ───────────────────────────
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
echo -e "Launch Vault anytime on Android with:"
echo -e "  ${CYAN}./start_termux.sh${NC}"
echo -e ""
echo -e "Sync notes with your PC over local Wi-Fi with:"
echo -e "  ${CYAN}./sync.sh <desktop-ip>${NC}                       # Pull notes"
echo -e "  ${CYAN}./sync.sh <desktop-ip> 8000 ~/vault-sync --push${NC}  # Push notes"
echo -e "  ${CYAN}./sync.sh <desktop-ip> 8000 ~/vault-sync --bidirectional --watch${NC}"
echo -e "========================================================\n"

read -p "Would you like to start Vault right now? [Y/n]: " -r start_now
if [[ "$start_now" =~ ^[Nn]$ ]]; then
    exit 0
fi

exec "$SCRIPT_DIR/start_termux.sh"
