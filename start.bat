@echo off
rem Launch Pallet Stacking Studio: installs dependencies on first run, then
rem starts the Python compute/history API and the React dev server, each in
rem its own window. Close those windows to stop the site.

set "ROOT=%~dp0"

rem Defaults (mirrors .env.example)
set "API_HOST=127.0.0.1"
set "API_PORT=5000"
set "DEV_PORT=5173"

rem Override defaults with values from .env (skip comment/blank lines)
if exist "%ROOT%.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%.env") do (
        if not "%%A"=="" if not "%%A"==" " set "%%A=%%B"
    )
)

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
echo   API:  http://%API_HOST%:%API_PORT%
echo   Site: http://localhost:%DEV_PORT%
echo Close those windows (or Ctrl+C in each) to stop the site.
