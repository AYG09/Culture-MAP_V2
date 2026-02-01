@echo off
setlocal
cd /d "%~dp0"

rem Start Vite dev server and keep the window open
npm run dev
