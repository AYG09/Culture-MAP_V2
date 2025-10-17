# MCP 도구 최적화 가이드

## 문제점
- 157개의 MCP 도구가 활성화되어 성능 저하 발생
- 모든 프로젝트에 불필요한 도구들이 로드됨

## 해결 방법

### 1. 워크스페이스별 설정 (권장)

프로젝트별로 필요한 MCP만 활성화하여 성능 최적화

#### 현재 프로젝트 설정 위치
```
.vscode/mcp.json
```

#### 현재 프로젝트에 활성화된 MCP
- **firebase**: Firebase 관련 작업
- **filesystem**: 파일 시스템 접근 (워크스페이스 폴더만)
- **basic-memory**: 지식 관리 및 메모리
- **context7**: 컨텍스트 관리

### 2. 전역 설정 최소화

전역 설정(`User/mcp.json`)에는 모든 프로젝트에서 공통으로 사용하는 도구만 포함:

- **shrimp-task-manager**: 작업 관리
- **chrome-devtools-mcp**: 브라우저 디버깅
- **Vercel**: 배포 관리
- **GitKraken**: Git 작업
- **sequentialthinking**: 복잡한 문제 해결
- **pylance-mcp-server**: Python 개발 지원

### 3. 제거된 전역 MCP (워크스페이스별로 필요시 추가)

다음 도구들은 전역에서 제거되고 필요한 프로젝트에서만 활성화:

- **tavily**: 웹 검색 (필요시 프로젝트별 추가)
- **context7**: 컨텍스트 관리 (워크스페이스 설정으로 이동)
- **supabase**: Supabase 프로젝트에만 필요
- **filesystem**: 워크스페이스별로 설정
- **basic-memory**: 워크스페이스별로 설정

## 추가 최적화 팁

### 1. 필요시에만 MCP 활성화
특정 작업을 위해 일시적으로 필요한 MCP는:
- 작업 시작 전에 워크스페이스 설정에 추가
- 작업 완료 후 제거 또는 주석 처리

### 2. MCP 서버 선택 기준

#### 전역 설정에 포함할 MCP:
- ✅ 모든 프로젝트에서 자주 사용
- ✅ 시작 시간이 짧음
- ✅ 메모리 사용량이 적음

#### 워크스페이스 설정에 포함할 MCP:
- ✅ 특정 프로젝트/기술 스택에만 필요
- ✅ 대용량 데이터 처리
- ✅ 특정 API 키 필요

### 3. 성능 모니터링

VS Code 개발자 도구로 MCP 성능 확인:
```
도움말 > 개발자 도구 토글 > Console
```

MCP 로딩 시간 확인:
```
MCP 출력 패널 > 각 서버의 초기화 시간 확인
```

## 예상 효과

### 전
- 157개 도구 로드
- 느린 시작 시간
- 높은 메모리 사용량

### 후
- 워크스페이스: ~10개 도구
- 전역: ~6개 도구
- 빠른 시작 시간 ⚡
- 최적화된 메모리 사용량 💾

## 워크스페이스별 MCP 추가 방법

특정 프로젝트에 MCP 추가가 필요한 경우:

```json
// .vscode/mcp.json
{
  "servers": {
    "새로운-mcp": {
      "command": "명령어",
      "args": ["인자"],
      "type": "stdio"
    }
  }
}
```

## 문제 해결

### MCP가 작동하지 않는 경우
1. VS Code 재시작
2. MCP 출력 패널에서 오류 확인
3. 경로 및 명령어 확인

### 도구가 너무 적다고 느껴지는 경우
- 필요한 MCP를 워크스페이스 설정에 추가
- 일시적으로 필요한 경우에만 활성화

## 참고 자료

- [VS Code MCP 문서](https://code.visualstudio.com/docs/copilot/mcp)
- [MCP 서버 목록](https://github.com/modelcontextprotocol/servers)
- [Basic Memory 문서](https://memory.basicmachines.co/)
