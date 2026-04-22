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

BACKEND_PID=""
WEB_PID=""

cleanup() {
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "$WEB_PID"     ]] && kill "$WEB_PID"     2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(
    cd "$ROOT/backend"
    exec reflex -d none -s -r '\.go$' \
        -- go run ./cmd/server -dev -db "$ROOT/data/app.db" "$@"
) 2>&1 | sed 's/^/[be] /' &
BACKEND_PID=$!

(
    cd "$ROOT/web"
    exec pnpm dev
) 2>&1 | sed 's/^/[fe] /' &
WEB_PID=$!

wait
