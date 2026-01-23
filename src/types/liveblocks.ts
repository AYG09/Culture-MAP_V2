/**
 * Liveblocks 타입 정의
 * 실시간 협업을 위한 프레즌스, 스토리지, 이벤트 타입
 */

import type { PerceptionIntensity } from './culture';
import type { AiAction } from './actions';

export type SessionType = 'workshop' | 'consulting';

// ============================================
// 채팅 메시지 타입
// ============================================

export type ChatScope = 'group' | 'direct';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    userId?: string;       // 발신자 식별용 (실시간 협업에서 사용자 구분)
    userName: string;
    userColor: string;
    timestamp: number;
    scope?: ChatScope;      // 채팅 범위 (group=전체, direct=1:1)
    attachments?: Array<{
        name: string;
        uri: string;
        mimeType: string;
    }>;
    suggestedActions?: AiAction[]; // AI가 제안한 맵 수정 액션
}

// ============================================
// AI 인사이트 타입 (동적 캐싱용)
// ============================================

export type InsightType = 'berkman' | 'raci' | 'org-chart' | 'diagnosis' | 'solution' | 'recommendation' | 'general';

export interface Insight {
    id: string;
    type: InsightType;
    title: string;
    content: string;
    source?: string;       // 원본 파일명 또는 대화 참조
    persons?: string[];    // 관련 인물 (버크만 등)
    timestamp: number;
}

// ============================================
// 학술 파일 메타데이터 (공유용 - URI 제외)
// ============================================

export interface AcademicFileMeta {
    name: string;
    displayName: string;
    mimeType: string;
    keywords?: string[];
    uploadedAt: number;
    ownerId: string;
    ownerName: string;
}

// ============================================
// 프레즌스 (Presence) - 사용자 상태
// ============================================

export interface SessionPresence {
    cursor: { x: number; y: number } | null;
    selection: string[];
    userName: string;
    userColor: string;
    editingNodeId: string | null;
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
    sentiment: string; // color -> sentiment로 통일
    author?: string;
    timestamp?: number;
    type?: string;
    width?: number;
    height?: number;
    concept?: string;
    source?: string;
    category?: string;
    metadata?: string;
    basis?: string; // string으로 통일
    frequency?: PerceptionIntensity;
}

export interface ConnectionData {
    id: string;
    sourceId: string;
    targetId: string;
    relationType?: string;
    isPositive?: boolean;
    type?: string;
}

export interface SessionMetadata {
    code: string;
    name: string;
    type: SessionType;
    createdAt: number;
    lastActivity: number;
    hostUserId: string;
}

// ============================================
// 룸 스토리지 구조
// ============================================

export interface RoomStorage {
    nodes: StickyNoteData[];
    connections: ConnectionData[];
    metadata: SessionMetadata;
    reportContent: string;
    chatMessages: ChatMessage[];
    insights: Insight[]; // AI 동적 인사이트 캐싱
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
    | { type: 'CHAT_MESSAGE_SENT'; message: ChatMessage }
    | { type: 'CURSOR_MOVED'; userId: string; position: { x: number; y: number } };

// ============================================
// 서비스 인터페이스
// ============================================

export interface MultiUserSession {
    code: string;
    isHost: boolean;
    connectedUsers: number;
    name?: string;
    type: SessionType;
}

export interface EditingInfo {
    userId: string;
    userName?: string;
    displayName?: string;
    timestamp: number;
}
