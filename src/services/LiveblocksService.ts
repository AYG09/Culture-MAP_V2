/**
 * Liveblocks 협업 서비스 (v2 확장 및 인터페이스 호환성 보완)
 */

import { createClient } from '@liveblocks/client';
import type { Client, Room } from '@liveblocks/client';
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
    SharedRagChunk,
    Insight,
    SessionPresence,
    LayerSettings,
} from '../types/liveblocks';
import type { AiAction } from '../types/actions';

type EventCallback = (...args: unknown[]) => void;

interface EventListeners {
    [key: string]: EventCallback[];
}

class LiveblocksService {
    private client: Client | null = null;
    private provider: LiveblocksYjsProvider | null = null;
    private room: Room<SessionPresence> | null = null;
    private yDoc: Y.Doc | null = null;
    private indexeddbProvider: IndexeddbPersistence | null = null;
    private currentSession: MultiUserSession | null = null;
    private leaveRoom: (() => void) | null = null;
    private userId: string;
    private displayName: string;
    private userColor: string;
    private hasClearedIndexeddbCache = false;
    private listeners: EventListeners = {};
    
    // 로컬에서 업데이트 중인 항목 추적 (원격 변경과 구분)
    private pendingLocalUpdates: Set<string> = new Set();

    private readonly defaultLayerHeights: number[] = [220, 220, 220, 220];
    private readonly defaultLayerOpacities: number[] = [1, 1, 1, 1];

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

    public async createSession(sessionName?: string, sessionType: SessionType = 'workshop', customCode?: string, organization?: string): Promise<string> {
        const normalizedCode = customCode ? this.normalizeSessionCode(customCode) : null;
        if (normalizedCode && !this.isValidSessionCode(normalizedCode)) {
            throw new Error('세션 코드가 올바르지 않습니다. 3~12자 영문/숫자/하이픈만 사용할 수 있습니다.');
        }
        const code = normalizedCode ?? this.generateSessionCode();
        await this.joinSession(code, true, sessionName, sessionType, organization);
        return code;
    }

    public async joinSession(code: string, isHost: boolean = false, sessionName?: string, sessionType: SessionType = 'workshop', organization?: string): Promise<void> {
        if (!this.client) throw new Error('Liveblocks 클라이언트가 초기화되지 않았습니다.');

        await this.leaveSession();
        this.yDoc = new Y.Doc();
        const roomId = `culturemap-v2-${code}`;
        const { room, leave } = this.client.enterRoom<SessionPresence>(roomId, {
            initialPresence: {
                userId: this.userId,
                cursor: null,
                selection: [],
                userName: this.displayName,
                userColor: this.userColor,
                editingNodeId: null,
                lastActivity: Date.now(),
            },
        });

        this.leaveRoom = leave;
        this.room = room as Room<SessionPresence>;
        this.provider = new LiveblocksYjsProvider(room, this.yDoc);
        this.indexeddbProvider = new IndexeddbPersistence(roomId, this.yDoc);
        this.hasClearedIndexeddbCache = false;

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

        if (isHost) {
            try {
                await this.registerSession(code, sessionName || `세션 ${code}`, sessionType, organization);
            } catch (error) {
                console.warn('⚠️ 세션 레지스트리 등록 실패:', error);
            }
        }

        this.setupDataListeners();
        this.indexeddbProvider.on('synced', () => this.emit('sync-complete', { code }));

        const handleProviderSync = async (isSynced: boolean) => {
            if (!isSynced || this.hasClearedIndexeddbCache) return;
            this.hasClearedIndexeddbCache = true;
            await this.resetIndexeddbCacheAfterSync(code);
            this.syncSessionMetadata();
            this.provider?.off('sync', handleProviderSync);
        };
        this.provider.on('sync', handleProviderSync);
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
        this.emit('session-type-changed', sessionType);

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
            if (this.yDoc) {
                this.publishAcademicFiles([]);
            }
            
            // Liveblocks 서버에 동기화 완료 대기 (최대 2초)
            if (this.provider) {
                console.log('⏳ [Liveblocks] 서버 동기화 대기 중...');
                await new Promise<void>((resolve) => {
                    // provider가 이미 synced 상태면 바로 진행
                    if (this.provider?.synced) {
                        console.log('✅ [Liveblocks] 이미 동기화됨');
                        resolve();
                        return;
                    }
                    
                    // 동기화 완료 대기 (타임아웃 2초)
                    const timeout = setTimeout(() => {
                        console.warn('⚠️ [Liveblocks] 동기화 타임아웃 - 강제 진행');
                        resolve();
                    }, 2000);
                    
                    const checkSync = () => {
                        if (this.provider?.synced) {
                            clearTimeout(timeout);
                            console.log('✅ [Liveblocks] 동기화 완료');
                            resolve();
                        } else {
                            setTimeout(checkSync, 100);
                        }
                    };
                    checkSync();
                });
            }
            
            if (this.provider) {
                this.provider.destroy();
                this.provider = null;
            }
            if (this.leaveRoom) {
                this.leaveRoom();
                this.leaveRoom = null;
            }
            this.room = null;
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

    public startEditing(itemId: string, itemType: 'note' | 'connection'): void {
        if (!this.client || !this.yDoc) return;
        const editingLocks = this.yDoc.getMap<{
            itemId: string;
            itemType: 'note' | 'connection';
            userId: string;
            displayName?: string;
            timestamp: number;
        }>('editingLocks');
        const existing = editingLocks.get(itemId);
        if (existing && existing.userId !== this.userId) {
            return;
        }
        editingLocks.set(itemId, {
            itemId,
            itemType,
            userId: this.userId,
            displayName: this.displayName,
            timestamp: Date.now(),
        });
    }

    public stopEditing(itemId: string, itemType: 'note' | 'connection'): void {
        if (!this.client || !this.yDoc) return;
        console.log('✏️ [Liveblocks] stopEditing:', { itemId, itemType });
        const editingLocks = this.yDoc.getMap<{
            itemId: string;
            itemType: 'note' | 'connection';
            userId: string;
            displayName?: string;
            timestamp: number;
        }>('editingLocks');
        const existing = editingLocks.get(itemId);
        if (!existing || existing.userId !== this.userId) {
            return;
        }
        editingLocks.delete(itemId);
    }

    // ============================================
    // Presence / 커서 공유
    // ============================================

    public updatePresence(update: Partial<SessionPresence>): void {
        if (!this.room) return;
        this.room.updatePresence({
            userId: this.userId,
            ...update,
            lastActivity: Date.now(),
        });
    }

    public onOthersPresence(
        callback: (others: Array<{ id: string; presence: SessionPresence }>) => void
    ): () => void {
        if (!this.room) return () => { };
        const unsubscribe = this.room.subscribe('others', (others) => {
            const list = Array.isArray(others)
                ? others.map(u => ({ id: u.id ?? u.connectionId ?? '', presence: u.presence as SessionPresence }))
                : [];
            callback(list);
        });
        return unsubscribe;
    }

    // ============================================
    // 채팅 동기화 기능
    // ============================================

    public sendChatMessage(content: string, suggestedActions?: AiAction[]): void {
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
            scope: 'group',
            suggestedActions
        };
        messages.push([newMessage]);
    }

    public sendAiResponse(content: string, functionCalls?: AiAction[]): void {
        if (!this.yDoc) return;
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const newMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content,
            userName: 'AI Assistant',
            userColor: '#8b5cf6',
            timestamp: Date.now(),
            scope: 'group',
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
            timestamp: Date.now(),
            scope: 'group'
        };
        messages.push([newMessage]);
        return id;
    }

    /**
     * 특정 ID의 AI 메시지 내용을 업데이트합니다
     */
    public updateAiResponse(id: string, content?: string, functionCalls?: AiAction[]): void {
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

    public clearChatMessages(): void {
        if (!this.yDoc) return;
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        if (messages.length === 0) return;
        this.yDoc.transact(() => {
            messages.delete(0, messages.length);
        });
    }

    public getStickyNotes(): StickyNoteData[] {
        if (!this.yDoc) return [];
        const rawArray = this.yDoc.getArray<StickyNoteData>('nodes').toArray();
        // dedupe by id - 마지막 항목 유지 (최신 업데이트)
        const deduped = new Map<string, StickyNoteData>();
        rawArray.forEach(note => deduped.set(note.id, note));
        return Array.from(deduped.values());
    }

    public getConnections(): LBConnectionData[] {
        if (!this.yDoc) return [];
        const rawArray = this.yDoc.getArray<LBConnectionData>('connections').toArray();
        // dedupe by id
        const deduped = new Map<string, LBConnectionData>();
        rawArray.forEach(conn => deduped.set(conn.id, conn));
        const result = Array.from(deduped.values());
        
        // 디버그: 각 연결선의 relationType 확인
        console.log('📥 [Liveblocks] getConnections 호출:', {
            rawCount: rawArray.length,
            dedupedCount: result.length,
            connections: result.map(c => ({ id: c.id, relationType: c.relationType })),
        });
        
        return result;
    }

    /**
     * Yjs 배열에서 중복 노드 제거 (소스 레벨 cleanup)
     * @returns 제거된 중복 노드 수
     */
    public cleanupDuplicateNodes(): number {
        if (!this.yDoc) return 0;
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        const seen = new Map<string, number>();
        const toDelete: number[] = [];

        nodes.forEach((node, index) => {
            if (seen.has(node.id)) {
                // 이전 인덱스(오래된 항목)를 삭제 대상에 추가
                toDelete.push(seen.get(node.id)!);
            }
            seen.set(node.id, index);
        });

        if (toDelete.length === 0) return 0;

        // 역순으로 삭제 (인덱스 변동 방지)
        this.yDoc.transact(() => {
            toDelete.sort((a, b) => b - a).forEach(idx => nodes.delete(idx, 1));
        });

        console.log(`🧹 [Liveblocks] cleanupDuplicateNodes: ${toDelete.length}개 중복 노드 제거`);
        return toDelete.length;
    }

    public onChatMessages(callback: (messages: ChatMessage[]) => void): () => void {
        if (!this.yDoc) return () => { };
        const messages = this.yDoc.getArray<ChatMessage>('chatMessages');
        const observer = () => callback(messages.toArray());
        messages.observe(observer);
        return () => messages.unobserve(observer);
    }

    // ============================================
    // AI 공용 키 동시 호출 제한 (Room-level lock)
    // ============================================

    public tryAcquireAiLock(ttlMs: number = 45000): boolean {
        if (!this.yDoc) return true;
        const aiStatus = this.yDoc.getMap<unknown>('aiStatus');
        const now = Date.now();
        const lockedBy = aiStatus.get('lockedBy') as string | undefined;
        const expiresAt = aiStatus.get('expiresAt') as number | undefined;

        if (lockedBy && expiresAt && expiresAt > now && lockedBy !== this.userId) {
            return false;
        }

        aiStatus.set('lockedBy', this.userId);
        aiStatus.set('lockedAt', now);
        aiStatus.set('expiresAt', now + ttlMs);
        return true;
    }

    public releaseAiLock(): void {
        if (!this.yDoc) return;
        const aiStatus = this.yDoc.getMap<unknown>('aiStatus');
        const lockedBy = aiStatus.get('lockedBy') as string | undefined;
        if (lockedBy && lockedBy !== this.userId) return;
        aiStatus.set('lockedBy', '');
        aiStatus.set('lockedAt', 0);
        aiStatus.set('expiresAt', 0);
    }

    public getAiLockStatus(): { lockedBy?: string; lockedAt?: number; expiresAt?: number } | null {
        if (!this.yDoc) return null;
        const aiStatus = this.yDoc.getMap<unknown>('aiStatus');
        return {
            lockedBy: aiStatus.get('lockedBy') as string | undefined,
            lockedAt: aiStatus.get('lockedAt') as number | undefined,
            expiresAt: aiStatus.get('expiresAt') as number | undefined,
        };
    }

    public onAiLockStatus(callback: (status: { lockedBy?: string; lockedAt?: number; expiresAt?: number } | null) => void): () => void {
        if (!this.yDoc) return () => { };
        const aiStatus = this.yDoc.getMap<unknown>('aiStatus');
        const observer = () => callback(this.getAiLockStatus());
        aiStatus.observe(observer);
        return () => aiStatus.unobserve(observer);
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
        // 로컬 업데이트 플래그 설정 (observe에서 스킵하도록)
        this.pendingLocalUpdates.add(note.id);
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

    /**
     * 다수 노드 위치를 단일 트랜잭션으로 일괄 업데이트 (레이아웃용)
     * @param updates 업데이트할 노드 배열 (id, x, y 필수)
     */
    public batchUpdateNodePositions(updates: Array<{ id: string; x: number; y: number; content?: string; layer?: number; sentiment?: string }>): void {
        if (!this.yDoc || updates.length === 0) return;
        const nodes = this.yDoc.getArray<StickyNoteData>('nodes');
        
        // 인덱스 미리 계산 (트랜잭션 내에서 인덱스가 변경되므로 Map 사용)
        const indexMap = new Map<string, number>();
        nodes.forEach((node, idx) => {
            if (!indexMap.has(node.id)) {
                indexMap.set(node.id, idx);
            }
        });

        // 로컬 업데이트 플래그 설정 (observe에서 스킵하도록)
        updates.forEach(update => {
            this.pendingLocalUpdates.add(update.id);
        });

        this.yDoc.transact(() => {
            updates.forEach(update => {
                const index = indexMap.get(update.id);
                if (index === undefined || index < 0) return;
                
                const existing = nodes.get(index);
                if (!existing) return;
                
                const fullNote: StickyNoteData = {
                    ...existing,
                    x: update.x,
                    y: update.y,
                    ...(update.content !== undefined && { content: update.content }),
                    ...(update.layer !== undefined && { layer: update.layer }),
                    ...(update.sentiment !== undefined && { sentiment: update.sentiment }),
                    timestamp: Date.now(),
                    author: this.displayName,
                };
                nodes.delete(index, 1);
                nodes.insert(index, [fullNote]);
            });
        });
        console.log(`✅ [Liveblocks] batchUpdateNodePositions 완료: ${updates.length}개 노드`);
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
        const relationType = connection.relationType === 'indirect' ? 'indirect' : 'direct';
        const normalized: LBConnectionData = {
            ...connection,
            relationType,
            isPositive: connection.isPositive !== false,
        };
        
        console.log('🔄 [Liveblocks] updateConnection 호출:', {
            id: connection.id,
            inputRelationType: connection.relationType,
            normalizedRelationType: relationType,
        });
        
        // 로컬 업데이트 플래그 설정
        this.pendingLocalUpdates.add(connection.id);
        const indicesToDelete: number[] = [];
        connections.toArray().forEach((conn, idx) => {
            if (conn.id === connection.id) {
                indicesToDelete.push(idx);
            }
        });
        this.yDoc.transact(() => {
            if (indicesToDelete.length > 0) {
                indicesToDelete.sort((a, b) => b - a).forEach((idx) => connections.delete(idx, 1));
            }
            connections.push([normalized]);
        });
        
        // 저장 후 확인 로그
        const afterSave = connections.toArray().filter(c => c.id === connection.id);
        console.log('✅ [Liveblocks] updateConnection 완료:', {
            id: connection.id,
            savedRelationType: afterSave[afterSave.length - 1]?.relationType,
            totalConnectionsWithId: afterSave.length,
        });
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

    /**
     * 스냅샷 복원용 트랜잭션 메서드 - 노드/연결선 전체 교체를 단일 트랜잭션으로 수행
     * @param notes 복원할 노드 배열
     * @param connections 복원할 연결선 배열
     */
    public restoreMapData(notes: StickyNoteData[], connections: LBConnectionData[]): void {
        if (!this.yDoc) return;
        const nodesArray = this.yDoc.getArray<StickyNoteData>('nodes');
        const connectionsArray = this.yDoc.getArray<LBConnectionData>('connections');
        this.yDoc.transact(() => {
            // 기존 데이터 삭제
            if (nodesArray.length > 0) {
                nodesArray.delete(0, nodesArray.length);
            }
            if (connectionsArray.length > 0) {
                connectionsArray.delete(0, connectionsArray.length);
            }
            // 새 데이터 일괄 삽입
            if (notes.length > 0) {
                nodesArray.push(notes);
            }
            if (connections.length > 0) {
                connectionsArray.push(connections);
            }
        });
        console.log('✅ [Liveblocks] restoreMapData 완료:', { nodes: notes.length, connections: connections.length });
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
    // 인사이트 공유 (Liveblocks)
    // ============================================

    public addInsight(insight: Insight): void {
        if (!this.yDoc) return;
        const insights = this.yDoc.getArray<Insight>('insights');
        const exists = insights.toArray().some(existing =>
            existing.id === insight.id || existing.title === insight.title
        );
        if (exists) return;
        insights.push([insight]);
    }

    public getInsights(): Insight[] {
        if (!this.yDoc) return [];
        return this.yDoc.getArray<Insight>('insights').toArray();
    }

    public clearInsights(): void {
        if (!this.yDoc) return;
        const insights = this.yDoc.getArray<Insight>('insights');
        if (insights.length === 0) return;
        this.yDoc.transact(() => {
            insights.delete(0, insights.length);
        });
    }

    public onInsights(callback: (insights: Insight[]) => void): () => void {
        if (!this.yDoc) return () => { };
        const insights = this.yDoc.getArray<Insight>('insights');
        const observer = () => callback(insights.toArray());
        insights.observe(observer);
        return () => insights.unobserve(observer);
    }

    // ============================================
    // 학술 파일 메타데이터 공유 (읽기 전용)
    // ============================================

    public publishAcademicFiles(files: AcademicFileMeta[]): void {
        if (!this.yDoc) return;
        const academicFiles = this.yDoc.getMap<AcademicFileMeta[]>('academicFiles');
        if (files.length === 0) {
            academicFiles.delete(this.userId);
            return;
        }
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
    // 공유 RAG 청크 관리 (벡터 임베딩 공유)
    // ============================================

    /**
     * 공유 RAG 청크 배열 가져오기 (Y.Array)
     */
    private getSharedRagChunksArray(): Y.Array<SharedRagChunk> | null {
        if (!this.yDoc) return null;
        return this.yDoc.getArray<SharedRagChunk>('sharedRagChunks');
    }

    /**
     * 공유 RAG에 청크 추가 (벡터 포함)
     */
    public addSharedRagChunks(chunks: SharedRagChunk[]): void {
        const arr = this.getSharedRagChunksArray();
        if (!arr || chunks.length === 0) {
            console.log('📚 [SharedRAG] 청크 추가 실패: Y.Array 없음 또는 빈 청크');
            return;
        }

        const beforeCount = arr.length;
        this.yDoc!.transact(() => {
            arr.push(chunks);
        });
        console.log(`📚 [SharedRAG] 청크 추가: ${chunks.length}개 (${beforeCount} → ${arr.length})`);
    }

    /**
     * 모든 공유 RAG 청크 가져오기
     */
    public getSharedRagChunks(): SharedRagChunk[] {
        const arr = this.getSharedRagChunksArray();
        if (!arr) {
            console.log('📚 [SharedRAG] Y.Array 없음 (yDoc 없음)');
            return [];
        }
        const chunks = arr.toArray();
        console.log(`📚 [SharedRAG] 청크 조회: ${chunks.length}개, 문서: ${[...new Set(chunks.map(c => c.docName))].join(', ')}`);
        return chunks;
    }

    /**
     * 특정 문서의 공유 RAG 청크가 있는지 확인
     */
    public hasSharedRagDoc(docId: string): boolean {
        const chunks = this.getSharedRagChunks();
        return chunks.some(chunk => chunk.docId === docId);
    }

    /**
     * 특정 문서의 공유 RAG 청크 삭제
     */
    public removeSharedRagDoc(docId: string): void {
        const arr = this.getSharedRagChunksArray();
        if (!arr) return;

        const indices: number[] = [];
        arr.forEach((chunk, index) => {
            if (chunk.docId === docId) {
                indices.push(index);
            }
        });

        if (indices.length === 0) return;

        // 역순으로 삭제 (인덱스 밀림 방지)
        this.yDoc!.transact(() => {
            for (let i = indices.length - 1; i >= 0; i--) {
                arr.delete(indices[i], 1);
            }
        });

        console.log(`🗑️ [Liveblocks] 공유 RAG 문서 삭제: ${docId} (${indices.length}개 청크)`);
    }

    /**
     * 공유 RAG 청크 변경 감지
     */
    public onSharedRagChunks(callback: (chunks: SharedRagChunk[]) => void): () => void {
        const arr = this.getSharedRagChunksArray();
        if (!arr) {
            console.log('📚 [SharedRAG] observe 실패: Y.Array 없음');
            return () => { };
        }

        const observer = (event: Y.YArrayEvent<SharedRagChunk>) => {
            console.log(`📚 [SharedRAG] Y.Array 변경 감지! origin: ${event.transaction.origin}, local: ${event.transaction.local}`);
            callback(arr.toArray());
        };
        arr.observe(observer);
        console.log('📚 [SharedRAG] Y.Array observe 등록 완료');
        return () => arr.unobserve(observer);
    }

    /**
     * 공유 RAG 문서 목록 (중복 제거)
     */
    public getSharedRagDocList(): Array<{ docId: string; docName: string; uploaderId: string; uploaderName: string; chunkCount: number; uploadedAt: number }> {
        const chunks = this.getSharedRagChunks();
        const docMap = new Map<string, { docId: string; docName: string; uploaderId: string; uploaderName: string; chunkCount: number; uploadedAt: number }>();

        chunks.forEach(chunk => {
            const existing = docMap.get(chunk.docId);
            if (existing) {
                existing.chunkCount += 1;
                if (chunk.uploadedAt < existing.uploadedAt) {
                    existing.uploadedAt = chunk.uploadedAt;
                }
            } else {
                docMap.set(chunk.docId, {
                    docId: chunk.docId,
                    docName: chunk.docName,
                    uploaderId: chunk.uploaderId,
                    uploaderName: chunk.uploaderName,
                    chunkCount: 1,
                    uploadedAt: chunk.uploadedAt,
                });
            }
        });

        return Array.from(docMap.values()).sort((a, b) => b.uploadedAt - a.uploadedAt);
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

    private normalizeSessionCode(code: string): string {
        return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    }

    private isValidSessionCode(code: string): boolean {
        return /^[A-Z0-9-]{3,12}$/.test(code);
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

    private async resetIndexeddbCacheAfterSync(code: string): Promise<void> {
        if (!this.indexeddbProvider) return;
        try {
            await this.indexeddbProvider.clearData();
            console.log(`🧹 [Liveblocks] IndexedDB cache cleared after sync: ${code}`);
        } catch (error) {
            console.warn('⚠️ [Liveblocks] IndexedDB cache clear failed:', error);
        }
    }

    private setupDataListeners(): void {
        if (!this.yDoc) return;

        // 노드 변경 감지 - delta 형식 사용 (더 안정적)
        this.yDoc.getArray<StickyNoteData>('nodes').observe((event) => {
            const nodesArray = this.yDoc!.getArray<StickyNoteData>('nodes');
            const delta = event.changes.delta;
            
            // 변경이 없으면 무시
            if (delta.length === 0 && event.changes.deleted.size === 0) return;

            // Delta에서 insert된 노드들 추출
            const insertedNotes: StickyNoteData[] = [];
            
            // retain 위치 추적을 위한 인덱스
            let currentIndex = 0;
            
            for (const op of delta) {
                if ('retain' in op && typeof op.retain === 'number') {
                    currentIndex += op.retain;
                } else if ('delete' in op && typeof op.delete === 'number') {
                    // 삭제된 노드는 event.changes.deleted에서 처리
                    currentIndex += 0; // delete는 인덱스를 이동시키지 않음
                } else if ('insert' in op && Array.isArray(op.insert)) {
                    insertedNotes.push(...(op.insert as StickyNoteData[]));
                    currentIndex += op.insert.length;
                }
            }

            // 대량 변경인 경우 전체 리스트 emit (개별 emit 스킵)
            const hasManyAdds = insertedNotes.length > 3; // 3개 초과면 대량 변경으로 간주
            const hasManyDeletes = event.changes.deleted.size > 3;
            if (hasManyAdds || hasManyDeletes) {
                console.log('📦 [Liveblocks] 대량 노드 변경 감지:', { adds: insertedNotes.length, deletes: event.changes.deleted.size });
                this.emit('notes-changed', nodesArray.toArray());
                // 대량 변경 시 pendingLocalUpdates 정리
                insertedNotes.forEach(note => this.pendingLocalUpdates.delete(note?.id));
                return; // 개별 emit 스킵
            }

            // 개별 노드 변경 이벤트 (추가/수정) - 로컬 업데이트는 스킵
            for (const note of insertedNotes) {
                if (!note || !note.id) continue;
                
                // 로컬에서 업데이트한 항목이면 스킵
                if (this.pendingLocalUpdates.has(note.id)) {
                    this.pendingLocalUpdates.delete(note.id);
                    continue;
                }
                
                console.log('📤 [Liveblocks] 원격 노드 emit:', note.id);
                this.emit('sticky-note-updated', note);
            }

            // 삭제 이벤트 처리 - 로컬 업데이트 중인 항목은 스킵 (delete+insert 패턴)
            event.changes.deleted.forEach((item) => {
                const content = item.content as unknown;
                let notes: StickyNoteData[] = [];
                
                if (content && typeof (content as { getContent?: () => unknown[] }).getContent === 'function') {
                    notes = (content as { getContent: () => StickyNoteData[] }).getContent();
                } else if (content && typeof (content as { toArray?: () => StickyNoteData[] }).toArray === 'function') {
                    notes = (content as { toArray: () => StickyNoteData[] }).toArray();
                }
                
                notes.forEach((note) => {
                    if (!note || !note.id) return;
                    
                    // 로컬에서 업데이트 중인 항목이면 삭제 이벤트 스킵 (delete+insert 패턴에서 발생)
                    if (this.pendingLocalUpdates.has(note.id)) {
                        console.log('⏭️ [Liveblocks] 로컬 업데이트 중 노드 삭제 스킵:', note.id);
                        return;
                    }
                    
                    const stillExists = nodesArray.toArray().some((n) => n.id === note.id);
                    if (!stillExists) {
                        this.emit('sticky-note-deleted', { noteId: note.id });
                    }
                });
            });
        });

        // 연결선 변경 감지 - delta 형식 사용 (더 안정적)
        this.yDoc.getArray<LBConnectionData>('connections').observe((event) => {
            const connectionsArray = this.yDoc!.getArray<LBConnectionData>('connections');
            const delta = event.changes.delta;

            // Delta에서 insert된 연결선들 추출
            const insertedConnections: LBConnectionData[] = [];
            
            for (const op of delta) {
                if ('insert' in op && Array.isArray(op.insert)) {
                    insertedConnections.push(...(op.insert as LBConnectionData[]));
                }
            }

            // 대량 변경인 경우 전체 리스트 emit (개별 emit 스킵)
            const hasManyAdds = insertedConnections.length > 3; // 3개 초과면 대량 변경으로 간주
            const hasManyDeletes = event.changes.deleted.size > 3;
            if (hasManyAdds || hasManyDeletes) {
                console.log('📦 [Liveblocks] 대량 연결선 변경 감지:', { adds: insertedConnections.length, deletes: event.changes.deleted.size });
                this.emit('connections-changed', connectionsArray.toArray());
                // 대량 변경 시 pendingLocalUpdates 정리
                insertedConnections.forEach(conn => this.pendingLocalUpdates.delete(conn?.id));
                return; // 개별 emit 스킵
            }

            // 개별 연결선 변경 이벤트 (추가/수정) - 로컬 업데이트는 스킵
            for (const conn of insertedConnections) {
                if (!conn || !conn.id) continue;
                
                // 로컬에서 업데이트한 항목이면 스킵
                if (this.pendingLocalUpdates.has(conn.id)) {
                    this.pendingLocalUpdates.delete(conn.id);
                    continue;
                }
                
                this.emit('connection-updated', conn);
            }

            // 삭제 이벤트 처리 - 로컬 업데이트 중인 항목은 스킵 (delete+insert 패턴)
            event.changes.deleted.forEach((item) => {
                const content = item.content as unknown;
                let connections: LBConnectionData[] = [];
                
                if (content && typeof (content as { getContent?: () => unknown[] }).getContent === 'function') {
                    connections = (content as { getContent: () => LBConnectionData[] }).getContent();
                } else if (content && typeof (content as { toArray?: () => LBConnectionData[] }).toArray === 'function') {
                    connections = (content as { toArray: () => LBConnectionData[] }).toArray();
                }
                
                connections.forEach((conn) => {
                    if (!conn || !conn.id) return;
                    
                    // 로컬에서 업데이트 중인 항목이면 삭제 이벤트 스킵 (delete+insert 패턴에서 발생)
                    if (this.pendingLocalUpdates.has(conn.id)) {
                        console.log('⏭️ [Liveblocks] 로컬 업데이트 중 삭제 스킵:', conn.id);
                        return;
                    }
                    
                    const stillExists = connectionsArray.toArray().some((c) => c.id === conn.id);
                    if (!stillExists) {
                        this.emit('connection-deleted', { connectionId: conn.id });
                    }
                });
            });
        });

        // 편집 락 변경 감지
        const editingLocks = this.yDoc.getMap<{
            itemId: string;
            itemType: 'note' | 'connection';
            userId: string;
            displayName?: string;
            timestamp: number;
        }>('editingLocks');

        editingLocks.observe((event) => {
            event.changes.keys.forEach((change, key) => {
                if (change.action === 'add' || change.action === 'update') {
                    const lock = editingLocks.get(key);
                    if (!lock) return;
                    this.emit('editing-started', lock);
                }

                if (change.action === 'delete') {
                    const oldValue = change.oldValue as {
                        itemId: string;
                        itemType: 'note' | 'connection';
                        userId: string;
                        displayName?: string;
                        timestamp: number;
                    } | undefined;

                    if (!oldValue) {
                        this.emit('editing-stopped', { itemId: key });
                        return;
                    }

                    this.emit('editing-stopped', oldValue);
                }
            });
        });

        const layerSettings = this.yDoc.getMap<unknown>('layerSettings');
        layerSettings.observe(() => {
            // 로컬 업데이트는 스킵
            if (this.pendingLocalUpdates.has('__layerSettings__')) {
                this.pendingLocalUpdates.delete('__layerSettings__');
                return;
            }

            const settings = this.getLayerSettings();
            if (!settings) return;
            this.emit('layer-settings-changed', settings);
        });

        const metadata = this.yDoc.getMap<unknown>('metadata');
        metadata.observe(() => {
            this.syncSessionMetadata();
        });
    }

    private syncSessionMetadata(): void {
        if (!this.yDoc || !this.currentSession) return;
        const metadata = this.yDoc.getMap<unknown>('metadata');
        const nextType = metadata.get('type');
        if (nextType === 'workshop' || nextType === 'consulting') {
            if (this.currentSession.type !== nextType) {
                this.currentSession = { ...this.currentSession, type: nextType };
                this.emit('session-type-changed', nextType);
            }
        }
        const nextName = metadata.get('name');
        if (typeof nextName === 'string' && nextName && this.currentSession.name !== nextName) {
            this.currentSession = { ...this.currentSession, name: nextName };
        }
    }

    public updateLayerSettings(settings: LayerSettings): void {
        if (!this.yDoc) {
            console.warn('⚠️ [Liveblocks] updateLayerSettings: yDoc이 없음');
            return;
        }

        // 로컬 업데이트 플래그 설정
        this.pendingLocalUpdates.add('__layerSettings__');

        const layerHeights = this.normalizeLayerArray(settings.layerHeights, this.defaultLayerHeights);
        const layerOpacities = this.normalizeLayerArray(settings.layerOpacities, this.defaultLayerOpacities);

        const layerSettings = this.yDoc.getMap<unknown>('layerSettings');
        const currentHeights = this.normalizeLayerArray(
            layerSettings.get('layerHeights'),
            this.defaultLayerHeights
        );
        const currentOpacities = this.normalizeLayerArray(
            layerSettings.get('layerOpacities'),
            this.defaultLayerOpacities
        );

        if (!this.areNumberArraysEqual(layerHeights, currentHeights)) {
            layerSettings.set('layerHeights', layerHeights);
        }

        if (!this.areNumberArraysEqual(layerOpacities, currentOpacities)) {
            layerSettings.set('layerOpacities', layerOpacities);
        }
        
        // showLayerBackground 동기화 (optional 필드)
        if (typeof settings.showLayerBackground === 'boolean') {
            const currentBackgroundRaw = layerSettings.get('showLayerBackground');
            const currentBackground = typeof currentBackgroundRaw === 'boolean'
                ? currentBackgroundRaw
                : undefined;
            if (currentBackground !== settings.showLayerBackground) {
                layerSettings.set('showLayerBackground', settings.showLayerBackground);
            }
        }
    }

    public getLayerSettings(): LayerSettings | null {
        if (!this.yDoc) return null;
        const layerSettings = this.yDoc.getMap<unknown>('layerSettings');
        const layerHeights = this.normalizeLayerArray(layerSettings.get('layerHeights'), this.defaultLayerHeights);
        const layerOpacities = this.normalizeLayerArray(layerSettings.get('layerOpacities'), this.defaultLayerOpacities);
        
        // showLayerBackground 읽기 (optional 필드)
        const showLayerBackgroundRaw = layerSettings.get('showLayerBackground');
        const showLayerBackground = typeof showLayerBackgroundRaw === 'boolean' ? showLayerBackgroundRaw : undefined;

        return {
            layerHeights,
            layerOpacities,
            showLayerBackground,
        };
    }

    private normalizeLayerArray(value: unknown, fallback: number[]): number[] {
        if (!Array.isArray(value) || value.length !== 4) {
            return [...fallback];
        }

        const normalized = value.map((item, index) => {
            const numeric = typeof item === 'number' && Number.isFinite(item)
                ? item
                : fallback[index];
            return numeric;
        });

        return normalized.length === 4 ? normalized : [...fallback];
    }

    private areNumberArraysEqual(left: number[], right: number[]): boolean {
        if (left.length !== right.length) return false;
        return left.every((value, index) => value === right[index]);
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

        const { room, leave } = this.client.enterRoom<{ cursor: null }>(roomId, {
            initialPresence: { cursor: null },
        });

        this.configLeave = leave;
        this.configProvider = new LiveblocksYjsProvider(room, this.configDoc);

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
    public async registerSession(code: string, name: string, type: SessionType, organization?: string): Promise<void> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (!sessionsMap) return;

        const existing = sessionsMap.get(code) as { code: string; name: string; type: string; createdAt: number; createdBy: string; organization?: string } | undefined;
        const sessionData = {
            code,
            name,
            type,
            organization: organization ?? existing?.organization,
            createdAt: existing?.createdAt ?? Date.now(),
            createdBy: existing?.createdBy ?? this.displayName
        };

        sessionsMap.set(code, sessionData);
        console.log('✅ 세션 레지스트리에 등록:', code, organization ? `(${organization})` : '');
    }

    /**
     * 세션 레지스트리 목록 조회
     */
    public async getSessionRegistry(): Promise<Array<{ code: string; name: string; type: string; createdAt: number; organization?: string }>> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (!sessionsMap) {
            return [];
        }

        const sessions: Array<{ code: string; name: string; type: string; createdAt: number; organization?: string }> = [];
        sessionsMap.forEach((value, key) => {
            const session = value as { code: string; name: string; type: string; createdAt: number; organization?: string };
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

    /**
     * 세션의 organization(기업명) 업데이트
     */
    public async updateSessionOrganization(code: string, organization: string): Promise<void> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (!sessionsMap) return;

        const existing = sessionsMap.get(code) as { code: string; name: string; type: string; createdAt: number; createdBy: string; organization?: string } | undefined;
        if (!existing) {
            console.warn('⚠️ 세션을 찾을 수 없음:', code);
            return;
        }

        const updatedData = {
            ...existing,
            organization
        };

        sessionsMap.set(code, updatedData);
        console.log('✅ 세션 organization 업데이트:', code, '→', organization);
    }

    /**
     * 여러 세션의 organization 일괄 업데이트
     */
    public async bulkUpdateSessionOrganization(codes: string[], organization: string): Promise<void> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (!sessionsMap) return;

        for (const code of codes) {
            const existing = sessionsMap.get(code) as { code: string; name: string; type: string; createdAt: number; createdBy: string; organization?: string } | undefined;
            if (existing) {
                sessionsMap.set(code, { ...existing, organization });
            }
        }
        console.log('✅ 세션 organization 일괄 업데이트:', codes.length, '개 →', organization);
    }

    /**
     * 세션명 변경 (레지스트리 반영)
     */
    public async updateSessionName(code: string, name: string): Promise<void> {
        await this.connectToConfigRoom();
        const sessionsMap = this.configDoc?.getMap<unknown>('sessions');

        if (!sessionsMap) return;

        const existing = sessionsMap.get(code) as { code: string; name: string; type: string; createdAt: number; createdBy: string; organization?: string } | undefined;
        if (!existing) {
            console.warn('⚠️ 세션을 찾을 수 없음:', code);
            return;
        }

        const updatedData = {
            ...existing,
            name
        };

        sessionsMap.set(code, updatedData);
        console.log('✅ 세션명 업데이트:', code, '→', name);

        // 현재 세션이면 로컬 상태도 업데이트
        if (this.currentSession && this.currentSession.code === code) {
            this.currentSession = { ...this.currentSession, name };
        }
    }

    // ==================== 마스터키 관리 ====================

    private readonly DEFAULT_MASTER_KEY = 'welcome09@!';

    /**
     * 마스터키 가져오기 (없으면 기본값 설정)
     */
    public async getMasterKey(): Promise<string> {
        const config = await this.connectToConfigRoom();
        let masterKey = config.get('masterKey') as string | undefined;
        
        if (!masterKey) {
            // 기본값 설정
            config.set('masterKey', this.DEFAULT_MASTER_KEY);
            masterKey = this.DEFAULT_MASTER_KEY;
            console.log('🔑 마스터키 기본값 설정:', this.DEFAULT_MASTER_KEY);
        }
        
        return masterKey;
    }

    /**
     * 마스터키 설정 (관리자만 사용)
     */
    public async setMasterKey(key: string): Promise<void> {
        const config = await this.connectToConfigRoom();
        config.set('masterKey', key);
        config.set('updatedAt', Date.now());
        console.log('✅ 마스터키 변경 완료');
    }

    /**
     * 마스터키 검증
     */
    public async validateMasterKey(input: string): Promise<boolean> {
        const masterKey = await this.getMasterKey();
        return input === masterKey;
    }

    // ==================== 기업 비밀번호 관리 ====================

    /**
     * 기업 비밀번호 설정
     */
    public async setOrganizationPassword(org: string, password: string): Promise<void> {
        const config = await this.connectToConfigRoom();
        
        // organizationPasswords Map 가져오기 또는 생성
        let orgPasswords = config.get('organizationPasswords') as Record<string, string> | undefined;
        if (!orgPasswords) {
            orgPasswords = {};
        }
        
        orgPasswords[org] = password;
        config.set('organizationPasswords', orgPasswords);
        config.set('updatedAt', Date.now());
        console.log('✅ 기업 비밀번호 설정:', org);
    }

    /**
     * 기업 비밀번호 가져오기
     */
    public async getOrganizationPassword(org: string): Promise<string | null> {
        const config = await this.connectToConfigRoom();
        const orgPasswords = config.get('organizationPasswords') as Record<string, string> | undefined;
        
        if (!orgPasswords) return null;
        return orgPasswords[org] || null;
    }

    /**
     * 기업 비밀번호 검증 (대소문자 구분 없음)
     */
    public async validateOrganizationPassword(org: string, inputPw: string): Promise<boolean> {
        const savedPw = await this.getOrganizationPassword(org);
        if (!savedPw) {
            // 비밀번호 미설정 시 통과
            return true;
        }
        return inputPw.toLowerCase() === savedPw.toLowerCase();
    }

    /**
     * 모든 기업 비밀번호 가져오기 (관리자용)
     */
    public async getAllOrganizationPasswords(): Promise<Record<string, string>> {
        const config = await this.connectToConfigRoom();
        const orgPasswords = config.get('organizationPasswords') as Record<string, string> | undefined;
        return orgPasswords || {};
    }

    /**
     * 기업 비밀번호 삭제
     */
    public async deleteOrganizationPassword(org: string): Promise<void> {
        const config = await this.connectToConfigRoom();
        const orgPasswords = config.get('organizationPasswords') as Record<string, string> | undefined;
        
        if (orgPasswords && orgPasswords[org]) {
            delete orgPasswords[org];
            config.set('organizationPasswords', orgPasswords);
            config.set('updatedAt', Date.now());
            console.log('✅ 기업 비밀번호 삭제:', org);
        }
    }

    // ============================================
    // 세션별 비밀번호 관리
    // ============================================

    /**
     * 세션 비밀번호 설정
     */
    public async setSessionPassword(sessionCode: string, password: string): Promise<void> {
        const config = await this.connectToConfigRoom();
        const sessionPasswords = config.get('sessionPasswords') as Record<string, string> | undefined || {};
        sessionPasswords[sessionCode] = password;
        config.set('sessionPasswords', sessionPasswords);
        config.set('updatedAt', Date.now());
        console.log('✅ 세션 비밀번호 설정:', sessionCode);
    }

    /**
     * 세션 비밀번호 가져오기
     */
    public async getSessionPassword(sessionCode: string): Promise<string | null> {
        const config = await this.connectToConfigRoom();
        const sessionPasswords = config.get('sessionPasswords') as Record<string, string> | undefined;
        return sessionPasswords?.[sessionCode] || null;
    }

    /**
     * 세션 비밀번호 검증 (대소문자 구분 없음)
     */
    public async validateSessionPassword(sessionCode: string, inputPw: string): Promise<boolean> {
        const savedPw = await this.getSessionPassword(sessionCode);
        if (!savedPw) {
            // 비밀번호 미설정 시 통과
            return true;
        }
        return inputPw.toLowerCase() === savedPw.toLowerCase();
    }

    /**
     * 모든 세션 비밀번호 가져오기 (관리자용)
     */
    public async getAllSessionPasswords(): Promise<Record<string, string>> {
        const config = await this.connectToConfigRoom();
        const sessionPasswords = config.get('sessionPasswords') as Record<string, string> | undefined;
        return sessionPasswords || {};
    }

    /**
     * 세션 비밀번호 삭제
     */
    public async deleteSessionPassword(sessionCode: string): Promise<void> {
        const config = await this.connectToConfigRoom();
        const sessionPasswords = config.get('sessionPasswords') as Record<string, string> | undefined;
        
        if (sessionPasswords && sessionPasswords[sessionCode]) {
            delete sessionPasswords[sessionCode];
            config.set('sessionPasswords', sessionPasswords);
            config.set('updatedAt', Date.now());
            console.log('✅ 세션 비밀번호 삭제:', sessionCode);
        }
    }

    // ============================================
    // 세션 별칭(Alias) 관리 - 사용자 친화적 진입 코드
    // ============================================

    /**
     * 세션 별칭 설정 (1:1 관계)
     * @param sessionCode 실제 세션 코드
     * @param alias 사용자 지정 별칭 (빈 문자열이면 삭제)
     */
    public async setSessionAlias(sessionCode: string, alias: string): Promise<{ success: boolean; error?: string }> {
        const config = await this.connectToConfigRoom();
        const aliases = config.get('sessionAliases') as Record<string, string> | undefined || {};
        
        const trimmedAlias = alias.trim().toUpperCase();
        
        // 빈 별칭이면 기존 별칭 삭제
        if (!trimmedAlias) {
            // 이 세션의 기존 별칭 찾아서 삭제
            for (const [existingAlias, code] of Object.entries(aliases)) {
                if (code === sessionCode) {
                    delete aliases[existingAlias];
                }
            }
            config.set('sessionAliases', aliases);
            config.set('updatedAt', Date.now());
            console.log('✅ 세션 별칭 삭제:', sessionCode);
            return { success: true };
        }

        // 별칭이 기존 세션 코드와 충돌하는지 확인
        const registry = await this.getSessionRegistry();
        const existingCodes = registry.map(s => s.code.toUpperCase());
        if (existingCodes.includes(trimmedAlias)) {
            return { success: false, error: '이미 존재하는 세션 코드와 동일합니다' };
        }

        // 별칭이 다른 세션에서 사용 중인지 확인
        if (aliases[trimmedAlias] && aliases[trimmedAlias] !== sessionCode) {
            return { success: false, error: '이미 다른 세션에서 사용 중인 별칭입니다' };
        }

        // 이 세션의 기존 별칭 삭제 (1:1 관계 유지)
        for (const [existingAlias, code] of Object.entries(aliases)) {
            if (code === sessionCode) {
                delete aliases[existingAlias];
            }
        }

        // 새 별칭 설정
        aliases[trimmedAlias] = sessionCode;
        config.set('sessionAliases', aliases);
        config.set('updatedAt', Date.now());
        console.log('✅ 세션 별칭 설정:', trimmedAlias, '→', sessionCode);
        return { success: true };
    }

    /**
     * 세션 코드로 별칭 가져오기
     */
    public async getSessionAlias(sessionCode: string): Promise<string | null> {
        const config = await this.connectToConfigRoom();
        const aliases = config.get('sessionAliases') as Record<string, string> | undefined;
        if (!aliases) return null;
        
        for (const [alias, code] of Object.entries(aliases)) {
            if (code === sessionCode) {
                return alias;
            }
        }
        return null;
    }

    /**
     * 모든 세션 별칭 가져오기 (관리자용)
     * @returns { alias: sessionCode } 형태
     */
    public async getAllSessionAliases(): Promise<Record<string, string>> {
        const config = await this.connectToConfigRoom();
        const aliases = config.get('sessionAliases') as Record<string, string> | undefined;
        return aliases || {};
    }

    /**
     * 별칭 또는 세션 코드로 실제 세션 코드 찾기
     * 사용자 진입 시 호출
     */
    public async resolveSessionCode(input: string): Promise<string> {
        const upperInput = input.trim().toUpperCase();
        
        // 1. 별칭 테이블에서 찾기
        const aliases = await this.getAllSessionAliases();
        if (aliases[upperInput]) {
            console.log('🔗 별칭으로 세션 찾음:', upperInput, '→', aliases[upperInput]);
            return aliases[upperInput];
        }
        
        // 2. 별칭이 아니면 원래 코드로 간주
        return upperInput;
    }
}

export const liveblocksService = new LiveblocksService();
export default liveblocksService;
