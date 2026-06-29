@echo off
title gujianzhu-backend
chcp 65001 >nul
echo =========================================
echo   Backend server starting...
echo =========================================
echo.
cd /d "%~dp0backend"
py -m uvicorn main:app --host 0.0.0.0 --port 8090 --reload
pause
