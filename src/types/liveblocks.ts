/**
 * Liveblocks 타입 정의
 * 실시간 협업을 위한 프레즌스, 스토리지, 이벤트 타입
 */

import type { PerceptionIntensity } from './culture';

// ============================================
// 프레즌스 (Presence) - 사용자 상태
// ============================================

export interface SessionPresence {
    /** 커서 위치 */
    cursor: { x: number; y: number } | null;
    /** 선택된 노드 ID 목록 */
    selection: string[];
    /** 사용자 표시 이름 */
    userName: string;
    /** 사용자 색상 (헥스 코드) */
    userColor: string;
    /** 현재 편집 중인 노드 ID */
    editingNodeId: string | null;
    /** 마지막 활동 시간 */
    lastActivity: number;
}

// ============================================
// 스토리지 (Storage) - 공유 데이터
// ============================================

export interface StickyNoteData {
    id: string;
    content: string;
    x: number;
    y: number;
    layer: number;
    color: string;
    author?: string;
    timestamp?: number;
    type?: string;
    width?: number;
    height?: number;
    concept?: string;
    source?: string;
    category?: string;
    metadata?: string;
    basis?: { author: string; year: number; theory: string };
    frequency?: PerceptionIntensity;
}

export interface ConnectionData {
    id: string;
    source: string;
    target: string;
    relationType?: string;
    isPositive?: boolean;
    type?: string;
}

export interface SessionMetadata {
    code: string;
    name: string;
    type: 'workshop' | 'consulting';
    createdAt: number;
    lastActivity: number;
    hostUserId: string;
}

// ============================================
// 룸 스토리지 구조
// ============================================

export interface RoomStorage {
    /** 스티키 노트 목록 */
    nodes: StickyNoteData[];
    /** 연결선 목록 */
    connections: ConnectionData[];
    /** 세션 메타데이터 */
    metadata: SessionMetadata;
    /** 보고서 내용 (컨설팅 모드) */
    reportContent: string;
}

// ============================================
// 이벤트 타입
// ============================================

export type RoomEvent =
    | { type: 'NODE_CREATED'; node: StickyNoteData }
    | { type: 'NODE_UPDATED'; node: StickyNoteData }
    | { type: 'NODE_DELETED'; nodeId: string }
    | { type: 'CONNECTION_CREATED'; connection: ConnectionData }
    | { type: 'CONNECTION_DELETED'; connectionId: string }
    | { type: 'LAYOUT_CHANGED' }
    | { type: 'CURSOR_MOVED'; userId: string; position: { x: number; y: number } };

// ============================================
// 서비스 인터페이스
// ============================================

export interface MultiUserSession {
    code: string;
    isHost: boolean;
    connectedUsers: number;
    name?: string;
    type: 'workshop' | 'consulting';
}

export interface EditingInfo {
    userId: string;
    userName?: string;
    displayName?: string;
    timestamp: number;
}

// ============================================
// Liveblocks 설정
// ============================================

export interface LiveblocksConfig {
    publicKey: string;
    /** 오프라인 지원 활성화 여부 */
    offlineSupport?: boolean;
}

// ============================================
// 사용자 정보
// ============================================

export interface LiveblocksUser {
    id: string;
    name: string;
    color: string;
    isOnline: boolean;
}

// ============================================
// 유틸리티 타입
// ============================================

/** 세션 타입 */
export type SessionType = 'workshop' | 'consulting';

/** 사용자 색상 팔레트 */
export const USER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
] as const;

/** 랜덤 사용자 이름 생성용 */
export const USER_NAME_ADJECTIVES = [
    '용감한', '지혜로운', '창의적인', '열정적인',
    '신중한', '활발한', '차분한', '유쾌한',
];

export const USER_NAME_ANIMALS = [
    '사자', '독수리', '돌고래', '펭귄',
    '판다', '여우', '올빼미', '호랑이',
];
