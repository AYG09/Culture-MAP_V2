/**
 * Liveblocks 협업 서비스 (v2 확장 및 인터페이스 호환성 보완)
 */

import { createClient } from '@liveblocks/client';
import type { Client } from '@liveblocks/client';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type {
    StickyNoteData,
    ConnectionData as LBConnectionData,
    MultiUserSession,
    SessionType,
    ChatMessage,
    AcademicFileMeta,
} from '../types/liveblocks';

type EventCallback = (...args: unknown[]) => void;

interface EventListeners {
    [key: string]: EventCallback[];
}

class LiveblocksService {
    private client: Client | null = null;
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

    public initialize(publicKey: string): void {
        if (this.client) return;
        this.client = createClient({ publicApiKey: publicKey });
        console.log('🔗 Liveblocks 클라이언트 초기화 완료');
    }

    public isConnected(): boolean {
        return !!this.provider && !!this.yDoc;
    }

    public getCurrentUserId(): string {
        return this.userId;
    }

    public getCurrentUserDisplayName(): string {
        return this.displayName;
    }

    public getCurrentUserColor(): string {
        return this.userColor;
    }

    public getCurrentSession(): MultiUserSession | null {
        return this.currentSession;
    }

    public async createSession(sessionName?: string, sessionType: SessionType = 'workshop'): Promise<string> {
        const code = this.generateSessionCode();
        await this.joinSession(code, true, sessionName, sessionType);
        // 세션 레지스트리에 등록
        await this.registerSession(code, sessionName || `세션 ${code}`, sessionType);
        return code;
    }

    public async joinSession(code: string, isHost: boolean = false, sessionName?: string, sessionType: SessionType = 'workshop'): Promise<void> {
        if (!this.client) throw new Error('Liveblocks 클라이언트가 초기화되지 않았습니다.');

        await this.leaveSession();
        this.yDoc = new Y.Doc();
        const roomId = `culturemap-v2-${code}`;
        const { room, leave } = this.client.enterRoom(roomId, {
            initialPresence: {
                cursor: null,
                selection: [],
                userName: this.displayName,
                userColor: this.userColor,
                editingNodeId: null,
                lastActivity: Date.now(),
            },
        });

        this.leaveRoom = leave;
        this.provider = new LiveblocksYjsProvider(room as any, this.yDoc);
        this.indexeddbProvider = new IndexeddbPersistence(roomId, this.yDoc);

        this.currentSession = { code, isHost, connectedUsers: 1, name: sessionName, type: sessionType };

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

        this.setupDataListeners();
        this.indexeddbProvider.on('synced', () => this.emit('sync-complete', { code }));
    }

    /**
     * 세션 타입 업데이트 (워크샵/컨설팅)
     */
    public async updateSessionType(sessionType: SessionType): Promise<void> {
        if (!this.yDoc || !this.currentSession) {
            throw new Error('세션이 연결되어 있지 않습니다.');
        }

        const metadata = this.yDoc.getMap<unknown>('metadata');
        metadata.set('type', sessionType);

        this.currentSession = { ...this.currentSession, type: sessionType };

        try {
            await this.connectToConfigRoom();
            const sessionsMap = this.configDoc?.getMap<unknown>('sessions');
            if (sessionsMap) {
                const existing = sessionsMap.get(this.currentSession.code) as { code: string; name: string; type: string; createdAt: number; createdBy: string } | undefined;
                sessionsMap.set(this.currentSession.code, {
                    ...(existing || { code: this.currentSession.code, name: this.currentSession.name || `세션 ${this.currentSession.code}`, createdAt: Date.now(), createdBy: this.displayName }),
                    type: sessionType,
                });
            }
        } catch (error) {
            console.warn('⚠️ 세션 레지스트리 타입 업데이트 실패:', error);
        }
    }

    public async leaveSession(): Promise<void> {
        try {
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
        } catch (error) {
            console.error('❌ 세션 종료 중 오류 발생:', error);
        } finally {
            this.currentSession = null;
        }
    }

    // ============================================
    // 편집 상태 공유 (Locks)
    // ============================================

    public startEditing(_itemId: string, _itemType: 'note' | 'connection'): void {
        if (!this.client) return;
    }

    public stopEditing(_itemId: string, _itemType: 'note' | 'connection'): void {
        if (!this.client) return;
    }

    // ============================================
    // 채팅 동기화 기능
    // ============================================

    public sendChatMessage(content: string, suggestedActions?: any[]): void {
        if (!this.yDoc) return;
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const newMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            role: 'user',
            content,
            userId: this.userId,        // 발신자 식별용
            userName: this.displayName,
            userColor: this.userColor,
            timestamp: Date.now(),
            suggestedActions
        };
        messages.push([newMessage]);
    }

    public sendAiResponse(content: string, functionCalls?: any[]): void {
        if (!this.yDoc) return;
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const newMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content,
            userName: 'AI Assistant',
            userColor: '#8b5cf6',
            timestamp: Date.now(),
            suggestedActions: functionCalls
        };
        messages.push([newMessage]);
    }

    /**
     * AI의 초기 빈 메시지를 생성하고 ID를 반환합니다 (스트리밍 용)
     */
    public startAiResponse(): string {
        if (!this.yDoc) return '';
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const id = `ai-stream-${Date.now()}`;
        const newMessage: ChatMessage = {
            id,
            role: 'assistant',
            content: '',
            userName: 'AI Assistant',
            userColor: '#8b5cf6',
            timestamp: Date.now()
        };
        messages.push([newMessage]);
        return id;
    }

    /**
     * 특정 ID의 AI 메시지 내용을 업데이트합니다
     */
    public updateAiResponse(id: string, content?: string, functionCalls?: any[]): void {
        if (!this.yDoc) return;
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const index = messages.toArray().findIndex(m => m.id === id);
        if (index !== -1) {
            const current = messages.get(index);
            const updated: ChatMessage = {
                ...current,
                content: content ?? current.content, // undefined면 기존 값 유지
                suggestedActions: functionCalls ?? current.suggestedActions // undefined면 기존 값 유지
            };
            messages.delete(index);
            messages.insert(index, [updated]);
        }
    }

    public getChatMessages(): ChatMessage[] {
        if (!this.yDoc) return [];
        return this.yDoc.getArray<ChatMessage>('chatMessages').toArray();
    }

    public getStickyNotes(): StickyNoteData[] {
        if (!this.yDoc) return [];
        return this.yDoc.getArray<StickyNoteData>('nodes').toArray();
    }

    public getConnections(): LBConnectionData[] {
        if (!this.yDoc) return [];
        return this.yDoc.getArray<LBConnectionData>('connections').toArray();
    }

    public onChatMessages(callback: (messages: ChatMessage[]) => void): () => void {
        if (!this.yDoc) return () => { };
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const observer = () => callback(messages.toArray());
        messages.observe(observer);
        return () => messages.unobserve(observer);
    }

    // ============================================
    // 맵 데이터 관리
    // ============================================

    public updateStickyNote(note: Partial<StickyNoteData> & { id: string }): void {
        if (!this.yDoc) {
            console.warn('⚠️ [Liveblocks] updateStickyNote: yDoc이 없음');
            return;
        }
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const index = this.findNodeIndex(note.id);
        console.log('📝 [Liveblocks] updateStickyNote:', { id: note.id, index, nodesLength: nodes.length });
        this.yDoc.transact(() => {
            const existing = index >= 0 ? nodes.get(index) : {};
            const fullNote: StickyNoteData = {
                ...existing,
                ...note,
                timestamp: Date.now(),
                author: this.displayName,
            } as StickyNoteData;
            if (index >= 0) { nodes.delete(index, 1); nodes.insert(index, [fullNote]); }
            else { nodes.push([fullNote]); }
        });
        console.log('✅ [Liveblocks] updateStickyNote 완료:', note.id);
    }

    public deleteStickyNote(noteId: string): void {
        if (!this.yDoc) return;
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const index = this.findNodeIndex(noteId);
        if (index >= 0) nodes.delete(index, 1);
    }

    public updateConnection(connection: LBConnectionData): void {
        if (!this.yDoc) return;
        const connections = this.yDoc.getArray<LBConnectionData>('connections');
        const index = this.findConnectionIndex(connection.id);
        if (index >= 0) { connections.delete(index, 1); connections.insert(index, [connection]); }
        else { connections.push([connection]); }
    }

    /**
     * 노드/연결선 전체 초기화 (AI 일괄 생성 등 replace 시나리오용)
     */
    public clearMapData(): void {
        if (!this.yDoc) return;
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const connections = this.yDoc.getArray<LBConnectionData>('connections');
        this.yDoc.transact(() => {
            if (nodes.length > 0) {
                nodes.delete(0, nodes.length);
            }
            if (connections.length > 0) {
                connections.delete(0, connections.length);
            }
        });
    }

    public deleteConnection(connectionId: string): void {
        if (!this.yDoc) return;
        const connections = this.yDoc.getArray<LBConnectionData>('connections');
        const index = this.findConnectionIndex(connectionId);
        if (index >= 0) connections.delete(index, 1);
    }

    public updateReportContent(content: string): void {
        if (!this.yDoc) return;
        const report = this.yDoc.getText('report');
        this.yDoc.transact(() => { report.delete(0, report.length); report.insert(0, content); });
    }

    public onReportContent(callback: (content: string) => void): () => void {
        if (!this.yDoc) return () => { };
        const report = this.yDoc.getText('report');
        const observer = () => callback(report.toString());
        report.observe(observer);
        return () => report.unobserve(observer);
    }

    // ============================================
    // 학술 파일 메타데이터 공유 (읽기 전용)
    // ============================================

    public publishAcademicFiles(files: AcademicFileMeta[]): void {
        if (!this.yDoc) return;
        const academicFiles = this.yDoc.getMap<AcademicFileMeta[]>('academicFiles');
        academicFiles.set(this.userId, files);
    }

    public getAcademicFilesByUser(): Record<string, AcademicFileMeta[]> {
        if (!this.yDoc) return {};
        const academicFiles = this.yDoc.getMap<AcademicFileMeta[]>('academicFiles');
        return academicFiles.toJSON() as Record<string, AcademicFileMeta[]>;
    }

    public onAcademicFiles(callback: (data: Record<string, AcademicFileMeta[]>) => void): () => void {
        if (!this.yDoc) return () => { };
        const academicFiles = this.yDoc.getMap<AcademicFileMeta[]>('academicFiles');
        const observer = () => callback(academicFiles.toJSON() as Record<string, AcademicFileMeta[]>);
        academicFiles.observe(observer);
        return () => academicFiles.unobserve(observer);
    }

    // ============================================
    // 유틸리티
    // ============================================

    public on(event: string, callback: EventCallback): void {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    public off(event: string, callback: EventCallback): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }

    private emit(event: string, data?: unknown): void {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach((cb) => cb(data));
    }

    private findNodeIndex(id: string): number {
        if (!this.yDoc) return -1;
        return this.yDoc.getArray<StickyNoteData>('nodes').toArray().findIndex(n => n.id === id);
    }

    private findConnectionIndex(id: string): number {
        if (!this.yDoc) return -1;
        return this.yDoc.getArray<LBConnectionData>('connections').toArray().findIndex(c => c.id === id);
    }

    private generateSessionCode(): string {
        // 개발 환경에서는 고정 코드 사용하여 불필요한 룸 생성 방지
        const isDev = import.meta.env.VITE_APP_ENV === 'development';
        if (isDev) {
            console.log('🔧 [DEV] 고정 세션 코드 사용: DEV-LOCAL');
            return 'DEV-LOCAL';
        }
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    private generateUserId(): string {
        const id = localStorage.getItem('v2-user-id') || `u-${Date.now()}`;
        localStorage.setItem('v2-user-id', id);
        return id;
    }

    private generateDisplayName(): string {
        const adjectives = ['용감한', '지혜로운', '창의적인', '열정적인', '신중한', '활발한', '차분한', '유쾌한'];
        const animals = ['사자', '독수리', '돌고래', '펭귄', '판다', '여우', '올빼미', '호랑이'];
        return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
    }

    private generateUserColor(): string {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private setupDataListeners(): void {
        if (!this.yDoc) return;

        // 노드 변경 감지 - 개별 노드마다 이벤트 발생
        this.yDoc.getArray<StickyNoteData>('nodes').observe((event) => {
            // 전체 목록 변경 이벤트
            this.emit('notes-changed', this.yDoc!.getArray('nodes').toArray());

            // 개별 노드 변경 이벤트 (추가/수정)
            event.changes.added.forEach((item) => {
                const content = item.content as unknown;
                if (content && typeof (content as { toArray?: () => StickyNoteData[] }).toArray === 'function') {
                    const notes = (content as { toArray: () => StickyNoteData[] }).toArray();
                    notes.forEach((note) => {
                        this.emit('sticky-note-updated', note);
                    });
                }
            });

            // 삭제 이벤트
            event.changes.deleted.forEach((item) => {
                const content = item.content as unknown;
                if (content && typeof (content as { toArray?: () => StickyNoteData[] }).toArray === 'function') {
                    const notes = (content as { toArray: () => StickyNoteData[] }).toArray();
                    notes.forEach((note) => {
                        this.emit('sticky-note-deleted', { noteId: note.id });
                    });
                }
            });
        });

        // 연결선 변경 감지 - 개별 연결선마다 이벤트 발생
        this.yDoc.getArray<LBConnectionData>('connections').observe((event) => {
            // 전체 목록 변경 이벤트
            this.emit('connections-changed', this.yDoc!.getArray('connections').toArray());

            // 개별 연결선 변경 이벤트 (추가/수정)
            event.changes.added.forEach((item) => {
                const content = item.content as unknown;
                if (content && typeof (content as { toArray?: () => LBConnectionData[] }).toArray === 'function') {
                    const connections = (content as { toArray: () => LBConnectionData[] }).toArray();
                    connections.forEach((conn) => {
                        this.emit('connection-updated', conn);
                    });
                }
            });

            // 삭제 이벤트
            event.changes.deleted.forEach((item) => {
                const content = item.content as unknown;
                if (content && typeof (content as { toArray?: () => LBConnectionData[] }).toArray === 'function') {
                    const connections = (content as { toArray: () => LBConnectionData[] }).toArray();
                    connections.forEach((conn) => {
                        this.emit('connection-deleted', { connectionId: conn.id });
                    });
                }
            });
        });
    }

    // ============================================
    // 호스트 비밀번호 관리 (ADMIN-CONFIG Room 활용)
    // ============================================

    private configDoc: Y.Doc | null = null;
    private configProvider: LiveblocksYjsProvider | null = null;
    private configLeave: (() => void) | null = null;

    /**
     * 관리자 설정 Room에 연결 (호스트 비밀번호 관리용)
     */
    private async connectToConfigRoom(): Promise<Y.Map<unknown>> {
        if (!this.client) throw new Error('Liveblocks 클라이언트가 초기화되지 않았습니다.');

        // 이미 연결되어 있으면 기존 것 사용
        if (this.configDoc) {
            return this.configDoc.getMap<unknown>('adminConfig');
        }

        this.configDoc = new Y.Doc();
        const roomId = 'culturemap-admin-config';

        const { room, leave } = this.client.enterRoom(roomId, {
            initialPresence: { cursor: null },
        });

        this.configLeave = leave;
        this.configProvider = new LiveblocksYjsProvider(room as any, this.configDoc);

        // 동기화 대기
        await new Promise<void>((resolve) => {
            const checkSync = () => {
                if (this.configProvider?.synced) {
                    resolve();
                } else {
                    setTimeout(checkSync, 100);
                }
            };
            checkSync();
        });

        return this.configDoc.getMap<unknown>('adminConfig');
    }

    /**
     * 호스트 비밀번호 저장 (관리자만 사용)
     */
    public async setHostPassword(password: string): Promise<void> {
        const config = await this.connectToConfigRoom();
        config.set('hostPassword', password);
        config.set('updatedAt', Date.now());
        console.log('✅ 호스트 비밀번호 저장 완료');
    }

    /**
     * 호스트 비밀번호 가져오기
     */
    public async getHostPassword(): Promise<string | null> {
        const config = await this.connectToConfigRoom();
        return (config.get('hostPassword') as string) || null;
    }

    /**
     * 호스트 비밀번호 검증
     */
    public async validateHostPassword(inputPassword: string): Promise<boolean> {
        const savedPassword = await this.getHostPassword();
        if (!savedPassword) {
            console.warn('⚠️ 호스트 비밀번호가 설정되지 않았습니다.');
            return false;
        }
        return inputPassword === savedPassword;
    }

    /**
     * 설정 Room 연결 해제
     */
    public disconnectConfigRoom(): void {
        if (this.configProvider) {
            this.configProvider.destroy();
            this.configProvider = null;
        }
        if (this.configLeave) {
            this.configLeave();
            this.configLeave = null;
        }
        if (this.configDoc) {
            this.configDoc.destroy();
            this.configDoc = null;
        }
    }

    // ==================== 세션 레지스트리 ====================
    // 세션 정보: { code, name, type, createdAt, createdBy }


    /**
     * 세션을 레지스트리에 등록
     */
    public async registerSession(code: string, name: string, type: SessionType): Promise<void> {
        const config = await this.connectToConfigRoom();
        let sessions = config.get('sessions') as Map<string, unknown> | undefined;

        if (!sessions) {
            sessions = new Map();
            config.set('sessions', sessions);
        }

        const sessionData = {
            code,
            name,
            type,
            createdAt: Date.now(),
            createdBy: this.displayName
        };

        // Y.Map에 세션 추가
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');
        if (sessionsMap) {
            sessionsMap.set(code, sessionData);
        }

        console.log('✅ 세션 레지스트리에 등록:', code);
    }

    /**
     * 세션 레지스트리 목록 조회
     */
    public async getSessionRegistry(): Promise<Array<{ code: string; name: string; type: string; createdAt: number }>> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (!sessionsMap) {
            return [];
        }

        const sessions: Array<{ code: string; name: string; type: string; createdAt: number }> = [];
        sessionsMap.forEach((value, key) => {
            const session = value as { code: string; name: string; type: string; createdAt: number };
            sessions.push({ ...session, code: key });
        });

        // 최신순 정렬
        return sessions.sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * 세션을 레지스트리에서 제거
     */
    public async unregisterSession(code: string): Promise<void> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (sessionsMap) {
            sessionsMap.delete(code);
            console.log('✅ 세션 레지스트리에서 제거:', code);
        }
    }
}

export const liveblocksService = new LiveblocksService();
export default liveblocksService;
