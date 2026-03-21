---
description: VSCode + GitHub Copilot 전용 MCP 워크플로우 — Shrimp Task Manager 중심
version: 3.0
---

# /MCP-VSCODE 워크플로우

VSCode + GitHub Copilot 환경에서 MCP를 체계적으로 활용하는 워크플로우입니다.

> **Antigravity IDE와의 차이**: VSCode에는 `task_boundary`, `task.md`, `implementation_plan.md` 등의 내장 태스크 관리 기능이 없습니다. 따라서 **Shrimp Task Manager MCP**가 태스크 계획·분해·실행·검증을 담당합니다.

---

## 사용 가능한 MCP 목록

| MCP | 역할 | 주요 도구 |
|-----|------|-----------|
| **Sequential Thinking** | 문제 분해 + 도구 필요성 판단 (게이트키퍼) | `sequentialthinking` |
| **Shrimp Task Manager** | 태스크 계획·분해·실행·검증 (핵심) | `plan_task`, `split_tasks`, `execute_task`, `verify_task` |
| **Context7** | 공식 문서 조회 (1차 소스) | `resolve-library-id`, `query-docs` |
| **Tavily** | 커뮤니티 노하우 (대안 소스) | `tavily-search`, `tavily-extract` |
| **Mermaid** | 다이어그램 생성 | `validate_and_render_mermaid_diagram` |
| **Supabase** | DB 관리 (프로젝트별) | `apply_migration`, `execute_sql` |
| **Vercel** | 배포 관리 (프로젝트별) | `list_projects`, `search_vercel_documentation` |

---

## Phase 0 — 문제 분해 & 도구 필요성 판단 (Sequential Thinking)

> **항상 최우선 실행**. 여기서 후속 Phase의 필요 여부를 결정한다.

`sequentialthinking` 호출:

1. 요청을 하위 문제로 분해
2. 각 단계에서 가설 수립 → 검증 → 수정 반복
3. **도구 필요성 판단**:

```
판단 기준:
├─ SDK/API 사용법이 불확실한가?       → Context7 필요 (Phase 1로)
├─ 새로운 라이브러리를 처음 도입하는가?  → Context7 필요
├─ 에러 원인을 모르겠는가?            → Context7 먼저, 부족하면 Tavily
├─ 최신 트렌드/비교 분석이 필요한가?    → Tavily 필요
├─ 이미 알고 있는 패턴으로 충분한가?    → Phase 2로 직행
└─ 단순 버그 수정/리팩토링인가?        → Phase 2로 직행
```

1. 최종 결론 + 필요 도구 목록 도출

---

## Phase 1 — 기술 검증 (필요시에만)

> **Phase 0에서 "외부 문서 검증 필요"로 판단된 경우에만 실행**

### 1단계: Skills 확인

```
.agent/skills/ 폴더에서 관련 스킬 존재 여부 확인:
- 존재 + 90일 이내 업데이트 → 바로 적용, Context7 스킵 가능
- 존재 + 90일 초과 → Context7로 최신 여부 검증
- 미존재 → 2단계로
```

### 2단계: Context7 (공식 문서 — 1차 소스)

```
호출 순서:
1. resolve-library-id  →  정확한 라이브러리 ID 확보
2. query-docs          →  구체적 query로 문서/예제 조회
```

- query는 **영어로 구체적**으로 작성
- 최대 3회 호출 제한
- **Context7로 충분하면 Phase 2로 진행** (Tavily 불필요)

### 3단계: Tavily (커뮤니티 노하우 — 대안 소스)

> **Context7에서 충분한 정보를 얻지 못한 경우에만** 실행

- `tavily-search`: 에러 메시지 검색, 실전 해결책
- `tavily-research`: 기술 비교, 아키텍처 의사결정
- `tavily-extract`: 특정 블로그/문서 내용 가져오기

### 검증 교차점

| 상황 | 행동 |
|------|------|
| Context7만으로 충분 | ✅ Phase 2로 진행 |
| Context7 부족 → Tavily 보완 | ✅ 양쪽 종합 후 Phase 2로 |
| Phase 0 결론 ≠ 공식 문서 | ⚠️ 공식 문서 우선 |

---

## Phase 2 — 작업 계획 수립 (Shrimp Task Manager)

> **VSCode 핵심**: Antigravity의 `task_boundary` + `task.md`를 Shrimp이 대체

### 2-1. 태스크 계획

```
plan_task → analyze_task → reflect_task → split_tasks
```

### 2-2. Shrimp 실행 가드 (반복 호출 방지)

```
규칙:
- list_tasks로 상태 확인 후 execute_task 1회만 호출
- task가 in_progress면 execute_task 재호출 금지
- 완료 후 verify_task 1회만 호출
```

### 2-3. 다이어그램 (선택)

복잡한 변경 시에만 Mermaid로 Before/After 시각화.

---

## Phase 3 — 구현 & 중간 검증

### 3-1. Shrimp 기반 실행

```
- execute_task 가이드에 따라 구현
- in_progress 상태에서는 코드 수정에 집중
```

### 3-2. 실시간 검증

```
- get_errors: 컴파일 에러 확인
- run_in_terminal: 빌드/테스트 실행
```

### 3-3. SDK 오류 발생 시

Context7로 최신 시그니처 확인 → 공식 패턴으로 수정

---

## Phase 4 — 검증 & 완료

### 4-1. Shrimp 기반 검증

```
- verify_task 1회 호출
- 보완 필요 시에만 추가 수정
```

### 4-2. 브라우저 테스트 (UI 변경 시)

해당 MCP 도구가 있으면 활용, 없으면 수동 테스트.

### 4-3. Skills 업데이트 검토

| 상황 | 행동 |
|------|------|
| Context7에서 새로운 패턴 발견 | 해당 SKILL.md 업데이트, `lastUpdated` 갱신 |
| 새로운 기술/라이브러리 사용 | 신규 SKILL.md 생성 |
| 반복 실수 발견 | 방지 규칙 Skill로 문서화 |

**Skill 생성 기준** (2개 이상 충족 시):

1. ✅ 범용성: 2개 이상 프로젝트에 적용 가능
2. ✅ 반복성: 동일 실수 반복 가능성
3. ✅ 복잡성: 공식 문서만으로 파악 어려운 함정
4. ✅ 시간 절약: 매번 조사보다 문서화가 효율적

### 4-4. 완료 보고

- 변경 사항 요약
- 검증 결과 요약
- 다음 액션 제안

---

## 도구 선택 요약

```
요청 수신
 │
 ▼
Sequential Thinking (항상)
 │
 ├─ "문서 확인 필요" ──→ Skills 확인
 │                          │
 │               있고 최신? ── Yes → Phase 2 (Shrimp)
 │                          │
 │                       No → Context7
 │                              │
 │                    충분?  ── Yes → Phase 2 (Shrimp)
 │                              │
 │                           No → Tavily (대안)
 │                              │
 │                              ▼
 │                        Phase 2 (Shrimp)
 │
 └─ "이미 아는 패턴" ──→ Phase 2 (Shrimp) 직행
```

---

## ⚠️ 핵심 원칙

1. **Sequential Thinking이 게이트키퍼** — 모든 외부 도구 호출은 여기서 필요성을 판단
2. **Context7이 1차 소스** — 공식 문서 항상 우선
3. **Tavily는 대안** — Context7 부족 시에만 커뮤니티 노하우 검색
4. **Shrimp이 태스크 엔진** — VSCode에서 태스크 계획·실행·검증의 핵심
5. **불필요한 MCP 호출 금지** — 이미 아는 패턴이면 바로 구현
6. **검증 없이 완료 아님** — 코드는 테스트 통과 전까지 미완성

---

## Shrimp Task Manager 태스크 관리 규칙

- 태스크는 **세션 간 유지**됨 (DATA_DIR에 JSON 저장)
- 새 작업 시작 시 `clearAllTasks`로 초기화 권장
- `list_tasks`로 항상 현재 상태 먼저 확인
- `execute_task`와 `verify_task`는 **1회만 호출** (반복 금지)
