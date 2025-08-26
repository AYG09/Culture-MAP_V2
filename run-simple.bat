@echo off
chcp 65001 >nul
echo 🚀 조직문화 분석기 멀티유저 모드 (간단 실행)
echo.

REM 기존 포트 정리
echo 🔧 포트 정리 중...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

REM 패키지 설치
echo 📦 패키지 확인 중...
if not exist "node_modules" (
    echo 패키지 설치 중...
    call npm install
)

echo.
echo 🔄 서버 시작 중...
echo.

REM 서버를 백그라운드에서 시작하고 5초 후 브라우저 열기
start /B npm run dev:multiuser

echo ⏳ 서버 시작 대기 중...
timeout /t 5 >nul

echo 🌐 멀티유저 모드로 브라우저 열기...
start "" "http://localhost:5173?multiuser=true"

echo.
echo ✅ 완료! 브라우저에서 멀티유저 세션을 시작하세요.
echo.
echo 💡 수동 접속 주소:
echo    - 멀티유저: http://localhost:5173?multiuser=true
echo    - 싱글모드: http://localhost:5173
echo.
echo 🚨 서버를 종료하려면 이 창을 닫아주세요.
echo.

pause >nul