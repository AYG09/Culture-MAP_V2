---
description: MCP 기반 고도화 워크플로우 - Sequential Thinking, Tavily, Context7 활용
---

# /MCP 워크플로우

Sequential Thinking, Tavily, Context7 MCP를 활용한 체계적 개발 워크플로우입니다.

---

## 1단계: 지시 의도 심층분석

### 1-1. 코드베이스 탐색
// turbo
- `list_dir`와 `view_file_outline`으로 프로젝트 구조 파악
- 핵심 파일 및 의존성 확인

### 1-1b. SDK/라이브러리 및 문서 기반 최적화 ⚠️ 필수
// turbo
- **기존 코드를 신뢰하지 말 것** - 반드시 최신 공식 문서와 대조하여 최적의 패턴 확인
- **Skill 참조**: 
  - `.agent/skills/sdk-version-check/SKILL.md` (버전 및 Depreation 체크)
  - `.agent/skills/doc-guided-optimization/SKILL.md` (최신 패턴 및 성능 최적화)
  - `.agent/skills/gemini-function-calling/SKILL.md` (Gemini Function Calling 스키마 규칙)
  - `.agent/skills/culture-map-ai/SKILL.md` (Culture-MAP AI 도구 사용 규칙)
  - `.agent/skills/ai-batch-actions/SKILL.md` (노드+연결 배치 생성 규칙)
  - `.agent/skills/ai-coordinate-moves/SKILL.md` (좌표 기반 이동 규칙)
  - `.agent/skills/code-safety-checks/SKILL.md` (변수 스코프, 의존성 배열 체크)
- 외부 API/SDK 사용 코드는 최신 권장 사항(Best Practices) 준수 여부 확인
- 특히 실시간 협업(Liveblocks) 및 AI SDK는 릴리즈 주기가 빠르므로 2025 하반기 기준 최신 문서 필독

### 1-2. MCP 기반 분석 (순서 중요)
1. **Context7** 먼저 사용 - 관련 라이브러리/프레임워크 문서 조회
   - `mcp_context7_resolve-library-id` → `mcp_context7_query-docs`
2. **Tavily** 사용 - 최신 정보, 베스트 프랙티스 검색
   - `mcp_tavily_tavily-search` 또는 `mcp_tavily_tavily-extract`
3. **Sequential Thinking** 사용 - 복잡한 문제 분석
   - `mcp_sequential-thinking_sequentialthinking`

### 1-2b. ⚠️ SDK API 호출 오류 발생 시 필수 점검
> **중요**: SDK 호출 오류가 발생하면 **절대 추측하지 말 것**. 반드시 Context7로 최신 문서 확인.

**공통 오류 패턴 및 대응:**

| 오류 메시지 | 원인 | 해결 방법 |
|-------------|------|-----------|
| `ContentUnion is required` | API 파라미터 형식 불일치 | Context7로 올바른 파라미터 구조 확인 |
| `Cannot read properties of undefined` | 반환값 구조 변경 | 최신 예제 코드에서 반환값 접근 방식 확인 |
| `is not a function` | SDK 메서드명 변경 | 공식 문서에서 현재 메서드명 확인 |

**SDK 오류 디버깅 절차:**
1. 오류 스택트레이스에서 SDK 내부 함수명 확인
2. Context7에서 해당 함수의 최신 시그니처 조회
3. 기존 코드와 공식 문서 예제 비교
4. 차이점 발견 시 공식 문서 패턴으로 수정

**Skill 참조**: `.agent/skills/google-genai-sdk/SKILL.md` (Gemini SDK 전용 가이드)

### 1-2c. 🔍 결론 검증 단계 (⚠️ 필수)
> **Sequential Thinking에서 도출한 결론은 반드시 검증해야 함**

Sequential Thinking을 통해 문제 원인이나 해결책을 도출했다면, **구현 전에 반드시 검증**:

**검증 절차:**
1. **Context7 검증**: 도출한 결론이 공식 문서의 권장 패턴과 일치하는지 확인
   - `mcp_context7_query-docs`로 관련 API/패턴 조회
   - 결론과 공식 문서 사이의 불일치 확인
   
2. **Tavily 검증**: 실제 사례와 커뮤니티 경험 확인
   - `mcp_tavily_tavily-search`로 유사 문제 해결 사례 검색
   - 결론과 다른 해결책이 더 적합한지 검토

3. **불일치 발견 시 대응**:
   | 상황 | 행동 |
   |------|------|
   | 결론 ≠ 공식 문서 | 공식 문서 우선 채택 |
   | 결론 ≠ 커뮤니티 사례 | 양쪽 분석 후 최선책 선택 |
   | 결론 = 공식 + 커뮤니티 | ✅ 검증 완료, 구현 진행 |

**예시**: 
```
가설: "Liveblocks cursor가 표시되지 않는 원인은 sync-complete 이벤트 타이밍"

검증 1 (Context7): Liveblocks presence 공식 문서 → room.subscribe('others') 권장 패턴 확인
검증 2 (Tavily): "Liveblocks cursor not showing" 검색 → 유사 이슈 및 해결책 확인
결과: 가설 수정 또는 확정
```

### 1-3. 역할/작업 정의
- 사용자가 비개발자임을 고려하여 누락된 필수 작업 식별
- 기술적 요구사항을 구체적으로 정의

### 1-4. 리스크 평가
- **치명적 영향 가능성 검토**:
  - 기존 데이터 손실 위험
  - Breaking changes 여부
  - 보안 취약점 발생 가능성
  - 성능 저하 우려
- ⚠️ 리스크 발견 시 → **사용자에게 질의 후 진행**

---

## 2단계: 작업 계획 수립 (Shrimp 사용 + 가드)

### 2-1. Shrimp 기반 계획
- `plan_task` → `analyze_task` → `reflect_task` → `split_tasks`

### 2-1b. Shrimp 실행 가드 (반복 호출 방지)
- `list_tasks`로 상태 확인 후 `execute_task` 1회만 호출
- task가 `in_progress`면 `execute_task` 재호출 금지
- 완료 후 `verify_task` 1회만 호출

### 2-2. 📊 시각적 다이어그램 (선택)

요청이 있거나 복잡한 변경으로 시각화가 필요할 때만 Mermaid 다이어그램 사용:

```mermaid
%% Before 예시
graph TB
    subgraph "Before: 현재 아키텍처"
        A[Component A] --> B[Component B]
    end
```

```mermaid
%% After 예시  
graph TB
    subgraph "After: 변경 후 아키텍처"
        A[Component A] --> C[New Component]
        C --> B[Component B]
    end
```

**다이어그램 유형 가이드:**
| 변경 유형 | 권장 다이어그램 |
|----------|----------------|
| 데이터 흐름 변경 | `flowchart` / `graph` |
| 시퀀스/API 호출 | `sequenceDiagram` |
| 상태 변화 | `stateDiagram-v2` |
| 클래스/컴포넌트 구조 | `classDiagram` |
| 타임라인/마일스톤 | `timeline` |

### 2-3. 🔄 롤백 계획 (중요 변경 시 필수)

**롤백 전략 체크리스트:**
- [ ] **Git 브랜치 전략**: feature 브랜치에서 작업, main 보호
- [ ] **데이터 백업**: 기존 데이터 내보내기/스냅샷
- [ ] **단계적 마이그레이션**: 한 번에 하나의 주요 변경
- [ ] **Feature Flag**: 새 기능 토글 가능하게 구현
- [ ] **롤백 스크립트**: 되돌리기 명령어 문서화

**롤백 시나리오 템플릿:**
```markdown
## 롤백 시나리오: [기능명]

### 트리거 조건
- 조건 1: [언제 롤백할지]
- 조건 2: [어떤 오류가 발생하면]

### 롤백 절차
1. `git revert <commit-hash>` 또는 `git checkout <branch>`
2. [추가 데이터 복구 절차]
3. [서비스 재시작 명령어]

### 영향 범위
- 영향 받는 컴포넌트: [목록]
- 예상 다운타임: [시간]
```

### 2-4. 검증 계획 포함
- 자동화 테스트 명령어
- 수동 검증 항목
- 롤백 테스트 (선택적)

### 2-5. 사용자 승인
- 문서 리뷰 요청은 **사용자 요청 시에만** 수행
- 기본은 채팅에서 확인

---

## 3단계: 작업 세분화

### 3-1. Shrimp 태스크 분해
- `split_tasks` 결과를 기준으로 순차 실행
- 문서화는 사용자 요청 시에만 수행

### 3-2. 작업 우선순위 설정
- 의존성 순서대로 배치
- 롤백 가능한 단위로 분할

---

## 4단계: 단계별 작업 수행

### 4-1. Shrimp 실행 가이드 준수
- `execute_task` 가이드에 따라 구현

### 4-2. 진행률 추적
- `list_tasks`로 상태 확인

### 4-3. 중간 검증
- 주요 마일스톤마다 테스트 실행
- 문제 발견 시 즉시 수정

---

## 5단계: 완료 및 문서화

### 5-1. 변경사항 요약
- 기본은 채팅 내 요약으로 대체
- 새 문서 생성은 사용자 요청 시에만 수행

### 5-2. 최종 검증
- 전체 빌드 테스트
- 주요 기능 동작 확인

### 5-3. 사용자 알림
- 문서 리뷰 요청은 사용자 요청 시에만 수행

---

## 6단계: Skills 검토 및 업데이트
- 반복 패턴/실수 방지/Best Practice가 있으면 `.agent/skills/` 갱신
- lastUpdated 필드 업데이트

---

## 7단계: 완료 보고
- 변경 사항 요약
- 검증 결과 요약
- 다음 액션 제안

---

## MCP 도구 빠른 참조

| MCP | 용도 | 주요 도구 |
|-----|------|-----------|
| **Context7** | 라이브러리 문서 조회 | `resolve-library-id`, `query-docs` |
| **Tavily** | 웹 검색, 콘텐츠 추출 | `tavily-search`, `tavily-extract`, `tavily-crawl` |
| **Sequential Thinking** | 복잡한 문제 단계별 분석 | `sequentialthinking` |
| **Firebase** | Firebase 프로젝트 관리 | `firebase_get_project`, `firebase_init` |
| **Mermaid** | 다이어그램 생성/렌더링 | `render`, `validate`, `save` |

---

## 📦 MCP 설치 가이드

### 필수 MCP 서버

#### 1. Context7 (라이브러리 문서)
```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@context7/mcp-server"]
  }
}
```

#### 2. Tavily (웹 검색)
```json
{
  "tavily": {
    "command": "npx",
    "args": ["-y", "tavily-mcp"],
    "env": {
      "TAVILY_API_KEY": "your-api-key"
    }
  }
}
```
> 🔗 API 키: https://tavily.com에서 발급

#### 3. Sequential Thinking (문제 분석)
```json
{
  "sequential-thinking": {
    "command": "npx",
    "args": ["-y", "@anthropic/mcp-sequential-thinking"]
  }
}
```

#### 4. Firebase (프로젝트 관리)
```json
{
  "firebase-mcp-server": {
    "command": "npx",
    "args": ["-y", "firebase-mcp", "--dir", "."]
  }
}
```

#### 5. Mermaid (다이어그램) - 원격 서버 사용
```json
{
  "mermaid": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://mcp.mermaid.ai/mcp"]
  }
}
```

### 설정 파일 위치
- **Windows**: `%APPDATA%\Code\User\globalStorage\anthropic.claude-vscode\settings\mcp_settings.json`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/anthropic.claude-vscode/settings/mcp_settings.json`
- **Antigravity IDE**: MCP 설정 패널에서 직접 추가

---

// turbo-all
