# Culture-MAP V2 AI Agent Development Rules

**Mandatory project standards for all AI Agents (Copilot, Cursor, etc.).**

## 1. Core Workflow Standards

### 1.1 Reasoning & Planning
- **Sequential Thinking**: You MUST use `mcp_sequential-thinking` for every non-trivial task.
- **Implementation Planning**: Always create or update `implementation_plan.md` before execution.
- **Risk Assessment**: Proactively identify data loss risks or breaking changes in the plan.

### 1.2 Documentation-First Verification
- **Context7**: Before modifying any library-specific code (Liveblocks, Gemini SDK, XYFlow), YOU MUST call `mcp_context7_query-docs` to verify the latest API patterns.
- **Tavily**: Use `mcp_tavily_tavily-search` to check for 2025/2026 best practices and potential deprecations.
- **No Speculation**: Strictly prohibited from guessing API signatures. Use the tools.

## 2. Technology Specific Standards

### 2.1 AI Service (Gemini)
- **Primary Model**: Use `gemini-2.5-flash-lite` for default chatbot and analysis.
- **Skills 자동 검토**: AI 관련 코드 수정 전 `.cursor/rules/` 내 관련 Skills 확인 필수
  - `gemini-api-rules.mdc`: Gemini API 필수 규칙 (propertyOrdering, 파일 제한 등)
  - `ai-service-guard.mdc`: AI 서비스 수정 시 체크리스트
- **Thinking Configuration**:
  - For Gemini 2.x: Set `thinkingBudget: -1` (automatic) or specific token count.
  - For Gemini 3.x: Set `thinkingLevel: 'HIGH'`.
- **Schema 필수 규칙** (Gemini Function Calling):
  - `propertyOrdering`: 모든 parametersJsonSchema에 필수 포함 (출력 순서 강제)
  - `required`: 필수 파라미터 배열 명시
  - `enum`: 제한된 선택지는 enum으로 정의
- **파일 처리 제한**:
  - PDF: 최대 1000 페이지 (초과 시 `LARGE_PDF_EXCLUSIONS`에 추가)
  - 이미지: 최대 3600x3600 픽셀
- **Tool Updates**: When adding new AI capabilities, you MUST update:
  1. `src/types/actions.ts`: Add to `MAP_TOOL_DECLARATIONS` (with `propertyOrdering`!).
  2. `src/services/AIService.ts`: Update system instructions.
  3. `src/components/AIChatSidebar.tsx`: Ensure UI triggers the action.

### 2.2 Collaboration (Liveblocks & Yjs)
- **Doc Access**: Access the shared state ONLY via `LiveblocksService.ts`.
- **Data Types**: All shared nodes must follow `StickyNoteData` interface.
- **Sync Integrity**: Ensure `yDoc` transactions are used for multi-node updates to prevent sync conflicts.

### 2.3 Canvas (XYFlow)
- **Node Component**: Custom nodes must be memoized using `React.memo`.
- **State Flow**: Canvas changes must sync to Liveblocks immediately to maintain multi-user consistency.

## 3. Interaction & Maintenance Rules

### 3.1 Concurrent File Updates
- When changing core business logic, check and update:
  - `shrimp-rules.md`: If architectural rules change.
  - `README.md`: If setup instructions or features change.
  - `playwright/scenarios.spec.ts`: If user flows are affected.

### 3.2 Prohibited Actions
- **Do NOT** use direct DOM manipulation (e.g., `document.getElementById`).
- **Do NOT** bypass the Gateway authentication logic.
- **Do NOT** hardcode API keys. Use `import.meta.env`.
- **Do NOT** provide "Lines omitted" in code snippets for edit tools.

## 4. UI/UX Standards
- **Icons**: Use `lucide-react`.
- **Styling**: Prefer modular CSS (`.css` files adjacent to components).
- **Transitions**: Use `framer-motion` for splash and modal animations.
