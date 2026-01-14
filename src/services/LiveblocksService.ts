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
        if (!this.yDoc) return;
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const index = this.findNodeIndex(note.id);
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
        this.yDoc.getArray('nodes').observe(() => this.emit('notes-changed', this.yDoc!.getArray('nodes').toArray()));
        this.yDoc.getArray('connections').observe(() => this.emit('connections-changed', this.yDoc!.getArray('connections').toArray()));
    }
}

export const liveblocksService = new LiveblocksService();
export default liveblocksService;
