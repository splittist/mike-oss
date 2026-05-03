#!/usr/bin/env bash
# One-command local startup: starts backend (APP_MODE=local) and frontend in parallel.
# Usage: ./start-local.sh
# Stop with Ctrl+C (both processes are killed together).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Stopping..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

echo "Installing dependencies (if needed)..."
npm install --prefix "$REPO_ROOT/backend" --silent
npm install --prefix "$REPO_ROOT/frontend" --silent

echo ""
echo "Starting backend on http://localhost:3001 (APP_MODE=local)..."
APP_MODE=local npm run dev --prefix "$REPO_ROOT/backend" &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:3000..."
npm run dev --prefix "$REPO_ROOT/frontend" &
FRONTEND_PID=$!

echo ""
echo "Both services are starting. Open http://localhost:3000 when ready."
echo "Press Ctrl+C to stop."
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
