import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import liveblocksService from './services/LiveblocksService';
import aiService from './services/AIService';
import LiveblocksRoomProvider from './components/LiveblocksRoomProvider';

const Gateway = lazy(() => import('./components/Gateway'));
const CultureMapFlow = lazy(() => import('./components/CultureMapFlow'));
const VideoSplash = lazy(() => import('./components/VideoSplash'));

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

const shouldSkipGate = (): boolean => {
  if (import.meta.env.VITE_SKIP_GATE === 'true') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('skipGate') === 'true';
};

const mapLiveblocksNoteToAppNote = (note: StickyNoteData): AppNote => {
  const content = note.content ?? '';
  const sentiment = isSentiment(note.sentiment) ? note.sentiment : 'neutral';
  const layer =
    note.layer >= TOP_LAYER_MIN && note.layer <= TOP_LAYER
      ? (note.layer as NoteData['layer'])
      : (TOP_LAYER_MIN as NoteData['layer']);

  return {
    id: note.id,
    content,
    position: { x: note.x, y: note.y },
    width: note.width ?? 200,
    height: note.height ?? 120,
    type: toNoteType(note.type),
    sentiment,
    layer,
    perceptionIntensity: note.frequency,
    basis: note.basis, // 이미 string 타입
    pinned: note.pinned === true,
    pinnedHandles: note.pinnedHandles === true,
  };
};

function App() {
  const [, setNotes] = useState<AppNote[]>([]);
  const [, setConnections] = useState<ConnectionData[]>([]);
  const [showVideoSplash, setShowVideoSplash] = useState(() => !shouldSkipGate());
  const [isLiveblocksInitialized, setIsLiveblocksInitialized] = useState(false);
  const [currentSessionCode, setCurrentSessionCode] = useState<string | null>(null);

  // AI 서비스 초기화 (BYOK)
  useEffect(() => {
    aiService.initializeFromStorage();
  }, []);

  // Liveblocks 초기화 (세션 연결은 Gateway에서 처리)
  useEffect(() => {
    if (!isLiveblocksInitialized) {
      liveblocksService.initialize();
      setIsLiveblocksInitialized(true);
      console.log('🔗 Liveblocks 초기화 완료');
    }
  }, [isLiveblocksInitialized]);

  // VideoSplash 완료 처리
  const handleSplashComplete = () => {
    setShowVideoSplash(false);
  };

  // Gateway에서 세션 입장 시 처리 (새 인터페이스: sessionCode만 받음)
  const handleAuthenticated = useCallback((sessionCode: string) => {
    console.log('✅ 세션 입장 완료:', sessionCode);
    setCurrentSessionCode(sessionCode);
    // Gateway에서 이미 liveblocksService.joinSession() 호출했으므로
    // 여기서는 추가 작업 필요 없음
  }, []);

  // 기존 세션 확인
  useEffect(() => {
    const existingSession = liveblocksService.getCurrentSession();
    if (existingSession) {
      console.log('📍 기존 세션 감지:', existingSession);
      setCurrentSessionCode(existingSession.code);
    }
  }, []);

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

    // IndexedDB 동기화 완료 시 초기 데이터 로드
    const handleSyncComplete = () => {
      console.log('📥 [App] Liveblocks IndexedDB 동기화 완료 - 초기 데이터 로드');
      const allNotes = liveblocksService.getStickyNotes();
      const allConnections = liveblocksService.getConnections();
      setNotes(allNotes.map(mapLiveblocksNoteToAppNote));
      setConnections(allConnections.map(conn => ({
        id: conn.id,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        relationType: conn.relationType as 'direct' | 'indirect',
        isPositive: !!conn.isPositive,
      })));
    };

    liveblocksService.on('sticky-note-updated', handleNoteUpdated);
    liveblocksService.on('sticky-note-deleted', handleNoteDeleted);
    liveblocksService.on('connection-updated', handleConnectionUpdated);
    liveblocksService.on('connection-deleted', handleConnectionDeleted);
    liveblocksService.on('sync-complete', handleSyncComplete);

    return () => {
      liveblocksService.off('sticky-note-updated', handleNoteUpdated);
      liveblocksService.off('sticky-note-deleted', handleNoteDeleted);
      liveblocksService.off('connection-updated', handleConnectionUpdated);
      liveblocksService.off('connection-deleted', handleConnectionDeleted);
      liveblocksService.off('sync-complete', handleSyncComplete);
    };
  }, []);

  const handleNodeUpdate = useCallback((id: string, content: string) => {
    let updatedNote: AppNote | undefined;

    setNotes(prev =>
      prev.map(note => {
        if (note.id !== id) {
          return note;
        }
        updatedNote = { ...note, content };
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
      sentiment: updatedNote.sentiment,
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
          content: note.content,
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
      {showVideoSplash && (
        <Suspense fallback={<div className="app-loading-fallback">인트로 영상을 준비하는 중...</div>}>
          <VideoSplash onComplete={handleSplashComplete} />
        </Suspense>
      )}

      {/* 메인 앱 */}
      {!showVideoSplash && (
        <Suspense fallback={<div className="app-loading-fallback">협업 화면을 준비하는 중...</div>}>
          <Gateway onAuthenticated={handleAuthenticated}>
            <LiveblocksRoomProvider
              sessionCode={currentSessionCode}
              userName={liveblocksService.getCurrentUserDisplayName()}
              userColor={liveblocksService.getCurrentUserColor()}
              userId={liveblocksService.getCurrentUserId()}
              fallback={(
                <div className="app-loading-fallback">
                  실시간 협업 워크스페이스에 연결하는 중...
                  {currentSessionCode ? ` (${currentSessionCode})` : ''}
                </div>
              )}
            >
              <Router>
                <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CultureMapFlow
                    onNotesChange={handleNotesChange}
                    onConnectionsChange={handleConnectionsChange}
                    onNodeUpdate={handleNodeUpdate}
                  />
                </div>
              </Router>
            </LiveblocksRoomProvider>
          </Gateway>
        </Suspense>
      )}
    </>
  );
}

export default App;
