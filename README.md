# Minecraft Carpet Pattern Visualizer

Simple Flask app to quickly test randomized carpet patterns with controllable color distribution.

Usage

1. Create and activate a virtualenv (recommended).

Windows (PowerShell):
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

2. Open http://127.0.0.1:5000 in your browser.

Notes
- Select colors and give them weights (the app normalizes weights to a distribution).
- Set `Width` and `Height` to control the number of carpet blocks; `Pixels per block` controls output scale.

Quick start (scripts)

- PowerShell (recommended on Windows): run `run.ps1` in PowerShell. It will create `.venv`, install requirements, and start the app.
- Command Prompt (Windows): run `run.bat`.
- Bash / WSL / Git Bash: run `run.sh`.

Examples:

PowerShell:
```powershell
./run.ps1
```

Bash:
```bash
./run.sh
```

