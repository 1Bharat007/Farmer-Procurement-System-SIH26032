#!/usr/bin/env bash
# ==============================================================================
# KisanSlot / FarmQueue - Local Development Launcher
# ==============================================================================

cleanup() {
  echo ""
  echo "Shutting down KisanSlot services..."
  kill $(jobs -p) 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo " Starting KisanSlot Platform (SIH 2026 PS-26032) "
echo "============================================================"

echo "-> Starting Django ASGI/HTTP Backend on http://localhost:8000..."
(cd "$SCRIPT_DIR/backend" && ./venv/bin/python manage.py runserver 0.0.0.0:8000) &

echo "-> Starting Next.js 15 Frontend on http://localhost:3000..."
(cd "$SCRIPT_DIR/frontend" && npm run dev) &

echo ""
echo "Services launching in background:"
echo "  • Frontend Portal: http://localhost:3000"
echo "  • Backend API:     http://localhost:8000/api/"
echo "  • Django Admin:    http://localhost:8000/admin/"
echo "Press Ctrl+C to terminate both servers."
echo ""

wait
