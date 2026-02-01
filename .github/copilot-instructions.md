# Culture-MAP V2 - Copilot Instructions

## Architecture Overview

Real-time collaborative organizational culture analysis tool using **React 19 + Vite 7 + Liveblocks + Gemini AI**.

```
┌─────────────────────────────────────────────────────────────────┐
│  CultureMapFlow.tsx (Main Canvas)                                │
│  ├── React Flow 12 - Node-based 4-layer culture map             │
│  ├── AIChatSidebar - Gemini/Claude AI with function calling     │
│  └── ReportEditor - AI-generated comprehensive analysis         │
├─────────────────────────────────────────────────────────────────┤
│  Services Layer                                                  │
│  ├── AIService.ts - Gemini (@google/genai) + Claude SDK         │
│  ├── LiveblocksService.ts - CRDT sync via Yjs + Liveblocks      │
│  └── DocumentService.ts - Excel/Word/PDF export                 │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Skills & Workflows

📁 **Reference `.agent/` for detailed rules:**
- [.agent/workflows/MCP.md](.agent/workflows/MCP.md) - MCP 5-step workflow (Sequential Thinking, Context7, Tavily)
- [.agent/skills/gemini-function-calling/SKILL.md](.agent/skills/gemini-function-calling/SKILL.md) - Function calling schema rules
- [.agent/skills/culture-map-ai/SKILL.md](.agent/skills/culture-map-ai/SKILL.md) - AI tool usage & connection rules
- [.agent/skills/google-genai-sdk/SKILL.md](.agent/skills/google-genai-sdk/SKILL.md) - SDK error patterns & solutions
- [.agent/skills/sdk-version-check/SKILL.md](.agent/skills/sdk-version-check/SKILL.md) - Deprecation checks
- [.agent/skills/css-theming/SKILL.md](.agent/skills/css-theming/SKILL.md) - Dark mode CSS variables
- [.agent/skills/code-safety-checks/SKILL.md](.agent/skills/code-safety-checks/SKILL.md) - Variable scope & dependency array checks

## 4-Layer Culture Model

| Layer | 이름 | 설명 | Connection Direction |
|-------|------|------|---------------------|
| 4 | 무형 레버 | 조직의 기본 가정, 가치관 | Source (Cause) ↓ |
| 3 | 유형 레버 | 제도, 정책, 시스템 | ↓ |
| 2 | 행동 | 구성원들의 실제 행동 패턴 | ↓ |
| 1 | 결과 | 성과, 결과물, KPI | Target (Effect) |

**연결 방향**: Layer 4 → 3 → 2 → 1 (원인 → 결과)

## Critical Patterns

### 1. Gemini Function Calling (MANDATORY)
**ALWAYS include `propertyOrdering`** - See [.agent/skills/gemini-function-calling/SKILL.md](.agent/skills/gemini-function-calling/SKILL.md)

```typescript
// src/types/actions.ts - MAP_TOOL_DECLARATIONS
parametersJsonSchema: {
    type: 'object',
    properties: { label: {...}, type: {...}, layer: {...} },
    required: ['label', 'type', 'layer'],
    propertyOrdering: ['label', 'type', 'layer']  // ⬅️ MANDATORY
}
```

**Adding new AI tools:**
1. `src/types/actions.ts` → Add to `MAP_TOOL_DECLARATIONS` (with `propertyOrdering`!)
2. `src/services/AIService.ts` → Update system instructions
3. `src/components/AIChatSidebar.tsx` → Handle action response

### 2. Connection Creation Rules
```
✅ DO: add_node(L4) → add_node(L3) → add_node(L2) → create_connection(L4→L3) → auto_layout()
❌ DON'T: Create nodes without connections, reverse direction (L1→L4)
```

### 3. Real-time Collaboration
Access shared state via **LiveblocksService** singleton only:
- `liveblocksService.getNotesArray()`, `.getConnectionsArray()`
- Use Yjs transactions for multi-node atomic updates

## SDK Version Rules (CRITICAL)

| 패키지 | 상태 | 비고 |
|--------|------|------|
| `@google/generative-ai` | ❌ **Deprecated** | 사용 금지 |
| `@google/genai` | ✅ **권장** | 2025.05~ GA |

### Common SDK Errors

| 오류 | 원인 | 해결 |
|------|------|------|
| `ContentUnion is required` | 잘못된 파라미터 형식 | `{ message: string }` 사용 |
| `Symbol.asyncIterator` | `.stream` 속성 접근 | 반환값 자체가 AsyncIterable |

```typescript
// ✅ 올바른 스트리밍 패턴
const result = await chat.sendMessageStream({ message: 'Hi' });
for await (const chunk of result) { console.log(chunk.text); }
```

## MCP Workflow (Before Any Task)

1. **Context7 먼저** → `mcp_context7_query-docs` (공식 문서 조회)
2. **Tavily 사용** → `mcp_tavily_tavily-search` (최신 정보 검색)
3. **Sequential Thinking** → 복잡한 문제 분석
4. **기존 코드 신뢰 금지** → 반드시 2025/2026 문서와 대조

## SDK/API Limits
- **PDF**: Max 1000 pages → Add to `LARGE_PDF_EXCLUSIONS` if exceeded
- **Images**: Max 3600×3600 pixels
- **Model**: `gemini-2.5-flash-lite` (default), `gemini-2.5-flash-preview-05-20` (for thinking)

## Key Commands
```bash
npm run dev       # Dev server (localhost:5173)
npm run build     # Production build
npm run test:e2e  # Playwright tests
```

## Environment Variables
```env
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_...
VITE_GEMINI_API_KEY=...
VITE_SKIP_GATE=true  # Skip gateway in dev
```

## Styling & Icons
- **Icons**: `lucide-react` only
- **CSS**: Modular files adjacent to components, CSS variables for theming
- **Dark Mode**: `prefers-color-scheme` media query with `--bg-*`, `--text-*` variables
- **Animations**: `framer-motion`

## Prohibited
- ❌ Direct DOM manipulation
- ❌ Hardcoded API keys (use `import.meta.env`)
- ❌ Missing `propertyOrdering` in Gemini schemas
- ❌ Trusting existing code without Context7 verification
- ❌ Using `@google/generative-ai` (deprecated)
- ❌ `{ parts: [...] }` format in sendMessageStream (use `{ message: ... }`)

## /MCP Command (6-Step Workflow)

When user says `/mcp`, `mcp로`, or `MCP 프로세스` → **MUST follow [.agent/workflows/MCP-VSCODE.md](.agent/workflows/MCP-VSCODE.md)**

| Step | Action | MCP Tools |
|------|--------|-----------|
| 1 | 정보 수집 | Context7 → Tavily → Sequential Thinking → **🔍 결론 검증** |
| 2 | 계획 수립 | Shrimp `plan_task` → `analyze_task` → `split_tasks` + Mermaid 시각화 |
| 3 | 실행 | `list_tasks` 확인 → `execute_task` 1회 호출 → 코드 수정/빌드 |
| 4 | 검증 | `verify_task` 1회 호출 + 브라우저 테스트 |
| 5 | 문서화 | 사용자 요청 시 `.agent/brain/` 문서 + Git commit/push |
| 6 | Skills 검토 | 반복 패턴 → 신규 Skill 생성 |
| 7 | 완료 보고 | 변경/검증 요약 + 다음 액션 |

**필수**: Context7 공식 문서 먼저 → Tavily 최신 정보 보조  
**⚠️ 결론 검증**: Sequential Thinking 결론은 반드시 Context7/Tavily로 재검증 후 구현
- ❌ Using `@google/generative-ai` (deprecated)
- ❌ `{ parts: [...] }` format in sendMessageStream (use `{ message: ... }`)
