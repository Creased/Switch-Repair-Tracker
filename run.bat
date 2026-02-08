@echo off
echo Installing dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo Error installing dependencies.
    pause
    exit /b
)

echo Initializing database if needed...
python -c "from app import init_db; import os; print('Database initialized') if not os.path.exists('repairs.db') else None"

echo Starting Switch Repair Tracker...
python app.py
pause
