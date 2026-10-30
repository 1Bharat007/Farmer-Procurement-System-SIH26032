#!/usr/bin/env bash
# frontend/build.sh — Render build script for Next.js frontend
set -e

echo "[BUILD] Installing Node dependencies..."
npm ci

echo "[BUILD] Building Next.js production bundle..."
npm run build

echo "[BUILD] Frontend build complete."
