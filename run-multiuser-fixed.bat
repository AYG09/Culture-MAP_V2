@echo off
chcp 65001 >nul
echo 🚀 조직문화 분석기 멀티유저 모드 시작...
echo.

echo 🔧 기존 프로세스 정리 중...
call kill-ports.bat
echo.

echo ⏳ 포트 완전 해제 대기 중...
timeout /t 3 >nul

echo 📦 패키지 설치 중...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 패키지 설치 실패!
    pause
    exit /b 1
)
echo.

echo 🔄 멀티유저 서버와 클라이언트를 시작합니다...
echo.
echo 💡 브라우저에서 다음 주소로 접속하세요:
echo    - 싱글 모드: http://localhost:5178
echo    - 멀티유저 모드: http://localhost:5178?multiuser=true
echo.
echo 🚨 종료할 때는 Ctrl+C를 눌러주세요!
echo.

REM 멀티유저 모드 실행
start /B call npm run dev:multiuser
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 서버 시작 실패!
    pause
    exit /b 1
)

REM 서버 시작 대기
echo ⏳ 서버 시작 대기 중...
timeout /t 8 >nul

REM 포트 확인
echo 🔍 포트 상태 확인 중...
netstat -an | findstr ":54321 :5178" | findstr "LISTENING"
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  포트가 아직 열리지 않았을 수 있습니다. 조금 더 기다려주세요...
    timeout /t 5 >nul
)

REM 브라우저 자동 열기
echo 🌐 브라우저를 자동으로 열고 있습니다...
start "" "http://localhost:5178?multiuser=true"

echo.
echo ✅ 서버가 실행 중입니다.
echo 💡 브라우저가 자동으로 열리지 않으면 수동으로 접속하세요:
echo    http://localhost:5178?multiuser=true
echo.
echo 📝 서버 상태 모니터링을 위해 창을 열어둡니다...
echo 🛑 서버를 종료하려면 이 창에서 Ctrl+C를 누르거나
echo    kill-ports.bat을 실행하세요.
echo.

REM 서버 로그 출력 대기
pause