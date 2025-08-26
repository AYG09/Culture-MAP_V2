# PowerShell 스크립트로 더 안전한 포트 관리
Write-Host "🚀 조직문화 분석기 멀티유저 모드 시작..." -ForegroundColor Green
Write-Host ""

Write-Host "🔍 기존 포트 사용 프로세스 확인 중..." -ForegroundColor Yellow
Write-Host ""

# 포트 사용 프로세스 확인 및 종료 함수
function Stop-ProcessByPort {
    param([int]$Port)
    
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
                    Where-Object { $_.State -eq "Listen" }
        
        if ($processes) {
            Write-Host "📡 포트 $Port 정리 중..." -ForegroundColor Cyan
            foreach ($process in $processes) {
                $pid = $process.OwningProcess
                try {
                    $processName = Get-Process -Id $pid -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName
                    Write-Host "  - PID $pid ($processName) 종료 중..." -ForegroundColor Gray
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 1
                } catch {
                    Write-Host "  - PID $pid 종료 실패 (이미 종료되었을 수 있음)" -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Host "📡 포트 $Port - 사용 중인 프로세스 없음" -ForegroundColor Green
        }
    } catch {
        Write-Host "📡 포트 $Port 확인 중 오류 발생: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 포트 정리
Stop-ProcessByPort -Port 3001
Stop-ProcessByPort -Port 5173

# 추가 안전 조치 - npm/node 프로세스 정리
Write-Host "🔄 기존 npm/node 프로세스 정리 중..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name npm -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "✅ 포트 정리 완료!" -ForegroundColor Green
Write-Host ""

# 패키지 설치
Write-Host "📦 패키지 설치 중..." -ForegroundColor Cyan
npm install

Write-Host ""

# 포트 완전 해제 대기
Write-Host "⏳ 포트 해제 대기 중..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "🔄 멀티유저 서버와 클라이언트를 시작합니다..." -ForegroundColor Green
Write-Host ""
Write-Host "💡 브라우저에서 다음 주소로 접속하세요:" -ForegroundColor White
Write-Host "   - 싱글 모드: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   - 멀티유저 모드: http://localhost:5173?multiuser=true" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚨 종료할 때는 Ctrl+C를 두 번 눌러주세요!" -ForegroundColor Red
Write-Host ""

# 백그라운드에서 서버 시작
try {
    $job = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run dev:multiuser
    }
    
    Write-Host "⏳ 서버 시작 대기 중..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # 브라우저 자동 열기
    Write-Host "🌐 브라우저를 자동으로 열고 있습니다..." -ForegroundColor Green
    Start-Process "http://localhost:5173?multiuser=true"
    
    Write-Host ""
    Write-Host "✅ 서버가 백그라운드에서 실행 중입니다." -ForegroundColor Green
    Write-Host "💡 브라우저가 자동으로 열리지 않으면 수동으로 접속하세요:" -ForegroundColor White
    Write-Host "   http://localhost:5173?multiuser=true" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚨 서버를 종료하려면 이 창을 닫거나 Ctrl+C를 눌러주세요!" -ForegroundColor Red
    Write-Host ""
    
    # 작업 상태 모니터링
    do {
        Start-Sleep -Seconds 2
        $jobState = Get-Job -Id $job.Id | Select-Object -ExpandProperty State
    } while ($jobState -eq "Running")
    
    Write-Host "🔚 서버가 종료되었습니다." -ForegroundColor Yellow
    
    # 작업 정리
    Remove-Job -Id $job.Id -Force
    
} catch {
    Write-Host "❌ 서버 시작 실패: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Press any key to continue..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")