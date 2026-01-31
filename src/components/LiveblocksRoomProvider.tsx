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
  const publicKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;

  // roomId 생성 (liveblocksService와 동일한 형식)
  const roomId = useMemo(() => {
    if (!sessionCode) return null;
    return `culturemap-v2-${sessionCode}`;
  }, [sessionCode]);

  // 초기 presence 설정
  const initialPresence = useMemo(
    () => ({
      cursor: null,
      userName: userName || '익명',
      userColor: userColor || '#888888',
      userId: userId || '',
      selection: [],
      editingNodeId: null,
      lastActivity: Date.now(),
    }),
    [userName, userColor, userId]
  );

  // publicKey나 roomId가 없으면 children만 렌더링
  if (!publicKey || !roomId) {
    return <>{children}</>;
  }

  return (
    <LiveblocksProvider publicApiKey={publicKey}>
      <RoomProvider id={roomId} initialPresence={initialPresence}>
        <ClientSideSuspense fallback={fallback}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

export default LiveblocksRoomProvider;
