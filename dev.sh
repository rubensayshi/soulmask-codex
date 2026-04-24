#!/usr/bin/env bash
# Dev runner: starts the Go backend (live-reload on .go changes) + Vite dev server
# concurrently. Ctrl+C tears down both. Vite handles its own HMR.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)

# Preflight: db must exist, and reflex must be on PATH.
if [[ ! -f "$ROOT/data/app.db" ]]; then
    echo "data/app.db missing — run 'make db' first" >&2
    exit 1
fi
if ! command -v reflex >/dev/null 2>&1; then
    echo "reflex not found. Install with: go install github.com/cespare/reflex@latest" >&2
    exit 1
fi

PIDS=()

cleanup() {
    for pid in "${PIDS[@]}"; do
        pkill -P "$pid" 2>/dev/null || true
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(
    cd "$ROOT"
    exec reflex -d none -s -r '(backend/.*\.go|data/app\.db)$' \
        -- sh -c 'cd backend && go run ./cmd/server -dev -db "'"$ROOT"'/data/app.db" '"$*"''
) 2>&1 | sed 's/^/[be] /' &
PIDS+=($!)

(
    cd "$ROOT/web"
    exec pnpm dev
) 2>&1 | sed 's/^/[fe] /' &
PIDS+=($!)

wait
