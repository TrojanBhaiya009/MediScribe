#!/usr/bin/env bash
# ============================================================
#  MediScribe — One-Click Launcher (Linux / macOS)
#  Starts both backend (FastAPI) and frontend (Next.js)
#  Usage:  chmod +x start.sh && ./start.sh
#  Stop:   Ctrl+C  (kills both processes)
# ============================================================

# Resolve the directory this script lives in (works with symlinks too)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║       🩺  MediScribe Launcher  🩺        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Helper: find a working Python 3 command ──────────────────
find_python() {
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            # Make sure it's actually Python 3
            if "$cmd" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' 2>/dev/null; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

PYTHON_CMD="$(find_python)"
if [ -z "$PYTHON_CMD" ]; then
    echo -e "  ${RED}✖ Python 3 not found!${NC}"
    echo -e "  Install it with your package manager, e.g.:"
    echo -e "    ${CYAN}sudo apt install python3 python3-venv python3-pip${NC}   (Debian/Ubuntu)"
    echo -e "    ${CYAN}sudo dnf install python3${NC}                            (Fedora)"
    echo -e "    ${CYAN}sudo pacman -S python${NC}                               (Arch)"
    exit 1
fi
echo -e "  ${GREEN}✔${NC} Python 3 found: ${CYAN}$($PYTHON_CMD --version 2>&1)${NC}  (${CYAN}$(command -v "$PYTHON_CMD")${NC})"

# ── Load nvm if available (picks up the right Node version) ──
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
fi

# ── Check Node.js & npm ──────────────────────────────────────
MIN_NODE_MAJOR=20

if ! command -v node &>/dev/null; then
    echo -e "  ${RED}✖ Node.js not found!${NC}"
    echo -e "  Install it from ${CYAN}https://nodejs.org${NC} or via your package manager:"
    echo -e "    ${CYAN}sudo apt install nodejs npm${NC}        (Debian/Ubuntu)"
    echo -e "    ${CYAN}sudo dnf install nodejs npm${NC}        (Fedora)"
    echo -e "    ${CYAN}sudo pacman -S nodejs npm${NC}          (Arch)"
    echo -e "  Or use nvm: ${CYAN}https://github.com/nvm-sh/nvm${NC}"
    exit 1
fi

# Verify Node version is >= 20 (required by Next.js 16)
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ] 2>/dev/null; then
    echo -e "  ${RED}✖ Node.js $(node --version) is too old!${NC} Next.js requires ${CYAN}>= v${MIN_NODE_MAJOR}${NC}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        echo -e "  Trying: ${CYAN}nvm install $MIN_NODE_MAJOR${NC}"
        if ! nvm install "$MIN_NODE_MAJOR" || ! nvm use "$MIN_NODE_MAJOR"; then
            echo -e "  ${RED}✖ Could not install Node.js v${MIN_NODE_MAJOR} with nvm.${NC}"
            exit 1
        fi
    else
        echo -e "  Update Node via nvm: ${CYAN}nvm install $MIN_NODE_MAJOR${NC}"
        echo -e "  Or download from: ${CYAN}https://nodejs.org${NC}"
        exit 1
    fi
fi
echo -e "  ${GREEN}✔${NC} Node.js found: ${CYAN}$(node --version)${NC}"

if ! command -v npm &>/dev/null; then
    echo -e "  ${RED}✖ npm not found!${NC} It usually comes with Node.js."
    echo -e "    ${CYAN}sudo apt install npm${NC}"
    exit 1
fi
echo -e "  ${GREEN}✔${NC} npm found: ${CYAN}v$(npm --version)${NC}"
echo ""

# ── Cleanup on exit ───────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    local status=$?
    trap - EXIT SIGINT SIGTERM
    echo ""
    echo -e "${YELLOW}⏹  Shutting down...${NC}"
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        echo -e "${RED}   Backend stopped${NC}"
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        echo -e "${RED}   Frontend stopped${NC}"
    fi
    wait 2>/dev/null
    echo -e "${GREEN}✔  All processes terminated.${NC}"
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' SIGINT
trap 'exit 143' SIGTERM

wait_for_url() {
    local url="$1"
    local pid="$2"
    local attempts="$3"
    local i

    if ! command -v curl &>/dev/null; then
        sleep 2
        kill -0 "$pid" 2>/dev/null
        return
    fi

    for ((i = 0; i < attempts; i++)); do
        if curl --silent --fail --max-time 2 "$url" >/dev/null 2>&1; then
            return 0
        fi
        if ! kill -0 "$pid" 2>/dev/null; then
            return 1
        fi
        sleep 1
    done
    return 1
}

# ── 1. Python Virtual Environment & Dependencies ─────────────
VENV_DIR="$SCRIPT_DIR/.venv_linux"
VENV_PYTHON="$VENV_DIR/bin/python"

echo -e "${BOLD}[1/4] Setting up Python virtual environment...${NC}"

if [ ! -x "$VENV_PYTHON" ]; then
    echo -e "  ${YELLOW}⚠${NC} No venv found — creating one at ${CYAN}.venv_linux/${NC}"
    # python3-venv may not be installed on some distros
    if ! "$PYTHON_CMD" -m venv --clear "$VENV_DIR" 2>/dev/null; then
        echo -e "  ${RED}✖ Failed to create venv. You may need to install the venv module:${NC}"
        echo -e "    ${CYAN}sudo apt install python3-venv${NC}   (Debian/Ubuntu)"
        echo -e "    ${CYAN}sudo dnf install python3-devel${NC}  (Fedora)"
        echo -e "    ${CYAN}sudo pacman -S python${NC}           (Arch — included by default)"
        exit 1
    fi
    echo -e "  ${GREEN}✔${NC} Virtual environment created"
fi

# Virtual environments are not portable, so use their interpreter directly
# instead of trusting an activation script that may contain an old path.
if ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠${NC} pip missing from the virtual environment — repairing it..."
    if ! "$VENV_PYTHON" -m ensurepip --upgrade; then
        echo -e "  ${RED}✖ Could not install pip in the virtual environment.${NC}"
        exit 1
    fi
fi
echo -e "  ${GREEN}✔${NC} Virtual environment ready"

# ── 2. Install Python dependencies ───────────────────────────
echo -e "${BOLD}[2/4] Checking Python dependencies...${NC}"

REQUIREMENTS="$SCRIPT_DIR/backend/requirements.txt"
if [ ! -f "$REQUIREMENTS" ]; then
    echo -e "  ${RED}✖ requirements.txt not found at ${REQUIREMENTS}${NC}"
    exit 1
fi

if ! "$VENV_PYTHON" -m pip install --disable-pip-version-check -q -r "$REQUIREMENTS"; then
    echo -e "  ${RED}✖ pip install failed. Check the errors above.${NC}"
    exit 1
fi
if ! "$VENV_PYTHON" -m pip check >/dev/null; then
    echo -e "  ${RED}✖ Python dependency conflicts detected.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✔${NC} Python dependencies ready"

# ── 3. Start Backend ─────────────────────────────────────────
echo -e "${BOLD}[3/4] Starting Backend (FastAPI)...${NC}"

cd "$SCRIPT_DIR/backend"
"$VENV_PYTHON" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

if ! wait_for_url "http://127.0.0.1:8000/health" "$BACKEND_PID" 30; then
    echo -e "  ${RED}✖ Backend failed its health check! Check the output above.${NC}"
    exit 1
fi

echo -e "  ${GREEN}✔${NC} Backend PID: ${CYAN}$BACKEND_PID${NC}  →  http://localhost:8000"

# ── 4. Start Frontend ────────────────────────────────────────
echo -e "${BOLD}[4/4] Starting Frontend (Next.js)...${NC}"

cd "$SCRIPT_DIR/frontend"

# Keep node_modules synchronized with package.json and package-lock.json.
if ! npm install --no-fund --no-audit; then
    echo -e "  ${RED}✖ npm install failed! Check the errors above.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✔${NC} node_modules ready"

npm run dev &
FRONTEND_PID=$!
if ! wait_for_url "http://127.0.0.1:3000" "$FRONTEND_PID" 60; then
    echo -e "  ${RED}✖ Frontend failed to start! Check the output above.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✔${NC} Frontend PID: ${CYAN}$FRONTEND_PID${NC}  →  http://localhost:3000"

# ── Ready ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅  MediScribe is running!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Backend  →${NC}  http://localhost:8000"
echo -e "  ${CYAN}Frontend →${NC}  http://localhost:3000"
echo -e "  ${CYAN}API Docs →${NC}  http://localhost:8000/docs"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Keep the script alive and stop both services if either one exits.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 1
done

echo -e "${RED}One of the services stopped unexpectedly.${NC}"
exit 1
