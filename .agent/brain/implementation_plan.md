# Implementation Plan: 도구 호출 누락(코드 출력) 방지 + 규칙/문서 최신화

## 목표
1. AI가 도구 호출을 코드 텍스트로 출력하지 않고 실제 function call로 실행하도록 유도
2. "그렇게 해" 등 확인 응답을 직전 제안 실행으로 해석하도록 규칙 보강
3. MCP-VSCODE 기준으로 .cursorrules 및 .agent/brain 문서 최신화

---

## 핵심 변경 범위

### 1) AI 시스템 프롬프트 보강
- 도구 호출은 코드로 출력하지 말고 function call로 실행하도록 규칙 추가
- 확인 응답("그렇게 해" 등)은 직전 제안 실행으로 처리

### 2) AI 컨텍스트 경고 문구
- AIChatSidebar의 컨텍스트에 도구 호출 코드 출력 금지 문구 추가

### 3) 규칙/문서 최신화
- .cursorrules에 MCP-VSCODE 우선 및 Shrimp 워크플로우 명시
- .agent/brain/task.md, walkthrough.md 갱신

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 프롬프트 길이 증가 | 토큰 비용 증가 | 짧은 규칙 문구로 제한 |
| 과도한 도구 호출 | 오작동 가능성 | 명시 요청/확인 응답에만 트리거 |

---

## 롤백 계획

### 트리거 조건
- AI 컨텍스트에서 노드 ID/층위 표시 오류 재발
- PDF 로드 실패가 증가
- 레이아웃 변경 후 가시성 악화

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- .cursorrules
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run lint
npm run type-check
```

### 수동 검증
1. "노드를 생성해줘" 요청 시 function call이 발생하는지 확인
2. "그렇게 해" 응답 시 직전 제안이 실제 도구 호출로 이어지는지 확인
