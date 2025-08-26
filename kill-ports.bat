@echo off
chcp 65001 >nul
echo 🔧 포트 정리 도구
echo.
echo 🔍 포트 54321, 5178 사용 프로세스를 강제 종료합니다...
echo.

REM 포트 3001 사용 프로세스 종료
echo 📡 포트 54321 정리 중...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":54321 " ^| find "LISTENING"') do (
    echo   - PID %%a 종료 중...
    taskkill /PID %%a /F
)

REM 포트 5173 사용 프로세스 종료
echo 📡 포트 5178 정리 중...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5178 " ^| find "LISTENING"') do (
    echo   - PID %%a 종료 중...
    taskkill /PID %%a /F
)

REM 포트 기반 종료만 사용 (안전한 방법)
echo 🔄 포트별 프로세스만 정리합니다 (다른 Node.js 앱은 안전)...

echo.
echo ✅ 포트 정리 완료!
echo.

REM 추가 대기 시간
echo ⏳ 포트 해제 완료 대기...
timeout /t 2 >nul

REM 현재 포트 상태 확인
echo 🔍 현재 포트 상태:
netstat -an | findstr ":54321 :5178" | findstr "LISTENING"
if %ERRORLEVEL% NEQ 0 (
    echo ✅ 포트 54321, 5178이 모두 해제되었습니다.
) else (
    echo ⚠️  일부 포트가 아직 사용 중일 수 있습니다.
)

echo.
pause