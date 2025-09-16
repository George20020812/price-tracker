@echo off
title FB Price Tracker Backend

echo Starting FB Price Tracker backend server...
echo.

REM Change directory to the backend folder
cd backend

REM Activate the virtual environment
echo Activating virtual environment...
call .\venv\Scripts\activate.bat

REM Initialize database (if not already done)
echo Initializing database (if tables do not exist)...
flask init-db

echo.
echo Starting Flask server on http://127.0.0.1:5000
echo Press CTRL+C in this window to stop the server.
echo.

REM Run the Flask application
flask run --port 5001

echo.
echo Server has been stopped.
pause
