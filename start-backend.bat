@echo off
title gujianzhu-backend
chcp 65001 >nul
echo =========================================
echo   Backend server starting...
echo =========================================
echo.
cd /d "%~dp0backend"
python main.py
pause
