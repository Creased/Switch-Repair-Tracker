@echo off
echo Installing dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo Error installing dependencies.
    pause
    exit /b
)

echo Initializing database if needed...
python -c "from src.app import init_db; import os; print('Database initialized') if not os.path.exists('repairs.db') else None"

echo Starting Switch Repair Tracker...
set PYTHONPATH=%PYTHONPATH%;%CD%
python src/app.py
pause
