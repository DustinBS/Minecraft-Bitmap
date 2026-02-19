#!/usr/bin/env bash
set -e

# Cross-platform runner (bash). Creates .venv if missing, installs requirements, runs app.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON=${PYTHON:-python3}
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  PYTHON=python
fi

if [ ! -d ".venv" ]; then
  echo "Creating virtualenv .venv..."
  "$PYTHON" -m venv .venv
fi

VENV_PY=".venv/bin/python"
if [ ! -f "$VENV_PY" ]; then
  VENV_PY=".venv/Scripts/python.exe"
fi

"$VENV_PY" -m pip install --upgrade pip
"$VENV_PY" -m pip install -r requirements.txt

echo "Starting app..."
"$VENV_PY" app.py
