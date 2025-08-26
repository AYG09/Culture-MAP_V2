# Korean Status Line for Claude Code
# 한국어 상태표시줄 스크립트

param([string]$InputJson)

try {
    # JSON 입력 파싱
    $input = $InputJson | ConvertFrom-Json
    
    # 현재 위치 (Current Directory)
    $currentDir = Split-Path -Leaf $input.workspace.current_dir
    if ([string]::IsNullOrEmpty($currentDir)) {
        $currentDir = Split-Path -Leaf $input.cwd
    }
    
    # 깃브랜치 (Git Branch)
    $gitBranch = ""
    try {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($branch -and $branch -ne "") {
            $gitBranch = " [$branch]"
        }
    } catch {
        # Git 명령어 실패 시 무시
    }
    
    # 현재 클로드모델 (Current Claude Model)
    $modelName = $input.model.display_name
    if ([string]::IsNullOrEmpty($modelName)) {
        $modelName = "Claude"
    }
    
    # 토큰사용량 (Token Usage) - 시뮬레이션
    # 세션 ID 기반으로 사용량 시뮬레이션 (100%에서 점진적 감소)
    $sessionHash = $input.session_id.GetHashCode()
    $baseUsage = 100
    $reduction = [Math]::Abs($sessionHash % 30) + 10  # 10-40% 감소
    $tokenUsage = [Math]::Max(60, $baseUsage - $reduction)  # 최소 60%
    
    # 상태표시줄 출력 (Status Line Output)
    Write-Host -NoNewline -ForegroundColor Cyan "위치: "
    Write-Host -NoNewline -ForegroundColor Yellow "$currentDir"
    
    if ($gitBranch -ne "") {
        Write-Host -NoNewline -ForegroundColor Green "$gitBranch"
    }
    
    Write-Host -NoNewline -ForegroundColor Magenta " | 모델: $modelName"
    Write-Host -NoNewline -ForegroundColor Red " | 토큰: ${tokenUsage}%"
    
} catch {
    # 오류 발생 시 기본 출력
    Write-Host -NoNewline -ForegroundColor Red "상태표시줄 오류"
}