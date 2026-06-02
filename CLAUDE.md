# CLAUDE.md

이 파일은 Claude Code(및 기타 코딩 에이전트)가 이 저장소에서 작업할 때 따르는 지침이다.
한국어 프로젝트이며, UI 문구·주석·커밋 메시지는 기존 코드의 한국어 스타일을 따른다.

## 프로젝트 개요

Culture-MAP V2 — 워크샵/컨설팅용 **실시간 협업 조직문화 맵** 도구.

- 팀이 4층위 컬쳐맵을 공동 편집하고, AI 보조로 노드/연결을 생성·정리·분석한다.
- 구형(`org_culture_analyzer_firebase_clean`, Firebase 기반)을 Liveblocks + Yjs 기반으로 재작성한 v2.
- 라이브 데모: https://culture-map-v2.vercel.app/ (실험용 — 민감/개인/기밀 자료 업로드 금지).

## 자주 쓰는 명령어

```bash
npm run dev          # Vite 개발 서버 (--force)
npm run build        # 프로덕션 빌드
npm run type-check   # tsc --noEmit (타입 검사)
npm run lint         # eslint .
npm run format       # prettier --write (src)
npm run test         # vitest run (단위 테스트)
npm run test:watch   # vitest watch
npm run test:e2e     # playwright (app 프로젝트)
```

변경 후 최소 검증: **`npm run type-check` + `npm run test` + 관련 파일 `npm run lint`**.
단일 테스트 파일: `npx vitest run <path>`.

## 기술 스택

- **Frontend**: React 19, TypeScript(strict), Vite 7
- **Canvas/Flow**: `@xyflow/react`(React Flow 12), 레이아웃 `elkjs`/`dagre`
- **실시간 동기화**: Liveblocks + Yjs (`yjs`, `y-indexeddb`, `y-webrtc`)
- **AI**: `@google/genai` (Gemini) — function calling 포함
- **API(서버리스)**: `api/` (Vercel functions) — auth/session/web-search
- **내보내기**: `exceljs`, `docx`, `jspdf`, `html2canvas`, `pdfjs-dist`
- **테스트**: Vitest(단위), Playwright(E2E)

## 디렉토리 / 핵심 모듈

```text
api/                서버리스 API (admin-auth, sessions, liveblocks-auth, web-search)
public/prompts/     AI 단계별 프롬프트(.md) — 런타임에 fetch (step0~4, workshop 등)
src/components/     React 컴포넌트 (CultureMapFlow, AIChatSidebar, Gateway 등)
  flow-nodes/       층위별 노드 컴포넌트 (Result/Behavior/Tangible/IntangibleLeverNode)
  edges/            AnimatedFlowEdge
src/services/       AIService, LiveblocksService, RagService, GatewayAdminService 등
src/hooks/          useAiActions, useLiveblocksSync, useLayerSystem, useResponsive
src/types/          culture.ts, actions.ts(도구 선언), liveblocks.ts
src/utils/          parser, cultureMapSerializer, flowDataConverter, flowAutoLayout, promptLoader 등
src/contexts/       ConsultingContext
```

## 핵심 도메인 개념

### 4층위 모델 (Dave Gray–Schein)

층위 번호와 인과 방향이 **항상** 다음과 같다 (원인 → 결과, 위→아래 = 아래층이 상위 원인):

| layer | type | 의미 |
|---|---|---|
| 4 | `무형_레버` | 기본 가정·가치·신념 (가장 깊은 원인) |
| 3 | `유형_레버` | 제도·정책·시스템·보상 |
| 2 | `행동` | 구성원 행동 패턴 |
| 1 | `결과` | 성과·KPI (가장 표면 결과) |

- 연결 방향: `sourceId`(원인, 하위 layer 큰 쪽) → `targetId`(결과). 무형(4)→유형(3)→행동(2)→결과(1).
- `NoteData.sentiment`: `positive`(긍정)/`negative`(부정)/`neutral`(중립).
- `basis`(학술 근거 "학자명, 이론명, 연도")는 **레버(유형/무형)에만** — 결과/행동엔 넣지 않는다. 노드 푸터에 표시.

### 모드: 워크샵 vs 컨설팅

`passwordType`로 구분 (`'consulting'` / 그 외 워크샵). `isConsultingMode` 분기.

- **컨설팅 모드만** 빈도/강도(`perceptionIntensity`: high/medium/low = 빈도多/中/少)를 사용. 워크샵 모드에선 intensity/frequency 출력·도구 인자 금지.
- 컨설팅 분석 도구 패널: `ConsultingToolsPanel` (Step 1 1차분석=`step2.md`, **Step 2 컬쳐맵 생성=`step3.md`**, Step 3 진단·전략=`step4*`).

### AI 에이전트 하네스 (앱 내부 AI)

앱은 Gemini를 함수 호출 에이전트로 구동한다. 노드/연결은 **텍스트 파싱이 아니라 함수 호출**로 생성하는 것이 v2 방식이다.

- `src/services/AIService.ts`: 시스템 명령어, 채팅 세션, 스트리밍, grounding 모드(`auto`/`none`/`attached-files-only`/`academic-rag`/`web`/`hybrid`).
- `src/types/actions.ts`: `MAP_TOOL_DECLARATIONS` — 도구 스키마(`add_node`, `add_nodes_with_connections`, `update_node`, `create_connection`, 레이아웃/뷰포트 등). 도구 추가 시 여기 선언 + 페이로드 타입 + 타입가드.
- `src/hooks/useAiActions.ts`: 함수 호출을 실제 노드/연결로 실행하고 Liveblocks에 동기화.
- 강제 도구 호출은 `forceFunctionCall`(= Gemini `ANY` 모드)로, grounding 억제와 분리되어 동작한다.
- 레거시 텍스트 파서 `src/utils/parser.ts`(`parseAIOutput`)는 수동 붙여넣기 일괄 생성용으로만 남아 있다 — 신규 흐름엔 함수 호출을 쓴다.

### 실시간 동기화

- `src/services/LiveblocksService.ts`가 Yjs 문서(`nodes`/`connections` 배열)를 단일 소스로 관리. 노드 변경은 `updateStickyNote`/`updateConnection` 경유.
- 맵 편집 도구는 그룹(전체) 채팅에서만 동작. 1:1 탭에선 비활성.

### 프롬프트

- `public/prompts/*.md` — `promptLoader`(또는 `ConsultingToolsPanel`의 fetch)로 로드, 5분 캐시.
- 프롬프트 수정 시 출력 계약(함수 호출 vs 텍스트)을 코드 실행 경로와 일치시킬 것.

## 코드 표준 / 규칙

- TypeScript strict. `any` 회피, 좁은 타입·타입가드 사용(`actions.ts` 패턴 참고).
- 주변 코드의 스타일·네이밍·주석 밀도를 따른다. UI/주석은 한국어.
- 비밀키 금지: API 키는 `.env.local`/플랫폼 Secret. 저장소에 커밋하지 않는다 (`liveblocks:audit`로 점검).
- 새 도구/필드 추가 시: ① `MAP_TOOL_DECLARATIONS` 선언 ② 페이로드 타입+타입가드(`actions.ts`) ③ `useAiActions` 실행부 ④ `LiveblocksService`/`flowDataConverter` 배선 ⑤ 노드 컴포넌트 표시 — 5곳 일관성 확인.
- 모드 분기: intensity/frequency 관련 코드는 반드시 `isConsultingMode` 가드.

## 테스트

- 단위: `src/**/__tests__/*.test.ts(x)` (Vitest + Testing Library, jsdom).
- E2E: `playwright/`. `npm run test:e2e`.
- `onRunAnalysis` 등 콜백 시그니처 변경 시 `toHaveBeenCalledWith` 인자까지 함께 갱신.

## 환경

- 개발 환경: Windows + PowerShell (npm 스크립트는 크로스플랫폼).
- Node 20+ / npm 10+ 권장. 설치: `npm ci`.

## 하지 말 것

- 워크샵 모드에서 빈도/강도 출력하거나 intensity 도구 인자 전달.
- 컬쳐맵 생성을 텍스트 나열로 처리(파서 의존). 신규 흐름은 함수 호출로 노드 생성.
- 레버가 아닌 노드(결과/행동)에 `basis` 채우기.
- 실제 키/시크릿 커밋. 사용자가 요청하지 않은 커밋/푸시.
