import { database } from '../lib/firebase';
import { 
  ref, 
  push, 
  set, 
  onValue, 
  off, 
  remove,
  serverTimestamp,
  onDisconnect
} from 'firebase/database';
import type { DatabaseReference } from 'firebase/database';

// 기존 MultiUserService와 동일한 인터페이스 유지
interface MultiUserSession {
  code: string;
  isHost: boolean;
  connectedUsers: number;
}

interface StickyNoteUpdate {
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
}

class FirebaseMultiUserService {
  private currentSession: MultiUserSession | null = null;
  private listeners: { [event: string]: Array<(...args: unknown[]) => void> } = {};
  private firebaseRefs: { [key: string]: DatabaseReference } = {};
  private userId: string;

  constructor() {
    // 고유한 사용자 ID 생성
    this.userId = this.generateUserId();
    console.log('🔥 Firebase MultiUser Service initialized with user ID:', this.userId);
  }

  private generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 이벤트 리스너 등록 (기존 API 유지)
  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // 이벤트 리스너 제거
  off(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  // 이벤트 발생
  private emit(event: string, data?: unknown) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  // 세션 코드 생성
  private generateSessionCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  // 세션 생성
  async createSession(): Promise<string> {
    try {
      const sessionCode = this.generateSessionCode();
      const sessionRef = ref(database, `sessions/${sessionCode}`);
      
      // 세션 메타데이터 설정
      await set(sessionRef, {
        code: sessionCode,
        host: this.userId,
        createdAt: serverTimestamp(),
        users: {
          [this.userId]: {
            userId: this.userId,
            joinedAt: serverTimestamp(),
            isHost: true,
            isOnline: true
          }
        },
        userCount: 1,
        notes: {},
        connections: {},
        layerState: {}
      });

      console.log('🔥 Firebase session created:', sessionCode);
      return sessionCode;
    } catch (error) {
      console.error('❌ Failed to create Firebase session:', error);
      throw new Error('세션 생성에 실패했습니다.');
    }
  }

  // 세션 참가
  joinSession(code: string, isHost: boolean = false) {
    try {
      this.currentSession = {
        code,
        isHost,
        connectedUsers: 1,
      };

      const sessionRef = ref(database, `sessions/${code}`);
      const userRef = ref(database, `sessions/${code}/users/${this.userId}`);
      const userCountRef = ref(database, `sessions/${code}/userCount`);

      // 사용자 정보 등록
      set(userRef, {
        userId: this.userId,
        joinedAt: serverTimestamp(),
        isHost: isHost,
        isOnline: true
      });

      // 연결 해제 시 자동으로 offline 처리
      onDisconnect(userRef).set({
        userId: this.userId,
        isHost: isHost,
        isOnline: false,
        leftAt: serverTimestamp()
      });

      // 실시간 데이터 리스너 설정
      this.setupRealtimeListeners(code);

      console.log('🔥 Joined Firebase session:', code);
    } catch (error) {
      console.error('❌ Failed to join Firebase session:', error);
    }
  }

  // 실시간 리스너 설정
  private setupRealtimeListeners(sessionCode: string) {
    // 사용자 수 변경 감지
    const userCountRef = ref(database, `sessions/${sessionCode}/users`);
    this.firebaseRefs.userCount = userCountRef;
    
    onValue(userCountRef, (snapshot) => {
      if (snapshot.exists()) {
        const users = snapshot.val();
        const onlineUsers = Object.values(users).filter((user: unknown) => user.isOnline);
        const userCount = onlineUsers.length;
        
        if (this.currentSession) {
          this.currentSession.connectedUsers = userCount;
        }
        
        this.emit('user-joined', { userCount });
      }
    });

    // 스티키 노트 변경 감지
    const notesRef = ref(database, `sessions/${sessionCode}/notes`);
    this.firebaseRefs.notes = notesRef;
    
    onValue(notesRef, (snapshot) => {
      if (snapshot.exists()) {
        const notes = snapshot.val();
        Object.values(notes).forEach((note: StickyNoteUpdate) => {
          if (note.author !== this.userId) {
            this.emit('sticky-note-updated', note);
          }
        });
      }
    });

    // 연결선 변경 감지
    const connectionsRef = ref(database, `sessions/${sessionCode}/connections`);
    this.firebaseRefs.connections = connectionsRef;
    
    onValue(connectionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const connections = snapshot.val();
        Object.values(connections).forEach((connection: unknown) => {
          this.emit('connection-updated', connection);
        });
      }
    });

    // 층위 상태 변경 감지
    const layerStateRef = ref(database, `sessions/${sessionCode}/layerState`);
    this.firebaseRefs.layerState = layerStateRef;
    
    onValue(layerStateRef, (snapshot) => {
      if (snapshot.exists()) {
        const layerState = snapshot.val();
        this.emit('layer-state-updated', layerState);
      }
    });
  }

  // 세션 유효성 검사
  async validateSession(code: string): Promise<boolean> {
    try {
      const sessionRef = ref(database, `sessions/${code}`);
      
      return new Promise((resolve) => {
        onValue(sessionRef, (snapshot) => {
          resolve(snapshot.exists());
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Failed to validate Firebase session:', error);
      return false;
    }
  }

  // 스티키 노트 업데이트
  updateStickyNote(note: StickyNoteUpdate) {
    if (!this.currentSession) {
      console.error('❌ No active session - cannot update sticky note');
      return;
    }

    try {
      const noteRef = ref(database, `sessions/${this.currentSession.code}/notes/${note.id}`);
      const noteData = {
        ...note,
        author: this.userId,
        timestamp: serverTimestamp()
      };

      set(noteRef, noteData);
      
      console.log('🔥 Firebase sticky note updated:', note.id);
    } catch (error) {
      console.error('❌ Failed to update Firebase sticky note:', error);
    }
  }

  // 스티키 노트 삭제
  deleteStickyNote(noteId: string) {
    if (!this.currentSession) return;

    try {
      const noteRef = ref(database, `sessions/${this.currentSession.code}/notes/${noteId}`);
      remove(noteRef);
      
      this.emit('sticky-note-deleted', { noteId });
      console.log('🔥 Firebase sticky note deleted:', noteId);
    } catch (error) {
      console.error('❌ Failed to delete Firebase sticky note:', error);
    }
  }

  // 연결선 업데이트
  updateConnection(connection: unknown) {
    if (!this.currentSession) return;

    try {
      const connectionRef = ref(database, `sessions/${this.currentSession.code}/connections/${connection.id}`);
      set(connectionRef, connection);
      
      console.log('🔥 Firebase connection updated:', connection.id);
    } catch (error) {
      console.error('❌ Failed to update Firebase connection:', error);
    }
  }

  // 연결선 삭제
  deleteConnection(connectionId: string) {
    if (!this.currentSession) return;

    try {
      const connectionRef = ref(database, `sessions/${this.currentSession.code}/connections/${connectionId}`);
      remove(connectionRef);
      
      this.emit('connection-deleted', { connectionId });
      console.log('🔥 Firebase connection deleted:', connectionId);
    } catch (error) {
      console.error('❌ Failed to delete Firebase connection:', error);
    }
  }

  // 프로젝트 데이터 동기화
  syncProjectData(projectData: unknown) {
    if (!this.currentSession) return;

    try {
      const projectRef = ref(database, `sessions/${this.currentSession.code}/projectData`);
      set(projectRef, projectData);
      
      console.log('🔥 Firebase project data synced');
    } catch (error) {
      console.error('❌ Failed to sync Firebase project data:', error);
    }
  }

  // 분석 데이터 업데이트
  updateAnalysisData(analysisData: unknown) {
    if (!this.currentSession) return;

    try {
      const analysisRef = ref(database, `sessions/${this.currentSession.code}/analysisData`);
      set(analysisRef, analysisData);
      
      console.log('🔥 Firebase analysis data updated');
    } catch (error) {
      console.error('❌ Failed to update Firebase analysis data:', error);
    }
  }

  // 워크샵 데이터 업데이트
  updateWorkshopData(workshopData: unknown) {
    if (!this.currentSession) return;

    try {
      const workshopRef = ref(database, `sessions/${this.currentSession.code}/workshopData`);
      set(workshopRef, workshopData);
      
      console.log('🔥 Firebase workshop data updated');
    } catch (error) {
      console.error('❌ Failed to update Firebase workshop data:', error);
    }
  }

  // 편집 시작 알림
  startEditing(itemId: string, itemType: 'note' | 'connection') {
    if (!this.currentSession) return;

    try {
      const editingRef = ref(database, `sessions/${this.currentSession.code}/editing/${itemId}`);
      set(editingRef, {
        userId: this.userId,
        itemType,
        startedAt: serverTimestamp()
      });
      
      console.log('🔥 Firebase editing started:', itemId);
    } catch (error) {
      console.error('❌ Failed to start Firebase editing:', error);
    }
  }

  // 편집 완료 알림
  stopEditing(itemId: string, itemType: 'note' | 'connection') {
    if (!this.currentSession) return;

    try {
      const editingRef = ref(database, `sessions/${this.currentSession.code}/editing/${itemId}`);
      remove(editingRef);
      
      console.log('🔥 Firebase editing stopped:', itemId);
    } catch (error) {
      console.error('❌ Failed to stop Firebase editing:', error);
    }
  }

  // 층위 상태 동기화
  updateLayerState(layerState: unknown) {
    if (!this.currentSession) return;

    try {
      const layerRef = ref(database, `sessions/${this.currentSession.code}/layerState`);
      set(layerRef, layerState);
      
      console.log('🔥 Firebase layer state updated');
    } catch (error) {
      console.error('❌ Failed to update Firebase layer state:', error);
    }
  }

  // 현재 세션 정보 가져오기
  getCurrentSession(): MultiUserSession | null {
    return this.currentSession;
  }

  // 현재 사용자 ID 가져오기
  getCurrentUserId(): string | null {
    return this.userId;
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.currentSession !== null;
  }

  // 연결 해제
  disconnect() {
    if (this.currentSession) {
      // 모든 Firebase 리스너 해제
      Object.values(this.firebaseRefs).forEach(ref => {
        off(ref);
      });
      
      this.firebaseRefs = {};
      this.currentSession = null;
      
      console.log('🔥 Firebase disconnected');
    }
  }
}

export default new FirebaseMultiUserService();