#!/bin/bash
set -e

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Initializing database if needed..."
python3 -c "from src.app import init_db; import os; print('Database initialized') if not os.path.exists('repairs.db') else None"

echo "Starting Switch Repair Tracker..."
export PYTHONPATH=$PYTHONPATH:$(pwd)
python3 src/app.py
