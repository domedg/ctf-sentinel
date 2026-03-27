@echo off
title CTF Sentinel Server (WSL)
echo Avvio di CTF Sentinel tramite WSL in corso...
cd /d "%~dp0"

:: Avvia il browser su Windows dopo 5 secondi
start /b cmd /c "timeout /t 5 >nul && start http://localhost:3000"

:: Passa il comando al sottosistema Linux (WSL) mantenendo la cartella corrente
wsl bash -lic "npm run dev"
