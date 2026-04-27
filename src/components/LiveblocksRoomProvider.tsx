/**
 * LiveblocksRoomProvider
 * 동적 roomId를 지원하는 Liveblocks RoomProvider 래퍼
 * 기존 liveblocksService와 병행하여 useOthers 훅 지원
 */

import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react/suspense';
import { type ReactNode, useMemo } from 'react';
import '../liveblocks.config'; // Liveblocks 타입 설정 로드

interface LiveblocksRoomProviderProps {
  /** 세션 코드 (roomId 생성에 사용) */
  sessionCode: string | null;
  /** 현재 사용자 이름 */
  userName?: string;
  /** 현재 사용자 색상 */
  userColor?: string;
  /** 현재 사용자 ID */
  userId?: string;
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 로딩 중 표시할 fallback */
  fallback?: ReactNode;
}

/**
 * Liveblocks React 훅(useOthers 등)을 사용하기 위한 Provider
 * 기존 liveblocksService의 저수준 API와 병행하여 사용
 */
export function LiveblocksRoomProvider({
  sessionCode,
  userName,
  userColor,
  userId,
  children,
  fallback = null,
}: LiveblocksRoomProviderProps) {
  // roomId 생성 (liveblocksService와 동일한 형식)
  const roomId = useMemo(() => {
    if (!sessionCode) return null;
    return `culturemap-v2-${sessionCode}`;
  }, [sessionCode]);

  const authEndpoint = useMemo(
    () => async (room?: string) => {
      const response = await fetch('/api/liveblocks-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-culturemap-user-id': userId || '',
          'x-culturemap-user-name': userName || '익명',
          'x-culturemap-user-color': userColor || '#888888',
        },
        body: JSON.stringify({ room }),
      });

      if (!response.ok) {
        throw new Error(`Liveblocks authorization failed: ${response.status}`);
      }

      return await response.json();
    },
    [userColor, userId, userName]
  );

  // 초기 presence 설정
  const initialPresence = useMemo(
    () => ({
      cursor: null,
      cursorClient: null,
      userName: userName || '익명',
      userColor: userColor || '#888888',
      userId: userId || '',
      selection: [],
      editingNodeId: null,
      lastActivity: Date.now(),
    }),
    [userName, userColor, userId]
  );

  // roomId가 없으면 children만 렌더링
  if (!roomId) {
    return <>{children}</>;
  }

  return (
    <LiveblocksProvider authEndpoint={authEndpoint}>
      <RoomProvider id={roomId} initialPresence={initialPresence}>
        <ClientSideSuspense fallback={fallback}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

export default LiveblocksRoomProvider;
