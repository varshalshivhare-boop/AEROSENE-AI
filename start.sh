#!/bin/bash
# ============================================================
# Aerosense AI — Unified Startup Script
# ============================================================
# Launches both the FastAPI backend (port 8000) and 
# Next.js frontend (port 3000) concurrently.
# 
# Usage: bash start.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║       🛰️  AEROSENSE AI — Environmental Intelligence   ║"
echo "║       Team 404NOTFOUNDERS — Catalyst Hack 2026        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Start Backend API (FastAPI + Uvicorn) ─────────────────
echo "🔧 Starting FastAPI backend on http://localhost:8000 ..."
cd "$SCRIPT_DIR/api_server"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# ── 2. Start Frontend (Next.js) ──────────────────────────────
echo "🖥️  Starting Next.js frontend on http://localhost:3000 ..."
cd "$SCRIPT_DIR/web_client"
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev -- -p 3000 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ Both services starting..."
echo ""
echo " 📡 Backend API:    http://localhost:8000"
echo " 📡 Swagger Docs:   http://localhost:8000/docs"
echo " 🖥️  Frontend:       http://localhost:3000"
echo ""
echo " Press Ctrl+C to stop both services."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Trap cleanup ─────────────────────────────────────────────
cleanup() {
    echo ""
    echo "⏹️  Shutting down Aerosense AI services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo "✅ Shutdown complete."
}
trap cleanup EXIT INT TERM

# Wait for both
wait
