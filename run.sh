#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$ROOT_DIR/ports.conf"
export BACKEND_PORT FRONTEND_PORT

# --- Optional .env for local config (Mode A: scan another repo as root) ---
# Create a .env in this directory (see .env.example) and set SWARM_DEBUG_ROOT
# to point the debugger at a different repo. The .env is gitignored and only
# affects local runs.
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

if [ -n "${SWARM_DEBUG_ROOT:-}" ]; then
    if [ ! -d "$SWARM_DEBUG_ROOT" ]; then
        echo "ERROR: SWARM_DEBUG_ROOT='$SWARM_DEBUG_ROOT' is not a directory."
        exit 1
    fi
    SWARM_DEBUG_ROOT="$(cd "$SWARM_DEBUG_ROOT" && pwd)"
    export SWARM_DEBUG_ROOT
    echo "Scanning external repo as root: $SWARM_DEBUG_ROOT"
    echo ""
fi

cleanup() {
    echo ""
    echo "Shutting down all processes..."
    kill 0 2>/dev/null
    wait 2>/dev/null
}
trap cleanup EXIT

BACKEND_URL="http://localhost:${BACKEND_PORT}/api/health/check"
MAX_WAIT=60

bash "$ROOT_DIR/linter/print_errors.sh" "$ROOT_DIR"

echo "Starting backend..."
echo ""

bash "$ROOT_DIR/backend/run.sh" 2>&1 | awk '{printf "\033[34m[backend]\033[0m %s\n", $0; fflush()}' &
BACKEND_PID=$!

echo "Waiting for backend to be ready..."
elapsed=0
while [ $elapsed -lt $MAX_WAIT ]; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERROR: Backend process died before becoming ready. Aborting."
        exit 1
    fi
    if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL" 2>/dev/null | grep -q "200"; then
        echo ""
        echo "Backend is ready! Starting frontend..."
        echo ""
        break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done

if [ $elapsed -ge $MAX_WAIT ]; then
    echo "ERROR: Backend failed to start within ${MAX_WAIT}s. Aborting."
    exit 1
fi

bash "$ROOT_DIR/frontend/run.sh" 2>&1 | awk '{printf "\033[32m[frontend]\033[0m %s\n", $0; fflush()}' &
FRONTEND_PID=$!

while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo ""
        echo "ERROR: Backend process exited. Tearing down..."
        exit 1
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo ""
        echo "ERROR: Frontend process exited. Tearing down..."
        exit 1
    fi
    sleep 2
done
