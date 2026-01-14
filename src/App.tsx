import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import Gateway from './components/Gateway';
import type { PasswordType } from './services/GatewayAdminService';
import SessionManager from './components/SessionManager';
import CultureMapFlow from './components/CultureMapFlow';
import VideoSplash from './components/VideoSplash';
import liveblocksService from './services/LiveblocksService';
import aiService from './services/AIService';

import type { ConnectionData, NoteData, NoteType } from './types/culture';
import type { StickyNoteData, ConnectionData as LBConnectionData } from './types/liveblocks';

import './App.css';

const TOP_LAYER = 4;
const TOP_LAYER_MIN = 1;

type AppNote = NoteData & {
  content?: string;
};

type Sentiment = NoteData['sentiment'];

const NOTE_TYPE_TO_REMOTE: Record<NoteType, string> = {
  결과: 'result',
  행동: 'behavior',
  유형_레버: 'tangible_lever',
  무형_레버: 'intangible_lever',
  insight: 'behavior',
};

const REMOTE_TYPE_TO_NOTE: Record<string, NoteType> = {
  result: '결과',
  behavior: '행동',
  tangible_lever: '유형_레버',
  intangible_lever: '무형_레버',
};

const isSentiment = (value: unknown): value is Sentiment =>
  value === 'positive' || value === 'negative' || value === 'neutral';

const toNoteType = (remoteType?: string): NoteType =>
  REMOTE_TYPE_TO_NOTE[remoteType ?? ''] ?? '행동';

const toRemoteType = (noteType: NoteType): string => NOTE_TYPE_TO_REMOTE[noteType];

const mapLiveblocksNoteToAppNote = (note: StickyNoteData): AppNote => {
  const text = note.content ?? '';
  const sentiment = isSentiment(note.color) ? note.color : 'neutral';
  const layer =
    note.layer >= TOP_LAYER_MIN && note.layer <= TOP_LAYER
      ? (note.layer as NoteData['layer'])
      : (TOP_LAYER_MIN as NoteData['layer']);

  return {
    id: note.id,
    text,
    content: text,
    position: { x: note.x, y: note.y },
    width: note.width ?? 200,
    height: note.height ?? 120,
    type: toNoteType(note.type),
    sentiment,
    layer,
    perceptionIntensity: note.frequency,
    basis: note.basis ? `${note.basis.author} (${note.basis.year}): ${note.basis.theory}` : undefined,
  };
};

function App() {
  const [, setNotes] = useState<AppNote[]>([]);
  const [, setConnections] = useState<ConnectionData[]>([]);
  const [showVideoSplash, setShowVideoSplash] = useState(import.meta.env.VITE_SKIP_GATE !== 'true');
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [pendingSessionCode, setPendingSessionCode] = useState<string | undefined>();
  const [passwordType, setPasswordType] = useState<PasswordType>('workshop');
  const [isAdmin, setIsAdmin] = useState(import.meta.env.VITE_SKIP_GATE === 'true');
  const [isLiveblocksInitialized, setIsLiveblocksInitialized] = useState(false);

  // AI 서비스 초기화 (BYOK)
  useEffect(() => {
    aiService.initializeFromStorage();
  }, []);

  // Liveblocks 초기화
  useEffect(() => {
    const publicKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;
    if (publicKey && !isLiveblocksInitialized) {
      liveblocksService.initialize(publicKey);
      setIsLiveblocksInitialized(true);
      console.log('🔗 Liveblocks 초기화 완료');
    }
  }, [isLiveblocksInitialized]);

  // VideoSplash 완료 처리
  const handleSplashComplete = () => {
    setShowVideoSplash(false);
  };

  // Gateway 인증 완료 시 처리
  const handleAuthenticated = useCallback(async (isAdmin: boolean, sessionCode?: string, passwordType?: PasswordType) => {
    console.log('Gateway authenticated, admin:', isAdmin, 'sessionCode:', sessionCode, 'passwordType:', passwordType);

    // passwordType 저장
    setPasswordType(passwordType || 'workshop');

    // 관리자 상태 저장
    setIsAdmin(isAdmin);

    // 관리자는 세션 관리자를 표시하지 않음 (AdminGateway에서 직접 처리)
    if (isAdmin) {
      console.log('✅ Admin authenticated - no session creation needed');
      setShowSessionManager(false);
      return;
    }

    if (sessionCode) {
      // 세션 코드가 있으면 바로 해당 세션에 참가
      setPendingSessionCode(sessionCode);
      try {
        await liveblocksService.joinSession(sessionCode, false);
        setShowSessionManager(false);
      } catch (error) {
        console.error('❌ 세션 참가 실패:', error);
        setShowSessionManager(true);
      }
    } else {
      // 일반 비밀번호로 로그인한 경우 세션 관리자 표시
      setShowSessionManager(true);
    }
  }, []);

  // 세션 선택 완료 시 처리
  const handleSessionJoined = useCallback(() => {
    setShowSessionManager(false);
    setPendingSessionCode(undefined);
  }, []);

  // 기존 세션 확인
  useEffect(() => {
    const existingSession = liveblocksService.getCurrentSession();
    if (existingSession) {
      console.log('Existing session found:', existingSession);
    }
  }, []);

  // 관리자 상태 변경 시 SessionManager 강제 숨김
  useEffect(() => {
    if (isAdmin) {
      console.log('🔧 Admin detected - forcing SessionManager to hide');
      setShowSessionManager(false);
    }
  }, [isAdmin]);

  // Liveblocks 이벤트 리스너
  useEffect(() => {
    const handleNoteUpdated = (note: unknown) => {
      const normalized = mapLiveblocksNoteToAppNote(note as StickyNoteData);
      setNotes(prev => {
        const index = prev.findIndex(item => item.id === normalized.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = { ...prev[index], ...normalized };
          return next;
        }
        return [...prev, normalized];
      });
    };

    const handleNoteDeleted = () => {
      // 노드 삭제 시 전체 목록 새로고침
      const allNotes = liveblocksService.getStickyNotes();
      setNotes(allNotes.map(mapLiveblocksNoteToAppNote));
    };

    const handleConnectionUpdated = (connection: unknown) => {
      const conn = connection as LBConnectionData;
      setConnections(prev => {
        const index = prev.findIndex(item => item.id === conn.id);
        const mapped: ConnectionData = {
          id: conn.id,
          sourceId: conn.sourceId,
          targetId: conn.targetId,
          relationType: conn.relationType as 'direct' | 'indirect',
          isPositive: !!conn.isPositive,
        };
        if (index >= 0) {
          const next = [...prev];
          next[index] = { ...prev[index], ...mapped };
          return next;
        }
        return [...prev, mapped];
      });
    };

    const handleConnectionDeleted = () => {
      // 연결선 삭제 시 전체 목록 새로고침
      const allConnections = liveblocksService.getConnections();
      setConnections(allConnections.map(conn => ({
        id: conn.id,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        relationType: conn.relationType as 'direct' | 'indirect',
        isPositive: !!conn.isPositive,
      })));
    };

    liveblocksService.on('note-updated', handleNoteUpdated);
    liveblocksService.on('note-deleted', handleNoteDeleted);
    liveblocksService.on('connection-updated', handleConnectionUpdated);
    liveblocksService.on('connection-deleted', handleConnectionDeleted);

    return () => {
      liveblocksService.off('note-updated', handleNoteUpdated);
      liveblocksService.off('note-deleted', handleNoteDeleted);
      liveblocksService.off('connection-updated', handleConnectionUpdated);
      liveblocksService.off('connection-deleted', handleConnectionDeleted);
    };
  }, []);

  const handleNodeUpdate = useCallback((id: string, content: string) => {
    let updatedNote: AppNote | undefined;

    setNotes(prev =>
      prev.map(note => {
        if (note.id !== id) {
          return note;
        }
        updatedNote = { ...note, text: content, content };
        return updatedNote;
      })
    );

    if (!updatedNote) {
      return;
    }

    liveblocksService.updateStickyNote({
      id: updatedNote.id,
      content,
      x: updatedNote.position.x,
      y: updatedNote.position.y,
      layer: updatedNote.layer,
      color: updatedNote.sentiment,
      type: toRemoteType(updatedNote.type),
      width: updatedNote.width,
      height: updatedNote.height,
    });
  }, []);

  const handleNotesChange = useCallback((updatedNotes: NoteData[]) => {
    setNotes(prev => {
      const previousMap = new Map(prev.map(note => [note.id, note]));
      return updatedNotes.map(note => {
        const existing = previousMap.get(note.id);
        return {
          ...(existing ?? {}),
          ...note,
          text: note.text,
          content: note.text,
        };
      });
    });
  }, []);

  const handleConnectionsChange = useCallback((updatedConnections: ConnectionData[]) => {
    setConnections(updatedConnections.map(connection => ({ ...connection })));
  }, []);

  return (
    <>
      {/* VideoSplash 화면 */}
      {showVideoSplash && <VideoSplash onComplete={handleSplashComplete} />}

      {/* 메인 앱 */}
      {!showVideoSplash && (
        <Gateway onAuthenticated={handleAuthenticated}>
          <Router>
            {/* 세션 관리자 모달 - 관리자가 아닐 때만 표시 */}
            {!isAdmin && (
              <SessionManager
                showModal={showSessionManager}
                onClose={handleSessionJoined}
                initialSessionCode={pendingSessionCode}
                passwordType={passwordType}
              />
            )}

            <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CultureMapFlow
                onNotesChange={handleNotesChange}
                onConnectionsChange={handleConnectionsChange}
                onNodeUpdate={handleNodeUpdate}
              />
            </div>
          </Router>
        </Gateway>
      )}
    </>
  );
}

export default App;
