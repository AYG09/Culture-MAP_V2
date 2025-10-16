import { database } from '../lib/firebase';
import {
  ref,
  set,
  onValue,
  off,
  remove,
  serverTimestamp,
  onDisconnect,
} from 'firebase/database';
import type { DatabaseReference } from 'firebase/database';
import type { PerceptionIntensity } from '../types/culture';
import gatewayAdminService from './GatewayAdminService';

// 세션 타입: 워크샵, 컨설팅
export type SessionType = 'workshop' | 'consulting';

// 기존 MultiUserService와 동일한 인터페이스 유지
interface MultiUserSession {
  code: string;
  isHost: boolean;
  connectedUsers: number;
  name?: string;  // 추가: 세션 명칭
  type: SessionType;  // 추가: 세션 타입
}

interface SessionMetadata {
  code: string;
  name: string;
  type: SessionType;  // 추가: 세션 타입
  userCount: number;
  createdAt: number;
  lastActivity: number;
}

export type { SessionMetadata };  // export 추가

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
  frequency?: PerceptionIntensity; // 컨설팅 모드용 빈도 필드
}

interface EditingInfo {
  userId: string;
  userName?: string;
  timestamp: number;
}

interface FirebaseUser {
  id: string;
  isOnline: boolean;
  lastActivity: number;
}

interface FirebaseConnection {
  id: string;
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

interface FirebaseSessionData {
  code: string;
  name: string;
  type: SessionType;
  userCount: number;
  createdAt: number | object;
  lastActivity: number | object;
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
  async createSession(sessionName?: string, sessionType: SessionType = 'workshop'): Promise<string> {
    try {
      const sessionCode = this.generateSessionCode();
      const sessionRef = ref(database, `sessions/${sessionCode}`);

      // 세션 메타데이터 설정
      await set(sessionRef, {
        name: sessionName || `세션 ${sessionCode}`,  // 추가: 기본 이름
        code: sessionCode,
        type: sessionType,  // 추가: 세션 타입
        host: this.userId,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),  // 추가: 마지막 활동 시간
        users: {
          [this.userId]: {
            userId: this.userId,
            joinedAt: serverTimestamp(),
            isHost: true,
            isOnline: true,
          },
        },
        userCount: 1,
        notes: {},
        connections: {},
        layerState: {},
      });

      // currentSession에 타입 포함
      this.currentSession = {
        code: sessionCode,
        type: sessionType,  // 추가: 세션 타입
        isHost: true,
        connectedUsers: 1,
      };

      // 🔑 세션 코드를 비밀번호로 자동 등록 (24시간 유효)
      try {
        const passwordId = await gatewayAdminService.createSessionPassword(sessionCode, 24);
        console.log(`🔑 Gateway password created for session: ${sessionCode} (ID: ${passwordId})`);
      } catch (pwdError) {
        console.error('⚠️ Failed to create gateway password:', pwdError);
        // 비밀번호 생성 실패해도 세션은 계속 진행
      }

      console.log('🔥 Firebase session created:', sessionCode, 'Type:', sessionType);
      return sessionCode;
    } catch (error) {
      console.error('❌ Failed to create Firebase session:', error);
      throw new Error('세션 생성에 실패했습니다.');
    }
  }

  // 세션 참가
  joinSession(code: string, isHost: boolean = false) {
    try {
      const sessionRef = ref(database, `sessions/${code}`);
      const userRef = ref(database, `sessions/${code}/users/${this.userId}`);

      // 세션 타입 읽기 (하위 호환성: type 없으면 'workshop')
      onValue(sessionRef, (snapshot) => {
        const sessionData = snapshot.val();
        const sessionType = sessionData?.type || 'workshop';  // 기본값
        const sessionName = sessionData?.name;

        this.currentSession = {
          code,
          type: sessionType,  // 추가: 세션 타입
          isHost,
          connectedUsers: sessionData?.userCount || 1,
          name: sessionName,
        };

        console.log('🔥 Session type loaded:', sessionType);
      }, { onlyOnce: true });

      // 사용자 정보 등록
      set(userRef, {
        userId: this.userId,
        joinedAt: serverTimestamp(),
        isHost: isHost,
        isOnline: true,
      });

      // 연결 해제 시 자동으로 offline 처리
      onDisconnect(userRef).set({
        userId: this.userId,
        isHost: isHost,
        isOnline: false,
        leftAt: serverTimestamp(),
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

    onValue(userCountRef, snapshot => {
      if (snapshot.exists()) {
        const users = snapshot.val() as Record<string, FirebaseUser>;
        const onlineUsers = Object.values(users).filter((user) => user.isOnline);
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

    onValue(notesRef, snapshot => {
      if (snapshot.exists()) {
        const notes = snapshot.val() as Record<string, StickyNoteUpdate>;
        Object.values(notes).forEach((note) => {
          if (note.author !== this.userId) {
            this.emit('sticky-note-updated', note);
          }
        });
      }
    });

    // 연결선 변경 감지
    const connectionsRef = ref(database, `sessions/${sessionCode}/connections`);
    this.firebaseRefs.connections = connectionsRef;

    onValue(connectionsRef, snapshot => {
      if (snapshot.exists()) {
        const connections = snapshot.val() as Record<string, FirebaseConnection>;
        Object.values(connections).forEach((connection) => {
          this.emit('connection-updated', connection);
        });
      }
    });

    // 층위 상태 변경 감지
    const layerStateRef = ref(database, `sessions/${sessionCode}/layerState`);
    this.firebaseRefs.layerState = layerStateRef;

    onValue(layerStateRef, snapshot => {
      if (snapshot.exists()) {
        const layerState = snapshot.val();
        this.emit('layer-state-updated', layerState);
      }
    });

    // 편집 상태 변경 감지 추가
    const editingRef = ref(database, `sessions/${sessionCode}/editing`);
    this.firebaseRefs.editing = editingRef;

    // 이전 편집 상태를 추적하여 시작/중지 이벤트 구분
    let previousEditingData: Record<string, EditingInfo & { itemType: string }> = {};

    onValue(editingRef, snapshot => {
      const currentEditingData = snapshot.exists() ? snapshot.val() as Record<string, EditingInfo & { itemType: string }> : {};
      
      // 새로 시작된 편집 감지
      Object.entries(currentEditingData).forEach(([itemId, editInfo]) => {
        if (!previousEditingData[itemId] && editInfo.userId !== this.userId) {
          console.log('🔥 Firebase editing started:', { itemId, editInfo });
          this.emit('editing-started', {
            itemId,
            itemType: editInfo.itemType,
            userId: editInfo.userId,
          });
        }
      });

      // 중지된 편집 감지
      Object.entries(previousEditingData).forEach(([itemId, editInfo]) => {
        if (!currentEditingData[itemId] && editInfo.userId !== this.userId) {
          console.log('🔥 Firebase editing stopped:', { itemId, editInfo });
          this.emit('editing-stopped', {
            itemId,
            itemType: editInfo.itemType,
            userId: editInfo.userId,
          });
        }
      });

      // 이전 상태 업데이트
      previousEditingData = { ...currentEditingData };
    });
  }

  // 세션 유효성 검사
  async validateSession(code: string): Promise<boolean> {
    try {
      const sessionRef = ref(database, `sessions/${code}`);

      return new Promise(resolve => {
        onValue(
          sessionRef,
          snapshot => {
            resolve(snapshot.exists());
          },
          { onlyOnce: true }
        );
      });
    } catch (error) {
      console.error('Failed to validate Firebase session:', error);
      return false;
    }
  }

  // 스티키 노트 업데이트
  updateStickyNote(note: StickyNoteUpdate) {
    if (!this.currentSession) {
      console.warn('⚠️ No active session - skipping Firebase sync for sticky note update');
      return;
    }

    try {
      const noteRef = ref(database, `sessions/${this.currentSession.code}/notes/${note.id}`);
      const noteData = {
        ...note,
        author: this.userId,
        timestamp: serverTimestamp(),
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
  updateConnection(connection: FirebaseConnection) {
    if (!this.currentSession) return;

    try {
      const connectionRef = ref(
        database,
        `sessions/${this.currentSession.code}/connections/${connection.id}`
      );
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
      const connectionRef = ref(
        database,
        `sessions/${this.currentSession.code}/connections/${connectionId}`
      );
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
    if (!this.currentSession) {
      console.log('⚠️ No session - editing locally only');
      return;
    }

    try {
      const editingRef = ref(database, `sessions/${this.currentSession.code}/editing/${itemId}`);
      set(editingRef, {
        userId: this.userId,
        itemType,
        startedAt: serverTimestamp(),
      });

      console.log('🔥 Firebase editing started:', itemId);
    } catch (error) {
      console.error('❌ Failed to start Firebase editing:', error);
    }
  }

  // 편집 완료 알림
  stopEditing(itemId: string, _itemType?: 'note' | 'connection') {
    if (!this.currentSession) {
      console.log('⚠️ No session - edited locally only');
      return;
    }

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

  // 세션 이름 업데이트
  async updateSessionName(sessionCode: string, newName: string): Promise<void> {
    if (!newName.trim()) {
      throw new Error('세션 이름은 비어있을 수 없습니다.');
    }
    
    try {
      const nameRef = ref(database, `sessions/${sessionCode}/name`);
      const lastActivityRef = ref(database, `sessions/${sessionCode}/lastActivity`);
      
      await set(nameRef, newName.trim());
      await set(lastActivityRef, serverTimestamp());
      
      this.emit('session-name-updated', { code: sessionCode, name: newName });
      console.log(`🔥 Session name updated: ${sessionCode} -> ${newName}`);
    } catch (error) {
      console.error('❌ Failed to update session name:', error);
      throw new Error('세션 이름 변경에 실패했습니다.');
    }
  }

  // 활성 세션 목록 조회
  async getActiveSessions(limitCount: number = 10): Promise<SessionMetadata[]> {
    const sessionsRef = ref(database, 'sessions');
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    
    return new Promise((resolve) => {
      onValue(sessionsRef, (snapshot) => {
        if (!snapshot.exists()) {
          resolve([]);
          return;
        }
        
        const sessions = snapshot.val() as Record<string, FirebaseSessionData>;
        const activeSessions = Object.values(sessions)
          .filter((s) => {
            const activity = typeof s.lastActivity === 'number' ? s.lastActivity : (typeof s.createdAt === 'number' ? s.createdAt : 0);
            return activity > twoHoursAgo;
          })
          .sort((a, b) => {
            const aActivity = typeof a.lastActivity === 'number' ? a.lastActivity : (typeof a.createdAt === 'number' ? a.createdAt : 0);
            const bActivity = typeof b.lastActivity === 'number' ? b.lastActivity : (typeof b.createdAt === 'number' ? b.createdAt : 0);
            return bActivity - aActivity;
          })
          .slice(0, limitCount)
          .map((s): SessionMetadata => ({
            code: s.code,
            name: s.name || s.code,
            type: s.type || 'workshop',
            userCount: s.userCount || 0,
            createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
            lastActivity: typeof s.lastActivity === 'number' ? s.lastActivity : (typeof s.createdAt === 'number' ? s.createdAt : Date.now())
          }));
        
        resolve(activeSessions);
      }, { onlyOnce: true });
    });
  }

  // 활성 세션 목록 실시간 감시
  onActiveSessions(
    callback: (sessions: SessionMetadata[]) => void,
    limitCount: number = 10
  ): () => void {
    const sessionsRef = ref(database, 'sessions');
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const sessions = snapshot.val() as Record<string, FirebaseSessionData>;
      const activeSessions = Object.values(sessions)
        .filter((s) => {
          const activity = typeof s.lastActivity === 'number' ? s.lastActivity : (typeof s.createdAt === 'number' ? s.createdAt : 0);
          return activity > twoHoursAgo;
        })
        .sort((a, b) => {
          const aActivity = typeof a.lastActivity === 'number' ? a.lastActivity : (typeof a.createdAt === 'number' ? a.createdAt : 0);
          const bActivity = typeof b.lastActivity === 'number' ? b.lastActivity : (typeof b.createdAt === 'number' ? b.createdAt : 0);
          return bActivity - aActivity;
        })
        .slice(0, limitCount)
        .map((s): SessionMetadata => ({
          code: s.code,
          name: s.name || s.code,
          type: s.type || 'workshop',
          userCount: s.userCount || 0,
          createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
          lastActivity: typeof s.lastActivity === 'number' ? s.lastActivity : (typeof s.createdAt === 'number' ? s.createdAt : Date.now())
        }));
      
      callback(activeSessions);
    });

    // cleanup 함수 반환
    return () => off(sessionsRef, 'value', unsubscribe);
  }

  // 연결 해제
  disconnect() {
    if (this.currentSession) {
      const sessionCode = this.currentSession.code;

      // 🔑 세션 종료 시 Gateway 비밀번호 삭제
      if (sessionCode) {
        gatewayAdminService
          .deletePasswordBySessionCode(sessionCode)
          .then(() => {
            console.log(`🗑️ Gateway password deleted for session: ${sessionCode}`);
          })
          .catch((error) => {
            console.error('⚠️ Failed to delete gateway password:', error);
          });
      }

      // 모든 Firebase 리스너 해제
      Object.values(this.firebaseRefs).forEach((ref) => {
        off(ref);
      });

      this.firebaseRefs = {};
      this.currentSession = null;

      console.log('🔥 Firebase disconnected');
    }
  }

  // 관리자용: 특정 세션 삭제
  async deleteSession(code: string): Promise<void> {
    try {
      const sessionRef = ref(database, `sessions/${code}`);
      await remove(sessionRef);
      
      // Gateway 비밀번호도 삭제
      await gatewayAdminService.deletePasswordBySessionCode(code);
      
      console.log(`🗑️ Session deleted: ${code}`);
    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      throw error;
    }
  }
}

export default new FirebaseMultiUserService();
