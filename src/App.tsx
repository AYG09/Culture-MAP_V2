import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import CultureMapFlow from './components/CultureMapFlow';
import CultureDashboard from './components/CultureDashboard';
import WelcomeModal from './components/WelcomeModal';
import FirebaseMultiUserService from './services/FirebaseMultiUserService';

import type { CultureProject, ConnectionData, NoteData, NoteType } from './types/culture';

import './App.css';

const TOP_LAYER = 4;
const TOP_LAYER_MIN = 1;

type AppMode = 'culture_map' | 'culture_analysis';

type AppNote = NoteData & {
  content?: string;
};

interface FirebaseStickyNoteUpdate {
  id: string;
  content?: string;
  text?: string;
  x: number;
  y: number;
  layer: number;
  color?: string;
  type?: string;
  width?: number;
  height?: number;
  concept?: NoteData['perceptionIntensity'];
  basis?: string | { author?: string; year?: number; theory?: string };
}

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

const normalizeBasis = (
  basis: FirebaseStickyNoteUpdate['basis']
): string | undefined => {
  if (!basis) {
    return undefined;
  }

  if (typeof basis === 'string') {
    return basis;
  }

  const parts: string[] = [];

  if (basis.author) {
    parts.push(`저자: ${basis.author}`);
  }
  if (basis.theory) {
    parts.push(`이론: ${basis.theory}`);
  }
  if (basis.year) {
    parts.push(`연도: ${basis.year}`);
  }

  return parts.length > 0 ? parts.join(', ') : undefined;
};

const mapFirebaseNoteToAppNote = (note: FirebaseStickyNoteUpdate): AppNote => {
  const text = note.content ?? note.text ?? '';
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
    perceptionIntensity: note.concept,
    basis: normalizeBasis(note.basis),
  };
};

function App() {
  const [appMode, setAppMode] = useState<AppMode>('culture_map');
  const [selectedProject, setSelectedProject] = useState<CultureProject | null>(null);
  const [, setNotes] = useState<AppNote[]>([]);
  const [, setConnections] = useState<ConnectionData[]>([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      const existingSession = FirebaseMultiUserService.getCurrentSession();
      if (existingSession) {
        return;
      }

      try {
        const code = await FirebaseMultiUserService.createSession();
        FirebaseMultiUserService.joinSession(code, true);
      } catch (error) {
        console.error('Failed to create auto session', error);
      }
    };

    initializeSession();
  }, []);

  useEffect(() => {
    const handleStickyNoteUpdated = (note: FirebaseStickyNoteUpdate) => {
      const normalized = mapFirebaseNoteToAppNote(note);
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

    const handleStickyNoteDeleted = (data: { noteId: string }) => {
      setNotes(prev => prev.filter(note => note.id !== data.noteId));
      setConnections(prev =>
        prev.filter(connection =>
          connection.sourceId !== data.noteId && connection.targetId !== data.noteId
        )
      );
    };

    const handleConnectionUpdated = (connection: ConnectionData) => {
      setConnections(prev => {
        const index = prev.findIndex(item => item.id === connection.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = { ...prev[index], ...connection };
          return next;
        }
        return [...prev, connection];
      });
    };

    const handleConnectionDeleted = (data: { connectionId: string }) => {
      setConnections(prev => prev.filter(connection => connection.id !== data.connectionId));
    };

    type EventHandler = (...args: unknown[]) => void;

    FirebaseMultiUserService.on(
      'sticky-note-updated',
      handleStickyNoteUpdated as EventHandler
    );
    FirebaseMultiUserService.on(
      'sticky-note-deleted',
      handleStickyNoteDeleted as EventHandler
    );
    FirebaseMultiUserService.on(
      'connection-updated',
      handleConnectionUpdated as EventHandler
    );
    FirebaseMultiUserService.on(
      'connection-deleted',
      handleConnectionDeleted as EventHandler
    );

    return () => {
      FirebaseMultiUserService.off(
        'sticky-note-updated',
        handleStickyNoteUpdated as EventHandler
      );
      FirebaseMultiUserService.off(
        'sticky-note-deleted',
        handleStickyNoteDeleted as EventHandler
      );
      FirebaseMultiUserService.off(
        'connection-updated',
        handleConnectionUpdated as EventHandler
      );
      FirebaseMultiUserService.off(
        'connection-deleted',
        handleConnectionDeleted as EventHandler
      );
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

    FirebaseMultiUserService.updateStickyNote({
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

  const handleProjectSelect = useCallback((project: CultureProject) => {
    setSelectedProject(project);
    setAppMode('culture_analysis');
  }, []);

  const handleBackToCultureMap = useCallback(() => {
    setSelectedProject(null);
    setAppMode('culture_map');
  }, []);

  return (
    <Router>
      <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {appMode === 'culture_analysis' ? (
          <div className="culture-analysis-container">
            <div className="analysis-header">
              <button className="back-to-map-btn" onClick={handleBackToCultureMap}>
                ← 컬처맵으로 돌아가기
              </button>
              {selectedProject && <h1>조직문화 분석: {selectedProject.name}</h1>}
            </div>
            <CultureDashboard onSelectProject={handleProjectSelect} />
          </div>
        ) : (
          <CultureMapFlow
            onNotesChange={handleNotesChange}
            onConnectionsChange={handleConnectionsChange}
            onNodeUpdate={handleNodeUpdate}
          />
        )}

        <WelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
      </div>
    </Router>
  );
}

export default App;
