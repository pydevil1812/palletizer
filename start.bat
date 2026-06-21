@echo off
rem Launch Pallet Stacking Studio: installs dependencies on first run, then
rem starts the Python compute/history API and the React dev server, each in
rem its own window. Close those windows to stop the site.

set "ROOT=%~dp0"

if not exist "%ROOT%palletizer_source\.deps_installed" (
    echo Installing backend dependencies...
    pip install -r "%ROOT%palletizer_source\requirements-server.txt"
    if errorlevel 1 (
        echo Failed to install backend dependencies. Is Python/pip on PATH?
        pause
        exit /b 1
    )
    type nul > "%ROOT%palletizer_source\.deps_installed"
)

if not exist "%ROOT%front\node_modules" (
    echo Installing frontend dependencies...
    call npm install --prefix "%ROOT%front"
    if errorlevel 1 (
        echo Failed to install frontend dependencies. Is Node.js/npm on PATH?
        pause
        exit /b 1
    )
)

start "Pallet API (backend)" cmd /k "cd /d "%ROOT%palletizer_source" && python server.py"
start "Pallet Web App (frontend)" cmd /k "cd /d "%ROOT%front" && npm run dev"

echo.
echo Pallet Stacking Studio is starting in two new windows:
echo   API:  http://127.0.0.1:5000
echo   Site: http://localhost:5173
echo Close those windows (or Ctrl+C in each) to stop the site.
