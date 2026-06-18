#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting backend..."
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt -q
else
  source .venv/bin/activate
fi
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
