/**
 * Liveblocks 협업 서비스
 * 
 * Firebase MultiUserService를 대체하는 실시간 협업 서비스
 * - Yjs CRDT 기반 데이터 동기화
 * - IndexedDB 오프라인 지원
 * - 프레즌스(커서, 선택) 동기화
 */

import { createClient } from '@liveblocks/client';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type {
    StickyNoteData,
    ConnectionData,
    MultiUserSession,
    EditingInfo,
    SessionType,
} from '../types/liveblocks';

// ============================================
// 이벤트 타입
// ============================================

type EventCallback = (...args: unknown[]) => void;

interface EventListeners {
    [key: string]: EventCallback[];
}

// ============================================
// 서비스 클래스
// ============================================

class LiveblocksService {
    private client: ReturnType<typeof createClient> | null = null;
    private provider: LiveblocksYjsProvider | null = null;
    private yDoc: Y.Doc | null = null;
    private indexeddbProvider: IndexeddbPersistence | null = null;
    private currentSession: MultiUserSession | null = null;
    private leaveRoom: (() => void) | null = null;
    private userId: string;
    private displayName: string;
    private userColor: string;
    private listeners: EventListeners = {};

    constructor() {
        this.userId = this.generateUserId();
        this.displayName = this.generateDisplayName();
        this.userColor = this.generateUserColor();
    }

    // ============================================
    // 초기화
    // ============================================

    /**
     * Liveblocks 클라이언트 초기화
     */
    public initialize(publicKey: string): void {
        if (this.client) return;

        this.client = createClient({
            publicApiKey: publicKey,
        });

        console.log('🔗 Liveblocks 클라이언트 초기화 완료');
    }

    // ============================================
    // 세션 관리
    // ============================================

    /**
     * 세션 생성
     */
    public async createSession(
        sessionName?: string,
        sessionType: SessionType = 'workshop'
    ): Promise<string> {
        const code = this.generateSessionCode();
        await this.joinSession(code, true, sessionName, sessionType);
        return code;
    }

    /**
     * 세션 참가
     */
    public async joinSession(
        code: string,
        isHost: boolean = false,
        sessionName?: string,
        sessionType: SessionType = 'workshop'
    ): Promise<void> {
        if (!this.client) {
            throw new Error('Liveblocks 클라이언트가 초기화되지 않았습니다.');
        }

        // 기존 연결 정리
        await this.leaveSession();

        // Yjs 문서 생성
        this.yDoc = new Y.Doc();

        // Room 진입
        const roomId = `culturemap-${code}`;
        const { room, leave } = this.client.enterRoom(roomId, {
            initialPresence: {
                cursor: null,
                selection: [],
                userName: this.displayName,
                userColor: this.userColor,
                editingNodeId: null,
            },
        });

        this.leaveRoom = leave;

        // Liveblocks Provider 연결
        this.provider = new LiveblocksYjsProvider(room as any, this.yDoc);

        // IndexedDB로 로컬 저장
        this.indexeddbProvider = new IndexeddbPersistence(roomId, this.yDoc);

        // 세션 정보 저장
        this.currentSession = {
            code,
            isHost,
            connectedUsers: 1,
            name: sessionName,
            type: sessionType,
        };

        // 메타데이터 초기화 (호스트만)
        if (isHost) {
            const metadata = this.yDoc.getMap<unknown>('metadata');
            if (!metadata.get('code')) {
                metadata.set('code', code);
                metadata.set('name', sessionName || `세션 ${code}`);
                metadata.set('type', sessionType);
                metadata.set('createdAt', Date.now());
                metadata.set('hostUserId', this.userId);
            }
        }

        // 데이터 변경 리스너 설정
        this.setupDataListeners();

        // IndexedDB 동기화 완료 이벤트
        this.indexeddbProvider.on('synced', () => {
            console.log('💾 로컬 저장소 동기화 완료');
            this.emit('sync-complete', { code });
        });

        console.log(`✅ 세션 참가 완료: ${code}`);
    }

    /**
     * 세션 떠나기
     */
    public async leaveSession(): Promise<void> {
        if (this.provider) {
            this.provider.destroy();
            this.provider = null;
        }

        if (this.leaveRoom) {
            this.leaveRoom();
            this.leaveRoom = null;
        }

        if (this.indexeddbProvider) {
            await this.indexeddbProvider.destroy();
            this.indexeddbProvider = null;
        }

        if (this.yDoc) {
            this.yDoc.destroy();
            this.yDoc = null;
        }

        this.currentSession = null;
        console.log('👋 세션 퇴장');
    }

    /**
     * 세션 유효성 검사
     */
    public async validateSession(code: string): Promise<boolean> {
        // Liveblocks는 별도의 세션 유효성 검사 없이 룸에 참가 시도
        return code.length === 6;
    }

    // ============================================
    // 스티키 노트 관리
    // ============================================

    /**
     * 스티키 노트 추가/업데이트
     */
    public updateStickyNote(note: Partial<StickyNoteData> & { id: string }): void {
        if (!this.yDoc) return;

        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const existingIndex = this.findNodeIndex(note.id);

        this.yDoc.transact(() => {
            const fullNote: StickyNoteData = {
                id: note.id,
                content: note.content || '',
                x: note.x || 0,
                y: note.y || 0,
                layer: note.layer || 1,
                color: note.color,
                type: note.type,
                width: note.width,
                height: note.height,
                timestamp: Date.now(),
                author: this.displayName,
            };

            if (existingIndex >= 0) {
                nodes.delete(existingIndex, 1);
                nodes.insert(existingIndex, [fullNote]);
            } else {
                nodes.push([fullNote]);
            }
        });
    }

    /**
     * 스티키 노트 삭제
     */
    public deleteStickyNote(noteId: string): void {
        if (!this.yDoc) return;

        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const index = this.findNodeIndex(noteId);

        if (index >= 0) {
            nodes.delete(index, 1);
        }
    }

    /**
     * 모든 스티키 노트 가져오기
     */
    public getStickyNotes(): StickyNoteData[] {
        if (!this.yDoc) return [];
        return this.yDoc.getArray<StickyNoteData>('nodes').toArray();
    }

    // ============================================
    // 연결선 관리
    // ============================================

    /**
     * 연결선 추가/업데이트
     */
    public updateConnection(connection: ConnectionData): void {
        if (!this.yDoc) return;

        const connections = this.yDoc.getArray<ConnectionData>('connections');
        const existingIndex = this.findConnectionIndex(connection.id);

        this.yDoc.transact(() => {
            if (existingIndex >= 0) {
                connections.delete(existingIndex, 1);
                connections.insert(existingIndex, [connection]);
            } else {
                connections.push([connection]);
            }
        });
    }

    /**
     * 연결선 삭제
     */
    public deleteConnection(connectionId: string): void {
        if (!this.yDoc) return;

        const connections = this.yDoc.getArray<ConnectionData>('connections');
        const index = this.findConnectionIndex(connectionId);

        if (index >= 0) {
            connections.delete(index, 1);
        }
    }

    /**
     * 모든 연결선 가져오기
     */
    public getConnections(): ConnectionData[] {
        if (!this.yDoc) return [];
        return this.yDoc.getArray<ConnectionData>('connections').toArray();
    }

    // ============================================
    // 편집 상태 관리
    // ============================================

    /**
     * 편집 시작
     */
    public startEditing(noteId: string, _itemType: string = 'note'): void {
        // Provider awareness 사용 (타입 단순화)
        this.emit('editing-started', {
            noteId,
            userId: this.userId,
            userName: this.displayName,
        });
    }

    /**
     * 편집 종료
     */
    public stopEditing(noteId: string, _itemType: string = 'note'): void {
        this.emit('editing-stopped', {
            noteId,
            userId: this.userId,
        });
    }

    /**
     * 편집 중인 항목 가져오기
     */
    public getEditingItems(): Map<string, EditingInfo> {
        const editingMap = new Map<string, EditingInfo>();
        // 현재는 빈 맵 반환 (추후 awareness 연동)
        return editingMap;
    }

    // ============================================
    // 보고서 관리 (컨설팅 모드)
    // ============================================

    /**
     * 보고서 내용 업데이트
     */
    public updateReportContent(content: string): void {
        if (!this.yDoc) return;

        const report = this.yDoc.getText('report');
        report.delete(0, report.length);
        report.insert(0, content);
    }

    /**
     * 보고서 내용 가져오기
     */
    public getReportContent(): string {
        if (!this.yDoc) return '';
        return this.yDoc.getText('report').toString();
    }

    /**
     * 보고서 변경 구독
     */
    public onReportContent(callback: (content: string) => void): () => void {
        if (!this.yDoc) return () => { };

        const report = this.yDoc.getText('report');
        const observer = () => callback(report.toString());
        report.observe(observer);

        return () => report.unobserve(observer);
    }

    // ============================================
    // 유틸리티 메서드
    // ============================================

    public getCurrentSession(): MultiUserSession | null {
        return this.currentSession;
    }

    public getCurrentUserId(): string {
        return this.userId;
    }

    public getCurrentUserDisplayName(): string {
        return this.displayName;
    }

    public isConnected(): boolean {
        return this.provider !== null && this.currentSession !== null;
    }

    // ============================================
    // 이벤트 시스템
    // ============================================

    public on(event: string, callback: EventCallback): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    public off(event: string, callback: EventCallback): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }

    private emit(event: string, data?: unknown): void {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach((callback) => callback(data));
    }

    // ============================================
    // Private 유틸리티
    // ============================================

    private generateSessionCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    private generateUserId(): string {
        const stored = localStorage.getItem('liveblocks-user-id');
        if (stored) return stored;

        const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('liveblocks-user-id', id);
        return id;
    }

    private generateDisplayName(): string {
        const stored = localStorage.getItem('liveblocks-display-name');
        if (stored) return stored;

        const adjectives = ['용감한', '지혜로운', '창의적인', '열정적인', '신중한', '활발한', '차분한', '유쾌한'];
        const animals = ['사자', '독수리', '돌고래', '펭귄', '판다', '여우', '올빼미', '호랑이'];

        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const animal = animals[Math.floor(Math.random() * animals.length)];
        const name = `${adj} ${animal}`;

        localStorage.setItem('liveblocks-display-name', name);
        return name;
    }

    private generateUserColor(): string {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private findNodeIndex(noteId: string): number {
        if (!this.yDoc) return -1;
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes').toArray();
        return nodes.findIndex((n) => n.id === noteId);
    }

    private findConnectionIndex(connectionId: string): number {
        if (!this.yDoc) return -1;
        const connections = this.yDoc.getArray<ConnectionData>('connections').toArray();
        return connections.findIndex((c) => c.id === connectionId);
    }

    private setupDataListeners(): void {
        if (!this.yDoc) return;

        // 노드 변경 감지
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        nodes.observe((event) => {
            event.changes.added.forEach((item) => {
                item.content.getContent().forEach((content) => {
                    this.emit('note-updated', content);
                });
            });
            event.changes.deleted.forEach(() => {
                this.emit('note-deleted', {});
            });
        });

        // 연결선 변경 감지
        const connections = this.yDoc.getArray<ConnectionData>('connections');
        connections.observe((event) => {
            event.changes.added.forEach((item) => {
                item.content.getContent().forEach((content) => {
                    this.emit('connection-updated', content);
                });
            });
            event.changes.deleted.forEach(() => {
                this.emit('connection-deleted', {});
            });
        });
    }
}

// 싱글톤 인스턴스
export const liveblocksService = new LiveblocksService();
export default liveblocksService;
