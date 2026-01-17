---
name: AI 액션 동기화/상태 일관성 규칙
description: 배치 액션 처리에서 최신 UI 상태를 유지하고 auto_layout/create_connection 누락을 방지하는 가이드
lastUpdated: 2026-01-18
source: React Flow 공식 문서(Context7) + 프로젝트 경험
applies_to: React, @xyflow/react, Liveblocks/Yjs
---

# AI 액션 동기화/상태 일관성 규칙

AI가 도구를 호출해 노드/연결선을 생성할 때 **UI 상태와 공유 상태(Liveblocks)**가 어긋나는 문제를 방지하기 위한 규칙입니다.

---

## 핵심 규칙

1. **UI 상태 먼저 반영**: `create_connection`은 Liveblocks 업데이트 전에 로컬 `setEdges`로 즉시 반영합니다.
2. **refs 즉시 갱신**: 배치 실행 중 `setState`가 비동기이므로 `nodesRef.current`/`edgesRef.current`를 즉시 갱신합니다.
3. **레이아웃은 한 프레임 지연**: `auto_layout`은 `requestAnimationFrame`으로 지연해 최신 상태를 사용합니다.
4. **컨텍스트는 최신 상태 기반**: AI에게 전달하는 맵 컨텍스트는 `nodes/edges` 최신 상태로 생성합니다.

---

## ✅ 올바른 예시 (DO)

```ts
// create_connection 처리 시 로컬 edges 즉시 반영
setEdges((eds) => {
  const updated = addEdge(newEdge, eds);
  edgesRef.current = updated;
  return updated;
});

// 배치 완료 후 auto_layout은 다음 프레임에 실행
requestAnimationFrame(() => safeAutoLayout(false));
```

## ❌ 잘못된 예시 (DON'T)

```ts
// Liveblocks만 업데이트하고 UI edges 미갱신
liveblocksService.updateConnection(...);

// 같은 tick에서 auto_layout 호출 (stale refs)
safeAutoLayout(false);
```

---

## 동기화 순서 가이드

1. `setNodes` / `setEdges`
2. `nodesRef.current` / `edgesRef.current` 갱신
3. `onNotesChange` / `onConnectionsChange`
4. Liveblocks 동기화
5. `auto_layout` (다음 프레임)

---

## 재발 방지 체크리스트

- [ ] `create_connection` 시 `setEdges`로 즉시 반영했는가?
- [ ] 배치 실행 중 refs를 즉시 갱신했는가?
- [ ] `auto_layout`이 최신 refs를 사용하도록 지연 처리했는가?
- [ ] AI 컨텍스트가 최신 nodes/edges로 생성되는가?
