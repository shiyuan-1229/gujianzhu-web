@echo off
chcp 65001 >nul
echo ════════════════════════════════════════
echo   古建智寻 — 后端服务启动中...
echo ════════════════════════════════════════
echo.
cd /d "%~dp0backend"
python main.py
pause
