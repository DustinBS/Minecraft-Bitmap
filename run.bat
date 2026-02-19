@echo off
setlocal
if not exist ".venv\Scripts\python.exe" (
  echo Creating virtualenv...
  python -m venv .venv
)
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
echo Starting app...
.venv\Scripts\python.exe app.py
endlocal
