# AGENTS.md

비-Claude 코딩 에이전트(Codex, Gemini CLI, Copilot 등)용 진입점.

**원본 지침은 [`CLAUDE.md`](./CLAUDE.md)에 있다 — 작업 전 먼저 읽을 것.** 여기서는 도구 종류와 무관한 필수 규칙만 요약한다.

## 핵심 사실

- Culture-MAP V2: React 19 + TypeScript + Vite, React Flow 12, Liveblocks+Yjs(실시간), Gemini(@google/genai) AI.
- 4층위: `무형_레버`(4) → `유형_레버`(3) → `행동`(2) → `결과`(1). 연결은 원인(sourceId) → 결과(targetId), 즉 큰 layer → 작은 layer.
- 모드: 컨설팅(`isConsultingMode`)만 빈도/강도(intensity, 多/中/少) 사용. 워크샵은 미사용.

## 검증

```bash
npm run type-check && npm run test
npm run lint   # 변경 파일
```

## 하드 룰

- 비밀키/시크릿 커밋 금지 (`.env.local`/플랫폼 Secret만).
- 사용자가 요청하지 않은 커밋/푸시 금지.
- 컬쳐맵 노드 생성은 **함수 호출**(`MAP_TOOL_DECLARATIONS` → `useAiActions`)로. 레거시 텍스트 파서(`utils/parser.ts`)는 수동 붙여넣기 전용.
- AI 도구 추가 시 5곳 일관성: 도구 선언(`types/actions.ts`) → 페이로드 타입+타입가드 → `hooks/useAiActions.ts` 실행 → `services/LiveblocksService.ts` 동기화 → 노드 컴포넌트 표시.
- intensity/frequency 코드는 반드시 `isConsultingMode` 가드. 레버가 아닌 노드(결과/행동)에 `basis` 금지.
- UI 문구·주석은 한국어, 주변 코드 스타일 준수.
