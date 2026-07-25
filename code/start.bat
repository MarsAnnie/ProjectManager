@echo off
title ProjectManager V1.0.1

echo ============================================
echo   ProjectManager V1.0.1
echo   个人经营驾驶舱 + 项目利润核算系统
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Building Docker images...
docker compose build
if %ERRORLEVEL% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Starting services...
docker compose up -d
if %ERRORLEVEL% neq 0 (
    echo Start failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   ProjectManager is running!
echo.
echo   前端: http://localhost
echo   后端: http://localhost:8000
echo   API文档: http://localhost:8000/docs
echo.
echo   停止: docker compose down
echo ============================================
echo.

start http://localhost

pause
