#!/bin/bash
set -euo pipefail

export MASTER_CONTROL="Alpha"

echo "[ENTRYPOINT] Initialising MissonControl stack..."

# ── Sidecar processes (background) ──────────────────────────────────────────
# Add additional programs here by following the same pattern:
#   /app/your-program &
#   SOME_PID=$!

/app/sidecar.sh &
SIDECAR_PID=$!
echo "[ENTRYPOINT] Sidecar started (pid=${SIDECAR_PID})"

# ── Signal handling & cleanup ────────────────────────────────────────────────
# When the main process exits (or Docker sends SIGTERM), tear down all
# background processes cleanly.
cleanup() {
    echo "[ENTRYPOINT] Shutdown signal received — stopping background processes..."
    kill "${SIDECAR_PID}" 2>/dev/null || true
    wait
    echo "[ENTRYPOINT] All processes stopped."
}
trap cleanup EXIT SIGTERM SIGINT

# ── Main process (foreground) ────────────────────────────────────────────────
echo "[ENTRYPOINT] Starting missoncontrol..."
exec /app/missoncontrol
