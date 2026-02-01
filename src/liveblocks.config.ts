/**
 * Liveblocks React 설정
 * useOthers 훅을 사용한 실시간 커서 presence를 위한 설정
 */

declare global {
  interface Liveblocks {
    // 각 사용자의 Presence (커서, 선택 등)
    Presence: {
      cursor: { x: number; y: number } | null;
      cursorClient?: { x: number; y: number } | null;
      userName?: string;
      userColor?: string;
      userId?: string;
      selection?: string[];
      editingNodeId?: string | null;
      lastActivity?: number;
    };

    // UserMeta - 인증 시 설정되는 사용자 정보
    UserMeta: {
      id: string;
      info: {
        name?: string;
        color?: string;
        avatar?: string;
      };
    };
  }
}

export {};
