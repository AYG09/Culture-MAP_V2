/**
 * LiveCursors 컴포넌트
 * Liveblocks useOthers 훅을 사용한 실시간 커서 렌더링
 */

import { useOthers, useUpdateMyPresence } from '@liveblocks/react/suspense';
import { useCallback, useEffect } from 'react';

interface LiveCursorsProps {
  /** 현재 사용자 이름 */
  userName?: string;
  /** 현재 사용자 색상 */
  userColor?: string;
  /** 뷰포트 오프셋 보정용 */
  viewportOffset?: { x: number; y: number };
}

interface CursorProps {
  x: number;
  y: number;
  color: string;
  name?: string;
}

function Cursor({ x, y, color, name }: CursorProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {/* 커서 아이콘 */}
      <svg
        width="24"
        height="36"
        viewBox="0 0 24 36"
        fill="none"
        style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M5.65376 12.4563L0.161938 0.839607C0.0417389 0.583169 0.312274 0.327419 0.559848 0.462946L11.7667 6.72906C12.0215 6.8685 12.0317 7.21987 11.7872 7.37393L5.65376 12.4563Z"
          fill={color}
        />
      </svg>
      
      {/* 사용자 이름 라벨 */}
      {name && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 10,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: color,
            color: 'white',
            fontSize: '11px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

/**
 * 다른 사용자들의 커서를 렌더링하는 컴포넌트
 * RoomProvider 내부에서 사용해야 함
 */
export function LiveCursors({ userName, userColor }: LiveCursorsProps) {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();

  // 초기 presence 설정
  useEffect(() => {
    if (userName || userColor) {
      updateMyPresence({
        userName,
        userColor,
      });
    }
  }, [userName, userColor, updateMyPresence]);

  return (
    <>
      {others.map(({ connectionId, presence }) => {
        if (!presence.cursor) return null;

        return (
          <Cursor
            key={connectionId}
            x={presence.cursor.x}
            y={presence.cursor.y}
            color={presence.userColor || '#888'}
            name={presence.userName}
          />
        );
      })}
    </>
  );
}

/**
 * 마우스 이동 이벤트를 Liveblocks presence로 전송하는 훅
 */
export function useCursorTracking() {
  const updateMyPresence = useUpdateMyPresence();

  const handlePointerMove = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      updateMyPresence({
        cursor: { x: e.clientX, y: e.clientY },
      });
    },
    [updateMyPresence]
  );

  const handlePointerLeave = useCallback(() => {
    updateMyPresence({
      cursor: null,
    });
  }, [updateMyPresence]);

  return { handlePointerMove, handlePointerLeave };
}

export default LiveCursors;
