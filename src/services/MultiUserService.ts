import { io, Socket } from 'socket.io-client';

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

class MultiUserService {
  private socket: Socket | null = null;
  private currentSession: MultiUserSession | null = null;
  private listeners: { [event: string]: Array<(...args: unknown[]) => void> } = {};

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    // 현재 페이지의 호스트를 기반으로 Socket.IO 서버 URL 생성
    const currentHost = window.location.hostname;
    const socketPort = 54321; // Socket.IO 서버 포트
    const serverUrl = `http://${currentHost}:${socketPort}`;

    console.log('🔌 Connecting to Socket.IO server:', serverUrl);
    this.socket = io(serverUrl);

    this.socket.on('connect', () => {
      console.log('✅ Connected to multi-user server:', serverUrl);
    });

    this.socket.on('disconnect', () => {
      console.log('🔥 Disconnected from multi-user server');
    });

    this.socket.on('connect_error', error => {
      console.error('❌ Socket.IO connection error:', error);
      console.log('💡 Make sure the server is running on:', serverUrl);
    });

    this.socket.on('error', (error: unknown) => {
      console.error('❌ Multi-user service error:', error);
      this.emit('error', error);
    });

    // 세션 데이터 수신
    this.socket.on('session-data', (data: unknown) => {
      this.emit('session-data', data);
    });

    // 스티키 노트 업데이트 수신
    this.socket.on('sticky-note-updated', (note: StickyNoteUpdate) => {
      this.emit('sticky-note-updated', note);
    });

    // 스티키 노트 삭제 수신
    this.socket.on('sticky-note-deleted', (data: { noteId: string }) => {
      this.emit('sticky-note-deleted', data);
    });

    // 프로젝트 데이터 동기화 수신
    this.socket.on('project-data-synced', (data: unknown) => {
      this.emit('project-data-synced', data);
    });

    // 분석 데이터 업데이트 수신
    this.socket.on('analysis-data-updated', (data: unknown) => {
      this.emit('analysis-data-updated', data);
    });

    // 워크샵 데이터 업데이트 수신
    this.socket.on('workshop-data-updated', (data: unknown) => {
      this.emit('workshop-data-updated', data);
    });

    // 층위 상태 업데이트 수신
    this.socket.on('layer-state-updated', (layerState: unknown) => {
      this.emit('layer-state-updated', layerState);
    });

    // 연결선 업데이트 수신
    this.socket.on('connection-updated', (connection: unknown) => {
      this.emit('connection-updated', connection);
    });

    // 연결선 삭제 수신
    this.socket.on('connection-deleted', (data: { connectionId: string }) => {
      this.emit('connection-deleted', data);
    });

    // 편집 상태 이벤트 수신
    this.socket.on(
      'editing-started',
      (data: { itemId: string; itemType: string; userId: string }) => {
        this.emit('editing-started', data);
      }
    );

    this.socket.on(
      'editing-stopped',
      (data: { itemId: string; itemType: string; userId: string }) => {
        this.emit('editing-stopped', data);
      }
    );

    // 사용자 입장/퇴장
    this.socket.on('user-joined', (data: { userId: string; userCount: number }) => {
      if (this.currentSession) {
        this.currentSession.connectedUsers = data.userCount;
      }
      this.emit('user-joined', data);
    });

    this.socket.on('user-left', (data: { userId: string; userCount: number }) => {
      if (this.currentSession) {
        this.currentSession.connectedUsers = data.userCount;
      }
      this.emit('user-left', data);
    });
  }

  // 이벤트 리스너 등록
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

  // 세션 생성
  async createSession(): Promise<string> {
    try {
      const response = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.code;
    } catch (error) {
      console.error('Failed to create session:', error);
      if (error instanceof TypeError || error.message.includes('Failed to fetch')) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행중인지 확인해주세요.');
      }
      throw error;
    }
  }

  // 세션 참가
  joinSession(code: string, isHost: boolean = false) {
    if (!this.socket) return;

    this.currentSession = {
      code,
      isHost,
      connectedUsers: 1,
    };

    this.socket.emit('join-session', code);
  }

  // 세션 유효성 검사
  async validateSession(code: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/validate-session/${code}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.valid;
    } catch (error) {
      console.error('Failed to validate session:', error);
      if (error instanceof TypeError || error.message.includes('Failed to fetch')) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행중인지 확인해주세요.');
      }
      return false;
    }
  }

  // 스티키 노트 업데이트
  updateStickyNote(note: StickyNoteUpdate) {
    if (!this.socket) {
      console.error('❌ Socket not connected - cannot update sticky note');
      return;
    }
    if (!this.currentSession) {
      console.error('❌ No active session - cannot update sticky note');
      return;
    }

    const updateData = {
      code: this.currentSession.code,
      note: {
        ...note,
        author: this.socket.id,
        timestamp: Date.now(),
      },
    };

    console.log('📤 Sending sticky note update:', {
      sessionCode: this.currentSession.code,
      noteId: note.id,
      connected: this.socket.connected,
      content: note.content?.substring(0, 20) + '...',
    });

    this.socket.emit('update-sticky-note', updateData);
  }

  // 스티키 노트 삭제
  deleteStickyNote(noteId: string) {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('delete-sticky-note', {
      code: this.currentSession.code,
      noteId,
    });
  }

  // 연결선 업데이트
  updateConnection(connection: unknown) {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('update-connection', {
      code: this.currentSession.code,
      connection,
    });
  }

  // 연결선 삭제
  deleteConnection(connectionId: string) {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('delete-connection', {
      code: this.currentSession.code,
      connectionId,
    });
  }

  // 프로젝트 데이터 동기화
  syncProjectData(projectData: unknown) {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('sync-project-data', {
      code: this.currentSession.code,
      projectData,
    });
  }

  // 분석 데이터 업데이트
  updateAnalysisData(analysisData: unknown) {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('update-analysis-data', {
      code: this.currentSession.code,
      analysisData,
    });
  }

  // 워크샵 데이터 업데이트
  updateWorkshopData(workshopData: unknown) {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('update-workshop-data', {
      code: this.currentSession.code,
      workshopData,
    });
  }

  // 편집 시작 알림
  startEditing(itemId: string, itemType: 'note' | 'connection') {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('start-editing', {
      code: this.currentSession.code,
      itemId,
      itemType,
    });
  }

  // 편집 완료 알림
  stopEditing(itemId: string, itemType: 'note' | 'connection') {
    if (!this.socket || !this.currentSession) return;

    this.socket.emit('stop-editing', {
      code: this.currentSession.code,
      itemId,
      itemType,
    });
  }

  // 층위 상태 동기화
  updateLayerState(layerState: unknown) {
    if (!this.socket || !this.currentSession) return;

    console.log('📏 [MultiUserService] Sending layer state update:', layerState);
    this.socket.emit('update-layer-state', {
      code: this.currentSession.code,
      layerState,
    });
  }

  // 현재 세션 정보 가져오기
  getCurrentSession(): MultiUserSession | null {
    return this.currentSession;
  }

  // 현재 사용자 ID 가져오기
  getCurrentUserId(): string | null {
    return this.socket?.id || null;
  }

  // 연결 상태 확인
  isConnected(): boolean {
    const connected = this.socket?.connected || false;
    console.log('🔍 Connection status:', {
      socketExists: !!this.socket,
      connected: connected,
      hasSession: !!this.currentSession,
      sessionCode: this.currentSession?.code,
    });
    return connected;
  }

  // 연결 해제
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.currentSession = null;
    }
  }
}

export default new MultiUserService();
