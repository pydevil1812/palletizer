@echo off
rem Launch the Pallet Stacking Studio desktop application.
cd /d "%~dp0palletizer_source"
python run_app.py
if errorlevel 1 (
  echo.
  echo The app exited with an error. Make sure Python 3 and the required
  echo packages are installed:  pip install matplotlib numpy pandas openpyxl reportlab pillow vtk
  pause
)
