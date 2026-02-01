/**
 * Liveblocks 타입 정의
 * 실시간 협업을 위한 프레즌스, 스토리지, 이벤트 타입
 */

import type { Json } from '@liveblocks/client';
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
// 공유 RAG 청크 (벡터 임베딩 포함)
// ============================================

export interface SharedRagChunk {
    id: string;           // docId:chunkIndex 형식
    docId: string;        // 문서 고유 ID
    docName: string;      // 문서 표시 이름
    content: string;      // 청크 텍스트 내용
    embedding: number[];  // 768차원 벡터 (Gemini text-embedding-004)
    pageNumber?: number;  // 페이지 번호 (선택)
    uploaderId: string;   // 업로더 사용자 ID
    uploaderName: string; // 업로더 표시 이름
    uploadedAt: number;   // 업로드 시간
}

// ============================================
// 프레즌스 (Presence) - 사용자 상태
// ============================================

export interface SessionPresence {
    userId: string;
    cursor: { x: number; y: number } | null;
    cursorClient?: { x: number; y: number } | null;
    selection: string[];
    userName: string;
    userColor: string;
    editingNodeId: string | null;
    lastActivity: number;
    [key: string]: Json | undefined; // JsonObject 호환을 위한 인덱스 시그니처
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
    /** 생성자 구분: 'user' (사용자) | 'ai' (AI) - AI는 사용자 생성 항목을 임의로 수정 불가 */
    createdBy?: 'user' | 'ai';
    /** 자동 정렬에서 위치 유지 여부 */
    pinned?: boolean;
    /** 자동 정렬에서 연결 핸들 유지 여부 */
    pinnedHandles?: boolean;
}

export interface ConnectionData {
    id: string;
    sourceId: string;
    targetId: string;
    relationType?: string;
    isPositive?: boolean;
    type?: string;
    /** 생성자 구분: 'user' (사용자) | 'ai' (AI) - AI는 사용자 생성 항목을 임의로 수정 불가 */
    createdBy?: 'user' | 'ai';
    /** 연결선 소스 핸들 위치 (top/bottom/left/right) */
    sourceHandle?: string;
    /** 연결선 타겟 핸들 위치 (top/bottom/left/right) */
    targetHandle?: string;
}

export interface SessionMetadata {
    code: string;
    name: string;
    type: SessionType;
    createdAt: number;
    lastActivity: number;
    hostUserId: string;
}

export interface LayerSettings {
    layerHeights: number[];
    layerOpacities: number[];
    showLayerBackground?: boolean;
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
