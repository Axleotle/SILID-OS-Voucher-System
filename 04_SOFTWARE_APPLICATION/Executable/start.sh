#!/usr/bin/env bash
set -e

echo "============================================================"
echo "  SILID Voucher Service — Startup Script (Linux/macOS)"
echo "  Standalone Voucher Microservice for SILID Malolos"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../Source_Code"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "Please install Node.js v18+ and try again."
    exit 1
fi

# Prepare .env
if [ ! -f .env ] && [ -f .env.example ]; then
    echo "[INFO] Creating .env from .env.example..."
    cp .env.example .env
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing npm dependencies..."
    npm install
fi

# Supabase CLI check
if command -v supabase &> /dev/null; then
    echo "[INFO] Supabase CLI found. Checking status..."
    if ! supabase status &> /dev/null; then
        echo "[INFO] Starting local Supabase containers..."
        supabase start
    fi
    echo "[INFO] Applying migrations..."
    supabase db reset --no-seed
    if [ -f "../Database/seed.sql" ]; then
        supabase db execute -f "../Database/seed.sql"
    fi
else
    echo "[INFO] Supabase CLI not found."
    echo "[INFO] Running in self-contained In-Memory Mock Mode (Zero-setup)."
fi

echo ""
echo "============================================================"
echo "  Starting Next.js Server on http://localhost:3000"
echo "  Staff Portal:  http://localhost:3000/staff"
echo "  Health Check:  http://localhost:3000/api/health"
echo "============================================================"
echo ""

# Clean stale build cache
rm -rf .next

npm run dev
