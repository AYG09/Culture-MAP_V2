# AI 자동정렬 최적화 개발 계획서

> **수행 에이전트**: GPT 5.2 CODEX  
> **작성일**: 2026-02-01  
> **프로젝트**: Culture-MAP V2  
> **예상 소요 시간**: 10-14시간

---

## 📋 작업 개요

Culture-MAP V2의 AI 자동정렬 기능을 최적화하고, 코드 안정성을 개선하는 6단계 작업입니다.

### 핵심 목표
1. Race Condition 해결로 액션 실행 순서 보장
2. 타입 안정성 강화로 런타임 에러 방지
3. 자동정렬 전 자동 스냅샷으로 원복 기능 제공
4. 노드별 고정(pinned) 기능으로 사용자 조정 보존
5. 연결선 보존 옵션으로 세밀한 레이아웃 제어

---

## 🗂️ 관련 파일 목록

| 파일 | 역할 | 수정 여부 |
|------|------|----------|
| `src/components/CultureMapFlow.tsx` | 메인 캔버스, 액션 실행 | ✅ 수정 |
| `src/components/AIChatSidebar.tsx` | AI 채팅, 액션 전달 | ✅ 수정 |
| `src/services/AIService.ts` | AI 시스템 프롬프트 | ✅ 수정 |
| `src/types/actions.ts` | 도구 스키마 정의 | ✅ 수정 |
| `src/types/index.ts` 또는 관련 타입 파일 | 타입 가드 추가 | ✅ 수정 |
| `src/utils/layout.ts` | 레이아웃 유틸리티 | ✅ 수정 |

---

## 🔧 작업 1: Race Condition 해결 (Promise 체인)

### 목적
`actionQueue` + `useLayoutEffect` 조합에서 빠른 연속 호출 시 액션 누락 방지

### 수정 파일
`src/components/CultureMapFlow.tsx`

### 현재 문제 코드 위치
- 라인 약 1685-1733: `handleAiAction` 함수
- `setTimeout(() => safeAutoLayout(false), 100)` 패턴

### 구현 지침

#### Step 1.1: 액션 큐 Promise 체인 도입

```typescript
// CultureMapFlow.tsx 상단에 ref 추가
const actionQueuePromiseRef = useRef<Promise<void>>(Promise.resolve());

// executeAiAction을 Promise 반환하도록 수정
const executeAiActionAsync = useCallback(async (action: AiAction): Promise<void> => {
  // 기존 executeAiAction 로직을 async로 변환
  const { name, args } = action;
  
  switch (name) {
    case 'add_node': {
      // ... 기존 로직
      break;
    }
    // ... 다른 케이스들
  }
}, [/* 기존 의존성 */]);
```

#### Step 1.2: handleAiAction 수정

```typescript
const handleAiAction = useCallback((action: AiAction | AiAction[]) => {
  const actions = Array.isArray(action) ? action : [action];
  
  // 모든 액션을 순차적으로 Promise 체인에 추가
  actionQueuePromiseRef.current = actionQueuePromiseRef.current
    .then(async () => {
      for (const act of actions) {
        await executeAiActionAsync(act);
      }
      
      // 모든 액션 완료 후 auto_layout 실행 (suppressed가 아닌 경우)
      const shouldLayout = !actions.some(a => a.__suppressAutoLayout);
      const hasLayoutAction = actions.some(a => a.name === 'auto_layout');
      
      if (shouldLayout || hasLayoutAction) {
        await safeAutoLayout(false);
      }
    })
    .catch((err) => {
      console.error('❌ [CultureMapFlow] Action execution failed:', err);
    });
}, [executeAiActionAsync, safeAutoLayout]);
```

#### Step 1.3: setTimeout 제거

기존의 모든 `setTimeout(() => safeAutoLayout(...), 100)` 패턴을 제거하고, Promise 체인 내에서 `await safeAutoLayout()`으로 대체

### 검증 기준
- [ ] 10개 노드 + 9개 연결 배치 생성 시 모든 노드/연결이 생성됨
- [ ] `add_nodes_with_connections` 호출 후 누락 없이 정렬 완료
- [ ] 콘솔에 Race Condition 관련 경고 없음

---

## 🔧 작업 2: 핵심 타입 가드 도입

### 목적
`as unknown as T` 패턴을 타입 가드로 대체하여 런타임 안전성 확보

### 수정 파일
`src/types/actions.ts` (타입 가드 함수 추가)

### 구현 지침

#### Step 2.1: 타입 가드 함수 추가 (actions.ts 하단)

```typescript
// ============================================
// TYPE GUARDS
// ============================================

export function isAddNodePayload(args: unknown): args is AddNodePayload {
  if (typeof args !== 'object' || args === null) return false;
  const obj = args as Record<string, unknown>;
  return (
    typeof obj.label === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.layer === 'number' &&
    [1, 2, 3, 4].includes(obj.layer as number)
  );
}

export function isAddNodesWithConnectionsPayload(args: unknown): args is AddNodesWithConnectionsPayload {
  if (typeof args !== 'object' || args === null) return false;
  const obj = args as Record<string, unknown>;
  return (
    Array.isArray(obj.nodes) &&
    obj.nodes.every((n: unknown) => {
      if (typeof n !== 'object' || n === null) return false;
      const node = n as Record<string, unknown>;
      return typeof node.label === 'string' && typeof node.layer === 'number';
    })
  );
}

export function isUpdateNodePayload(args: unknown): args is UpdateNodePayload {
  if (typeof args !== 'object' || args === null) return false;
  const obj = args as Record<string, unknown>;
  return typeof obj.id === 'string' && obj.id.length > 0;
}

export function isDeleteNodePayload(args: unknown): args is DeleteNodePayload {
  if (typeof args !== 'object' || args === null) return false;
  const obj = args as Record<string, unknown>;
  return typeof obj.id === 'string' && obj.id.length > 0;
}

export function isCreateConnectionPayload(args: unknown): args is CreateConnectionPayload {
  if (typeof args !== 'object' || args === null) return false;
  const obj = args as Record<string, unknown>;
  return (
    typeof obj.sourceId === 'string' &&
    typeof obj.targetId === 'string' &&
    obj.sourceId.length > 0 &&
    obj.targetId.length > 0
  );
}

export function isDeleteConnectionPayload(args: unknown): args is DeleteConnectionPayload {
  if (typeof args !== 'object' || args === null) return false;
  const obj = args as Record<string, unknown>;
  return typeof obj.id === 'string' && obj.id.length > 0;
}
```

#### Step 2.2: CultureMapFlow.tsx에서 타입 가드 사용

```typescript
// 기존 코드
const payload = (args as unknown) as AddNodePayload;

// 변경 후
if (!isAddNodePayload(args)) {
  console.error('❌ Invalid AddNodePayload:', args);
  break;
}
const payload = args; // 이제 타입이 자동 추론됨
```

### 적용 대상 케이스
- `add_node`
- `add_nodes_with_connections`
- `update_node`
- `delete_node`
- `create_connection`
- `delete_connection`

### 검증 기준
- [ ] 잘못된 페이로드 전달 시 콘솔에 명확한 에러 로그
- [ ] TypeScript 컴파일 에러 없음
- [ ] 기존 정상 동작 유지

---

## 🔧 작업 3: 자동정렬 전 자동 스냅샷 + 원복

### 목적
사용자가 자동정렬 결과가 마음에 들지 않을 때 이전 상태로 쉽게 복원

### 수정 파일
- `src/components/CultureMapFlow.tsx`
- `src/types/actions.ts`
- `src/services/AIService.ts`

### 구현 지침

#### Step 3.1: safeAutoLayout에 자동 스냅샷 저장 추가

```typescript
// CultureMapFlow.tsx - safeAutoLayout 함수 시작부
const safeAutoLayout = useCallback(async (showAlert = false) => {
  // 🔥 자동 정렬 전 스냅샷 자동 저장
  if (reactFlowInstance) {
    const beforeLayout = {
      nodes: reactFlowInstance.getNodes(),
      edges: reactFlowInstance.getEdges(),
      viewport: reactFlowInstance.getViewport(),
      timestamp: Date.now(),
    };
    localStorage.setItem('culture-map-snapshot:_before_layout', JSON.stringify(beforeLayout));
    console.log('📸 [AutoLayout] Pre-layout snapshot saved');
  }

  // ... 기존 레이아웃 로직 계속
```

#### Step 3.2: undo_layout 도구 추가 (actions.ts)

```typescript
// MAP_TOOL_DECLARATIONS 배열에 추가
{
  name: 'undo_layout',
  description: 'Undo the last auto_layout and restore previous node positions. Trigger words: 되돌려, 원복, 취소, 이전으로, undo. Examples: "정렬 취소해줘", "이전 상태로 되돌려"',
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    propertyOrdering: []
  }
}
```

#### Step 3.3: undo_layout 실행 로직 (CultureMapFlow.tsx)

```typescript
case 'undo_layout': {
  if (!reactFlowInstance) break;
  const raw = localStorage.getItem('culture-map-snapshot:_before_layout');
  if (!raw) {
    console.warn('⚠️ No pre-layout snapshot found');
    break;
  }
  try {
    const snapshot = JSON.parse(raw) as {
      nodes?: Node[];
      edges?: Edge[];
      viewport?: { x?: number; y?: number; zoom?: number };
    };
    const restoredNodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
    const restoredEdges = Array.isArray(snapshot.edges) ? snapshot.edges : [];
    
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    nodesRef.current = restoredNodes;
    edgesRef.current = restoredEdges;
    
    // Liveblocks 동기화
    const { notes, connections } = convertFromFlowData(restoredNodes, restoredEdges);
    onNotesChange(notes);
    onConnectionsChange(connections);
    
    if (liveblocksService.isConnected()) {
      // 복원 데이터 동기화
      const lbNotes = notes.map((note) => ({ /* 변환 로직 */ }));
      const lbConnections = connections.map((conn) => ({ /* 변환 로직 */ }));
      liveblocksService.restoreMapData(lbNotes, lbConnections);
    }
    
    console.log('↩️ [UndoLayout] Restored to pre-layout state');
  } catch (err) {
    console.error('❌ Undo layout failed:', err);
  }
  break;
}
```

#### Step 3.4: AI 시스템 프롬프트 업데이트 (AIService.ts)

시스템 프롬프트에 추가:
```
19. 사용자가 "정렬 취소", "되돌려", "원복" 요청 시 undo_layout 사용
```

### 검증 기준
- [ ] 자동정렬 실행 시 `_before_layout` 스냅샷 저장됨
- [ ] "정렬 취소해줘" 요청 시 이전 상태로 복원
- [ ] Liveblocks 환경에서도 복원 데이터 동기화

---

## 🔧 작업 4: 노드 고정(Pinned) 기능

### 목적
사용자가 수동 배치한 노드를 자동정렬에서 제외

### 수정 파일
- `src/types/actions.ts` (도구 스키마)
- `src/components/CultureMapFlow.tsx` (실행 로직)
- `src/components/NoteNode.tsx` (UI 표시 - 선택적)

### 구현 지침

#### Step 4.1: 노드 데이터 타입 확장

```typescript
// 기존 NoteNodeData 인터페이스에 추가 (해당 타입 파일에서)
interface NoteNodeData {
  // ... 기존 속성
  pinned?: boolean;        // true면 auto_layout에서 위치 유지
  pinnedHandles?: boolean; // true면 연결점도 고정
}
```

#### Step 4.2: pin_node / unpin_node 도구 추가

```typescript
// actions.ts - MAP_TOOL_DECLARATIONS에 추가
{
  name: 'pin_node',
  description: 'Pin a node to keep its position during auto_layout. Trigger words: 고정, 핀, 잠금. Examples: "이 노드 고정해줘", "위치 잠가줘"',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Node ID to pin' },
      pinHandles: { type: 'boolean', description: 'Also pin connection handles' }
    },
    required: ['id'],
    propertyOrdering: ['id', 'pinHandles']
  }
},
{
  name: 'unpin_node',
  description: 'Unpin a node to allow repositioning during auto_layout. Trigger words: 고정 해제, 핀 해제, 잠금 해제. Examples: "고정 풀어줘"',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Node ID to unpin' }
    },
    required: ['id'],
    propertyOrdering: ['id']
  }
}
```

#### Step 4.3: safeAutoLayout에서 pinned 노드 제외

```typescript
// safeAutoLayout 함수 내
const { dedupedNodes, duplicateIds } = dedupeNodesById(currentNodes);

// 🔥 Pinned 노드 분리
const pinnedNodes = dedupedNodes.filter(n => n.data?.pinned === true);
const floatingNodes = dedupedNodes.filter(n => n.data?.pinned !== true);

// floatingNodes만 레이아웃 계산
let layoutedFloating: Node[] = [];
if (hasIntraLayerEdges) {
  const result = getLayoutedElements(floatingNodes, filteredEdges, { /* options */ });
  layoutedFloating = result.nodes;
} else {
  const result = await getElkLayoutedElements(floatingNodes, filteredEdges, /* options */);
  layoutedFloating = result.nodes;
}

// 최종 결과: pinned 노드 위치 유지 + floating 노드 새 위치
const layoutedNodes = [...pinnedNodes, ...layoutedFloating];
```

#### Step 4.4: pin_node / unpin_node 실행 로직

```typescript
case 'pin_node': {
  const payload = args as { id: string; pinHandles?: boolean };
  if (!payload.id) break;
  
  setNodes(prev => prev.map(node => 
    node.id === payload.id
      ? { ...node, data: { ...node.data, pinned: true, pinnedHandles: payload.pinHandles ?? false } }
      : node
  ));
  console.log(`📌 Node ${payload.id} pinned`);
  break;
}

case 'unpin_node': {
  const payload = args as { id: string };
  if (!payload.id) break;
  
  setNodes(prev => prev.map(node =>
    node.id === payload.id
      ? { ...node, data: { ...node.data, pinned: false, pinnedHandles: false } }
      : node
  ));
  console.log(`📌 Node ${payload.id} unpinned`);
  break;
}
```

### 검증 기준
- [ ] 고정된 노드가 auto_layout 후에도 위치 유지
- [ ] 고정 해제 후 auto_layout 시 재배치됨
- [ ] 고정 상태가 Liveblocks로 동기화됨

---

## 🔧 작업 5: 연결선 보존 옵션 (preserveEdges)

### 목적
자동정렬 시 연결선의 핸들 위치와 유형을 보존

### 수정 파일
- `src/types/actions.ts`
- `src/components/CultureMapFlow.tsx`

### 구현 지침

#### Step 5.1: auto_layout 스키마 확장

```typescript
// actions.ts - auto_layout 도구 수정
{
  name: 'auto_layout',
  description: 'Call when user wants to organize, arrange, or tidy up the map layout. Trigger words: 정렬, 정리, 배치. Examples: "맵 정렬해줘", "레이아웃 정리".',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      spacing: { 
        type: 'string', 
        enum: ['compact', 'normal', 'wide'], 
        description: 'Node spacing preset (compact=좁게, normal=보통, wide=넓게)' 
      },
      preserveEdges: {
        type: 'boolean',
        description: 'Keep existing edge handles and types unchanged. Default false.'
      }
    },
    propertyOrdering: ['spacing', 'preserveEdges']
  }
}
```

#### Step 5.2: safeAutoLayout에서 preserveEdges 처리

```typescript
// layoutSpacingRef 옆에 추가
const preserveEdgesRef = useRef<boolean>(false);

// auto_layout 케이스에서
case 'auto_layout': {
  const payload = args as { spacing?: string; preserveEdges?: boolean };
  if (payload.spacing) {
    layoutSpacingRef.current = payload.spacing as 'compact' | 'normal' | 'wide';
  }
  preserveEdgesRef.current = payload.preserveEdges ?? false;
  break;
}

// safeAutoLayout 내에서
const applyLayout = () => {
  // ... 레이아웃 계산 후
  
  if (preserveEdgesRef.current) {
    // 기존 엣지의 핸들 정보 보존
    const originalEdgeMap = new Map(currentEdges.map(e => [e.id, e]));
    layoutedEdges = layoutedEdges.map(edge => {
      const original = originalEdgeMap.get(edge.id);
      if (original) {
        return {
          ...edge,
          sourceHandle: original.sourceHandle,
          targetHandle: original.targetHandle,
          type: original.type,
        };
      }
      return edge;
    });
  } else {
    // 기존 로직: applyOptimalHandles() 호출
    layoutedEdges = applyOptimalHandles(layoutedNodes, layoutedEdges);
  }
};
```

### 검증 기준
- [ ] `preserveEdges: true` 시 연결선 핸들 위치 유지
- [ ] `preserveEdges: false` (기본값) 시 기존처럼 최적 핸들 재계산
- [ ] 사용자가 수동 조정한 곡선형 연결선 유지

---

## 🔧 작업 6: 함수 분리 리팩토링 (선택적)

### 목적
300줄 이상의 긴 함수를 기능별로 분리하여 유지보수성 향상

### 대상 함수
- `sendChatMessageStream` (AIService.ts) → 파일 처리 / 스트리밍 / 에러 핸들링 분리
- `executeAiAction` (CultureMapFlow.tsx) → 카테고리별 핸들러 분리

### 구현 지침 (개요)

```typescript
// CultureMapFlow.tsx - 액션 핸들러 분리 예시
const nodeActionHandlers = {
  add_node: (args: unknown) => { /* ... */ },
  update_node: (args: unknown) => { /* ... */ },
  delete_node: (args: unknown) => { /* ... */ },
};

const connectionActionHandlers = {
  create_connection: (args: unknown) => { /* ... */ },
  delete_connection: (args: unknown) => { /* ... */ },
};

const viewportActionHandlers = {
  set_viewport: (args: unknown) => { /* ... */ },
  pan_viewport: (args: unknown) => { /* ... */ },
  zoom_viewport: (args: unknown) => { /* ... */ },
};

// executeAiAction에서 호출
const executeAiAction = (action: AiAction) => {
  const { name, args } = action;
  
  if (name in nodeActionHandlers) {
    return nodeActionHandlers[name as keyof typeof nodeActionHandlers](args);
  }
  if (name in connectionActionHandlers) {
    return connectionActionHandlers[name as keyof typeof connectionActionHandlers](args);
  }
  // ...
};
```

### 우선순위
- 이 작업은 **선택적**이며, 시간 여유가 있을 때 진행
- 작업 1-5 완료 후 코드 안정성 확인 후 진행 권장

---

## ✅ 체크리스트 (최종 검증)

### 빌드 검증
```bash
npm run build
# 에러 없이 완료되어야 함
```

### 타입 검증
```bash
npx tsc --noEmit
# 타입 에러 없어야 함
```

### 기능 테스트 시나리오

| # | 테스트 | 예상 결과 |
|---|--------|----------|
| 1 | "노드 5개 만들어줘" | 5개 노드 + 자동정렬 완료, 누락 없음 |
| 2 | "정렬 취소해줘" | 이전 위치로 복원 |
| 3 | "이 노드 고정해줘" → "정렬해줘" | 고정 노드 위치 유지 |
| 4 | "연결선 유지하면서 정렬해줘" | 핸들 위치 보존 |
| 5 | 잘못된 페이로드 전달 | 콘솔에 명확한 에러 로그 |

### Playwright E2E (선택)
```bash
npm run test:e2e
```

---

## 📝 커밋 가이드

각 작업 완료 시 개별 커밋 권장:

```bash
# 작업 1 완료 후
git add .
git commit -m "fix: resolve race condition in action queue with Promise chain"

# 작업 2 완료 후
git commit -m "refactor: add type guards for AI action payloads"

# 작업 3 완료 후
git commit -m "feat: add undo_layout with automatic pre-layout snapshot"

# 작업 4 완료 후
git commit -m "feat: add pin_node/unpin_node for position preservation"

# 작업 5 완료 후
git commit -m "feat: add preserveEdges option to auto_layout"
```

---

## ⚠️ 주의사항

1. **propertyOrdering 필수**: 모든 Gemini Function Calling 스키마에 `propertyOrdering` 포함
2. **Liveblocks 동기화**: 노드 상태 변경 시 반드시 `liveblocksService` 연동 확인
3. **기존 테스트 유지**: 변경 후 기존 동작이 깨지지 않도록 회귀 테스트
4. **콘솔 로그**: 디버그 로그는 `console.log`로, 에러는 `console.error`로 구분

---

## 📚 참조 문서

- [.agent/skills/gemini-function-calling/SKILL.md](.agent/skills/gemini-function-calling/SKILL.md)
- [.agent/skills/culture-map-ai/SKILL.md](.agent/skills/culture-map-ai/SKILL.md)
- [.github/copilot-instructions.md](.github/copilot-instructions.md)
