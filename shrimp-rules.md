# Development Guidelines
Last updated: 2026-01-27 (auto-6)

## Project Scope and Stack
- Use React 19 + Vite 7 + @xyflow/react + Liveblocks + @google/genai.
- Treat AI tooling and collaboration state as first-class features; never bypass them.

## Architecture and Directory Rules
- Keep UI in src/components, services in src/services, shared types in src/types, utilities in src/utils.
- Do NOT introduce new cross-cutting layers without updating this document.
- Use LiveblocksService.ts for all shared state access and updates.

## Mandatory Workflow
- Use Sequential Thinking MCP for any non-trivial change.
- Use Context7 before changing Liveblocks, @google/genai, or @xyflow/react usage.
- Use Tavily to check 2025/2026 best practices and deprecations.
- Use Shrimp Task Manager for planning/execution with guards:
  - list_tasks로 상태 확인 후 execute_task 1회만 호출
  - in_progress 상태면 execute_task 재호출 금지
  - 완료 후 verify_task 1회만 호출
- Create .agent/brain documentation only when the user explicitly requests it.

## AI Tooling Standards (Gemini)
- Use @google/genai only. Do NOT use @google/generative-ai.
- Every parametersJsonSchema MUST include propertyOrdering.
- Include required arrays for mandatory fields.
- Use enums for constrained choices.
- When adding tools, update these files together:
  - src/types/actions.ts (MAP_TOOL_DECLARATIONS + payload interfaces)
  - src/services/AIService.ts (system instruction + allowed tools)
  - src/components/AIChatSidebar.tsx (UI wiring if needed)
- Use model defaults: gemini-2.5-flash-lite unless explicitly changed.

## Canvas (XYFlow) Standards
- Use ReactFlowInstance APIs (getNodes/getEdges/getViewport/setViewport/fitView).
- Add runtime guards before calling instance methods.
- Keep node state synchronized to Liveblocks immediately after changes.
- Custom nodes must use React.memo.

## Collaboration (Liveblocks/Yjs)
- Use LiveblocksService singleton only.
- Multi-node updates must use Yjs transactions via LiveblocksService helpers.
- Respect StickyNoteData and ConnectionData shapes.

## UI/Styling Rules
- Use lucide-react for icons only.
- Use adjacent .css files for styling. Avoid inline global overrides.
- Prefer CSS variables for themeable values (colors, borders, text).
- Do NOT use direct DOM manipulation.

## Multi-File Coordination Rules
- If you add an AI tool, update src/types/actions.ts, src/services/AIService.ts, and execute handler in src/components/CultureMapFlow.tsx.
- If you change user flows, update playwright/scenarios.spec.ts.
- If you change setup or required env vars, update README.md.

## Prohibited Actions
- Do NOT bypass Gateway authentication.
- Do NOT hardcode secrets; use import.meta.env.
- Do NOT use "Lines omitted" markers in edit tools.
- Do NOT infer API signatures without Context7/Tavily.

## Decision Rules for Ambiguity
- Prefer existing patterns in src/components/CultureMapFlow.tsx and src/services/AIService.ts.
- If unsure, perform code search and reference current usage before making changes.
- Avoid speculative changes; gather evidence first.

## Examples
- ✅ Add tool: update MAP_TOOL_DECLARATIONS + AIService system instruction + CultureMapFlow execute handler.
- ❌ Add tool in actions only; missing AIService or handler changes.
