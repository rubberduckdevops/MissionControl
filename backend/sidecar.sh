#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# MissonControl — Health Monitor Sidecar
#
# Polls the /health endpoint on a configurable interval and emits structured
# log lines. Designed to run as a background process via entrypoint.sh.
#
# Environment variables:
#   PORT                    Port the main service listens on  (default: 8080)
#   SIDECAR_INTERVAL        Seconds between health checks     (default: 30)
#   SIDECAR_STARTUP_DELAY   Seconds to wait before first poll (default: 5)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HOST="localhost"
PORT="${PORT:-8080}"
INTERVAL="${SIDECAR_INTERVAL:-30}"
STARTUP_DELAY="${SIDECAR_STARTUP_DELAY:-5}"
HEALTH_URL="http://${HOST}:${PORT}/health"

log() {
    local level="$1"; shift
    echo "[SIDECAR] [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] $*"
}

log "INFO" "Health monitor starting — target=${HEALTH_URL}, interval=${INTERVAL}s"
log "INFO" "Waiting ${STARTUP_DELAY}s for main process to come up..."
sleep "${STARTUP_DELAY}"

CONSECUTIVE_FAILURES=0

while true; do
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")

    if [ "${HTTP_CODE}" = "200" ]; then
        CONSECUTIVE_FAILURES=0
        log "INFO" "status=OK http=${HTTP_CODE}"
    else
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        log "WARN" "status=DEGRADED http=${HTTP_CODE} consecutive_failures=${CONSECUTIVE_FAILURES}"
    fi

    sleep "${INTERVAL}"
done
