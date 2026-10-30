#!/usr/bin/env bash
# backend/build.sh — Render build script for Django backend
# Runs on every deploy before the service starts.
set -e

echo "[BUILD] Installing Python dependencies..."
pip install -r requirements.txt

echo "[BUILD] Collecting static files..."
python manage.py collectstatic --no-input

echo "[BUILD] Running database migrations..."
python manage.py migrate --no-input

echo "[BUILD] Build complete."
