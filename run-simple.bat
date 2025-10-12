@echo off@echo off

chcp 65001 >nulchcp 65001 >nul

echo.echo 🚀 조직문화 분석기 멀티유저 모드 (간단 실행)

echo ╔════════════════════════════════════════════════════════════════╗echo.

echo ║   🔥 조직문화 분석기 - Firebase 웹서비스                       ║

echo ╚════════════════════════════════════════════════════════════════╝REM 기존 포트 정리

echo.echo 🔧 포트 정리 중...

taskkill /F /IM node.exe >nul 2>&1

REM 패키지 설치 확인timeout /t 2 >nul

echo 📦 패키지 확인 중...

if not exist "node_modules" (REM 패키지 설치

    echo 패키지 설치 중...echo 📦 패키지 확인 중...

    call npm installif not exist "node_modules" (

)    echo 패키지 설치 중...

    call npm install

echo.)

echo 🔄 개발 서버 시작 중...

echo.echo.

echo 🔄 서버 시작 중...

REM 서버를 백그라운드에서 시작하고 5초 후 브라우저 열기echo.

start /B npm run dev

REM 서버를 백그라운드에서 시작하고 5초 후 브라우저 열기

echo ⏳ 서버 시작 대기 중...start /B npm run dev:multiuser

timeout /t 5 >nul

echo ⏳ 서버 시작 대기 중...

echo 🌐 브라우저 열기...timeout /t 5 >nul

start "" "http://localhost:5173"

echo 🌐 멀티유저 모드로 브라우저 열기...

echo.start "" "http://localhost:5173?multiuser=true"

echo ✅ 완료! Firebase 웹서비스가 시작되었습니다.

echo.echo.

echo 📱 접속 주소: http://localhost:5173echo ✅ 완료! 브라우저에서 멀티유저 세션을 시작하세요.

echo.echo.

echo 🚨 서버를 종료하려면 이 창을 닫아주세요.echo 💡 수동 접속 주소:

echo.echo    - 멀티유저: http://localhost:5173?multiuser=true

echo    - 싱글모드: http://localhost:5173

pause >nulecho.

echo 🚨 서버를 종료하려면 이 창을 닫아주세요.
echo.

pause >nul