# Shrimp Task Manager MCP 설치 완료

## ✅ 설치 상태

### 1. 저장소 클론 및 빌드 완료
- **위치**: `D:\yeonggyu-workspace\mcp-shrimp-task-manager`
- **빌드**: ✅ 완료 (`npm install` && `npm run build`)
- **빌드 파일**: `D:\yeonggyu-workspace\mcp-shrimp-task-manager\dist\index.js`

### 2. 환경 변수 설정 완료
- **파일**: `D:\yeonggyu-workspace\mcp-shrimp-task-manager\.env`
- **설정 내용**:
  ```env
  DATA_DIR=D:\yeonggyu-workspace\mcp-shrimp-task-manager\data
  TEMPLATES_USE=en
  ENABLE_GUI=true
  WEB_PORT=3000
  ```

---

## 🔧 VS Code에서 MCP 서버 사용하기

### 방법 1: GitHub Copilot의 MCP Extension 사용

현재 설치된 확장:
- `automatalabs.copilot-mcp` ✅
- `github.copilot` ✅
- `github.copilot-chat` ✅

### 방법 2: VS Code settings.json에 직접 추가

**파일 위치**: `C:\Users\winte\AppData\Roaming\Code\User\settings.json`

아래 설정을 추가하세요:

```json
{
  "github.copilot.chat.mcp.servers": {
    "shrimp-task-manager": {
      "command": "node",
      "args": [
        "D:\\yeonggyu-workspace\\mcp-shrimp-task-manager\\dist\\index.js"
      ],
      "env": {
        "DATA_DIR": "D:\\yeonggyu-workspace\\mcp-shrimp-task-manager\\data"
      }
    }
  }
}
```

또는 최신 VS Code MCP 설정:

```json
{
  "mcp.servers": {
    "shrimp-task-manager": {
      "command": "node",
      "args": [
        "D:\\yeonggyu-workspace\\mcp-shrimp-task-manager\\dist\\index.js"
      ],
      "env": {
        "DATA_DIR": "D:\\yeonggyu-workspace\\mcp-shrimp-task-manager\\data",
        "TEMPLATES_USE": "en",
        "ENABLE_GUI": "true",
        "WEB_PORT": "3000"
      }
    }
  }
}
```

---

## 🚀 사용 방법

### 1. VS Code 재시작
설정을 추가한 후 VS Code를 재시작하세요.

### 2. GitHub Copilot Chat에서 MCP 도구 사용

Copilot Chat 창에서 다음과 같이 물어보세요:

```
@workspace What MCP tools are available?
```

또는 직접 작업 관리를 요청:

```
Create a new task: Implement user authentication
```

### 3. Shrimp Task Manager 주요 기능

- **planTask**: 작업 계획 수립
- **analyzeTask**: 작업 분석
- **splitTasks**: 작업 분해
- **executeTask**: 작업 실행
- **verifyTask**: 작업 검증
- **completeTask**: 작업 완료
- **listTasks**: 작업 목록 조회
- **queryTask**: 작업 검색

---

## 📊 Web GUI 사용하기

1. `.env` 파일에서 `ENABLE_GUI=true` 설정 확인
2. MCP 서버 실행 후 `D:\yeonggyu-workspace\mcp-shrimp-task-manager\data\WebGUI.md` 파일 확인
3. 해당 파일에 표시된 로컬 주소로 접속 (예: http://localhost:3000)

---

## 🔍 문제 해결

### MCP 서버가 인식되지 않을 때

1. **VS Code 재시작**
2. **Output 패널 확인**: View → Output → "GitHub Copilot" 또는 "MCP" 선택
3. **로그 확인**: 
   ```powershell
   node D:\yeonggyu-workspace\mcp-shrimp-task-manager\dist\index.js
   ```

### Claude Desktop에서도 사용하기 (옵션)

이미 Claude Desktop 설정에 추가되어 있습니다:
- **파일**: `C:\Users\winte\AppData\Roaming\Claude\claude_desktop_config.json`
- Claude Desktop을 재시작하면 사용 가능

---

## 📚 참고 자료

- Shrimp Task Manager GitHub: https://github.com/cjo4m06/mcp-shrimp-task-manager
- MCP 공식 문서: https://modelcontextprotocol.io
- VS Code MCP Extension: https://marketplace.visualstudio.com/items?itemName=automatalabs.copilot-mcp

---

**작성일**: 2025-10-17  
**상태**: ✅ 설치 완료, VS Code 설정 필요
