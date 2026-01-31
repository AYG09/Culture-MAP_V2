---
name: Liveblocks Cursor Presence
description: Liveblocks 실시간 커서 presence 구현 시 React 훅 vs 저수준 API 선택 가이드
category: real-time-collaboration
tags: [liveblocks, presence, cursor, useOthers, room.subscribe]
lastUpdated: 2026-01-31
---

# Liveblocks Cursor Presence Skill

## 문제 패턴

### 증상
- 실시간 커서가 **간헐적으로 표시되지 않음**
- 세션 재입장 시 다른 사용자 커서가 보이지 않음
- "어쩔 땐 있고, 어쩔땐 없고" 형태의 불안정한 동작

### 근본 원인
저수준 API(`room.subscribe('others')`)를 사용할 때:
1. **sync-complete 이벤트 의존성** - 이미 synced 상태면 이벤트가 발생하지 않음
2. **isConnected() 체크 타이밍** - 초기 렌더링 시 false 반환 가능
3. **Race Condition** - 구독 설정 전에 다른 사용자가 입장할 수 있음

## 해결 패턴

### ✅ 권장: Liveblocks React 훅 사용

```tsx
// liveblocks.config.ts
declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      userName?: string;
      userColor?: string;
    };
  }
}

// 컴포넌트
import { useOthers, useUpdateMyPresence } from '@liveblocks/react';

function Component() {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  
  // 다른 사용자 커서 자동 구독 (RoomProvider 내부에서만 작동)
  const cursors = others
    .filter((o) => o.presence?.cursor)
    .map((o) => ({
      id: o.connectionId,
      x: o.presence.cursor!.x,
      y: o.presence.cursor!.y,
    }));
  
  // 내 커서 업데이트
  const handlePointerMove = (e: PointerEvent) => {
    updateMyPresence({ cursor: { x: e.clientX, y: e.clientY } });
  };
}
```

### ❌ 피해야 할 패턴

```tsx
// 저수준 API - sync-complete 의존성 문제
useEffect(() => {
  const handleSync = () => {
    if (!liveblocksService.isConnected()) return; // ⚠️ Race condition
    
    liveblocksService.onOthersPresence((others) => {
      // ...
    });
  };
  
  liveblocksService.on('sync-complete', handleSync); // ⚠️ 이미 synced면 발생 안 함
}, []);
```

## 아키텍처 결정

### 하이브리드 접근법 (권장)

기존 `liveblocksService`와 React 훅을 **병행** 사용:

```
┌────────────────────────────────────────────────────────────┐
│ App.tsx                                                    │
│ └── LiveblocksRoomProvider (React 훅용)                   │
│     └── CultureMapFlow                                     │
│         ├── useOthers() ← 커서 presence (안정적)          │
│         └── liveblocksService ← Yjs, Storage (기존 유지)  │
└────────────────────────────────────────────────────────────┘
```

### LiveblocksRoomProvider 구현

```tsx
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react/suspense';

export function LiveblocksRoomProvider({ sessionCode, children }) {
  const publicKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;
  const roomId = sessionCode ? `culturemap-v2-${sessionCode}` : null;
  
  if (!publicKey || !roomId) return <>{children}</>;
  
  return (
    <LiveblocksProvider publicApiKey={publicKey}>
      <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
        <ClientSideSuspense fallback={null}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
```

## 체크리스트

### 커서 presence 구현 시

- [ ] `RoomProvider`가 컴포넌트 트리 상위에 있는가?
- [ ] `initialPresence`에 `cursor: null` 포함되어 있는가?
- [ ] `useOthers` 훅을 `RoomProvider` 내부에서 호출하는가?
- [ ] 마우스 떠날 때 `cursor: null`로 업데이트하는가?

### 저수준 API 사용 시 (비권장)

- [ ] `sync-complete` 외에도 초기 `handleSync()` 호출하는가?
- [ ] `isConnected()` 체크 없이 구독 시도하는가?
- [ ] 언마운트 시 구독 해제하는가?

## 관련 파일

- [src/liveblocks.config.ts](src/liveblocks.config.ts) - Presence 타입 정의
- [src/components/LiveblocksRoomProvider.tsx](src/components/LiveblocksRoomProvider.tsx) - Provider 래퍼
- [src/components/LiveCursors.tsx](src/components/LiveCursors.tsx) - 커서 렌더링 컴포넌트
- [src/components/CultureMapFlow.tsx](src/components/CultureMapFlow.tsx) - useOthers 훅 사용

## 참조

- [Liveblocks Presence Guide](https://liveblocks.io/docs/guides/how-to-use-liveblocks-presence-with-react)
- [useOthers API Reference](https://liveblocks.io/docs/api-reference/liveblocks-react#useOthers)
