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
GRAY='\033[0;90m'
NC='\033[0m' # No Color

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
if [ -z "$TERMUX_VERSION" ] && [[ "$PREFIX" != *"com.termux"* ]] && ! command -v pkg >/dev/null 2>&1; then
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
if command -v pkg >/dev/null 2>&1; then
    log_info "Updating package lists via pkg..."
    pkg update -y || apt-get update -y

    log_info "Installing Python, Node.js, Rust, and native build dependencies..."
    pkg install -y python nodejs-lts git clang make libffi libxml2 libxslt libyaml rust binutils curl termux-tools || apt-get install -y python nodejs git clang make libffi libxml2 libxslt libyaml rust binutils curl
else
    log_warn "pkg package manager not found. Assuming prerequisites are already installed."
fi

log_ok "Termux system packages ready: Python $(python3 --version 2>&1), Node.js $(node -v 2>&1)"

# 3. Setup Python Virtual Environment
log_step "[2/5] Setting up Python virtual environment in backend/venv..."
if [ ! -f "$VENV_PYTHON" ]; then
    log_info "Creating virtualenv at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi
log_ok "Python virtual environment ready."

log_step "[3/5] Installing backend Python packages..."
"$VENV_PIP" install --upgrade pip wheel setuptools maturin --quiet

# Ensure pydantic-core is installed (using prebuilt Android wheels or native Rust fallback)
log_info "Checking pydantic-core installation for Android..."
if ! "$VENV_PYTHON" -c "import pydantic_core" >/dev/null 2>&1; then
    log_info "Installing pydantic-core (trying precompiled Android wheels first)..."
    if ! "$VENV_PIP" install pydantic-core --extra-index-url https://eutalix.github.io/android-pydantic-core/ --quiet; then
        log_warn "Precompiled wheel not found for this Python version; compiling via native Termux Rust (may take 2-5 minutes)..."
        "$VENV_PIP" install --no-build-isolation pydantic-core
    fi
fi

# Prepare Android-compatible requirements:
# 1. Strip playwright (Chromium headless is not supported on Android ARM)
# 2. Use standard uvicorn instead of uvicorn[standard] (uvloop does not support Android bionic libc)
log_info "Installing backend dependencies from requirements.txt..."
sed -e 's/uvicorn\[standard\]/uvicorn/g' -e '/^playwright/d' "$BACKEND_DIR/requirements.txt" > "$BACKEND_DIR/requirements-termux.tmp"
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
echo -e "You can launch Vault at any time on Android using:      "
echo -e "  ${CYAN}./start_termux.sh${NC}                                   "
echo -e "========================================================\n"

# Offer to start Vault immediately
read -p "Would you like to start Vault right now? [Y/n]: " -r start_now
if [[ "$start_now" =~ ^[Nn]$ ]]; then
    exit 0
fi

# Launch Vault
exec "$SCRIPT_DIR/start_termux.sh"
