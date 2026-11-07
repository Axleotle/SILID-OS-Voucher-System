@echo off
title SILID Voucher Service

echo ============================================================
echo   SILID Voucher Service -- Startup Script (Windows)
echo   Standalone Voucher Microservice for SILID Malolos
echo ============================================================
echo.

:: 1. Navigate to Source_Code directory
cd /d "%~dp0..\Source_Code"
if not exist "package.json" (
    echo [ERROR] Could not locate Source_Code\package.json.
    echo Current directory: %CD%
    echo.
    pause
    exit /b 1
)

:: 2. Ensure Node.js is in PATH
if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files (x86)\nodejs" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found.
    echo Please install Node.js v18+ from https://nodejs.org/ and restart your terminal.
    echo.
    pause
    exit /b 1
)

:: 3. Check for .env file
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env >nul
    )
)

:: 4. Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 5. Clean stale build cache to prevent chunk ID mismatch
if exist ".next" (
    rmdir /s /q ".next" >nul 2>nul
)

echo [INFO] Running in self-contained In-Memory Mock Mode (Zero-setup).
echo.
echo ============================================================
echo   Starting Next.js Server on http://localhost:3000
echo   Staff Portal:  http://localhost:3000/staff
echo   Health Check:  http://localhost:3000/api/health
echo ============================================================
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo [SERVER STOPPED OR FAILED]
    pause
)
pause
