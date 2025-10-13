import { useState, useCallback, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

// 컴포넌트
import { EnhancedCultureMapApp } from './components/EnhancedCultureMapApp';
import CultureMapFlow from './components/CultureMapFlow';
import CultureDashboard from './components/CultureDashboard';
import WelcomeModal from './components/WelcomeModal';

// 멀티유저 서비스
import FirebaseMultiUserService from './services/FirebaseMultiUserService';

// 유틸리티
import { parseAIOutput } from './utils/parser';
import { parseIntelligent } from './utils/intelligentParser';
import { getLayoutedElements } from './utils/layout';

// 타입 및 설정
import type { CultureProject, ConnectionData, NoteData, NoteType } from './types/culture';
import type { Position } from './types';
import type { LayerSystemState, LayerVisualizationOptions } from './types/layerSystem';
import { LAYER_CONFIG } from './types/layerSystem';

// 스타일
import './styles/layerSystem.css';
import './App.css';

type AppMode = 'culture_map' | 'culture_analysis';

const GRID_SIZE = 20;

interface SessionInfo {
  sessionCode: string;
  isHost: boolean;
  connectedUsers: number;
  isConnected: boolean;
  onLeaveSession: () => void;
}

interface AppProps {
  sessionInfo?: SessionInfo | null;
}

function App({ sessionInfo }: AppProps = {}) {
  // =================================================================================
  // 상태 관리 (State Management)
  // =================================================================================

  // 앱 모드 상태
  const [appMode, setAppMode] = useState<AppMode>('culture_map');
  const [selectedProject, setSelectedProject] = useState<CultureProject | null>(null);

  // React Flow 사용 여부 (기본값: React Flow 사용)
  const [useReactFlow, setUseReactFlow] = useState(true);

  // Welcome Modal 상태
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  // 컬처맵 데이터 상태
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);

  // UI 인터랙션 상태
  const [draggingNote, setDraggingNote] = useState<{
    noteId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [resizingNote, setResizingNote] = useState<{
    noteId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [panning, setPanning] = useState<{
    isPanning: boolean;
    startX: number;
    startY: number;
    initialTransformX: number;
    initialTransformY: number;
  } | null>(null);
  const [boardTransform, setBoardTransform] = useState({ x: 0, y: 0 });
  const [wasPanning, setWasPanning] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [multiDragInfo, setMultiDragInfo] = useState<{
    noteId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [connectingNoteId, setConnectingNoteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Array<{ label: string; action: () => void }>;
  } | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [layerControlVisible, setLayerControlVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map');
  const [analysisReportData, setAnalysisReportData] = useState<unknown[]>([]);
  const [resizingLayerIndex, setResizingLayerIndex] = useState<number | null>(null);

  // 멀티유저 편집 상태
  const [editingItems, setEditingItems] = useState<{
    [itemId: string]: { userId: string; itemType: string };
  }>({});

  // 참조
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 자동 세션 생성 (앱 시작 시 한 번만 실행)
  useEffect(() => {
    const initializeSession = async () => {
      // 이미 세션이 있는지 확인
      const existingSession = FirebaseMultiUserService.getCurrentSession();
      if (existingSession) {
        console.log('✅ [Auto-Session] Existing session found:', existingSession.code);
        return;
      }

      try {
        // 자동으로 익명 세션 생성
        const code = await FirebaseMultiUserService.createSession();
        FirebaseMultiUserService.joinSession(code, true);
        console.log('🎉 [Auto-Session] Auto-created session:', code);
      } catch (error) {
        console.error('❌ [Auto-Session] Failed to create session:', error);
      }
    };

    initializeSession();
  }, []); // 빈 의존성 배열 - 마운트 시 한 번만 실행

  // MultiUser 서비스 이벤트 리스너
  useEffect(() => {
    // 다른 사용자의 스티키 노트 업데이트 수신
    const handleStickyNoteUpdated = (note: NoteData) => {
      console.log('📝 Received sticky note update:', {
        id: note.id,
        content: note.content?.substring(0, 30) + '...',
        type: note.type,
        concept: note.concept,
        basis: note.basis,
      });

      // 자신이 보낸 업데이트인지 확인
      const isOwnUpdate = note.authorId === FirebaseMultiUserService.getCurrentUserId();
      console.log(
        '📝 Is own update:',
        isOwnUpdate,
        'authorId:',
        note.authorId,
        'currentUserId:',
        FirebaseMultiUserService.getCurrentUserId()
      );

      // 서버 데이터 형태를 클라이언트 형태로 변환
      const transformedNote = {
        id: note.id,
        content: note.content,
        text: note.content, // content와 text 둘 다 설정
        position: { x: note.x, y: note.y },
        layerIndex: note.layer,
        layer: note.layer,
        sentiment: note.color,
        type: note.type || 'sticky_note', // 서버에서 받은 type 사용
        width: note.width || 200,
        height: note.height || 120,
        concept: note.concept,
        source: note.source,
        category: note.category,
        metadata: note.metadata,
        basis: note.basis, // 이론적 설명 포함
      };

      setNotes(currentNotes => {
        const existingIndex = currentNotes.findIndex(n => n.id === note.id);
        if (existingIndex >= 0) {
          const existingNote = currentNotes[existingIndex];

          // 현재 편집 중인 노트인지 확인
          const isCurrentlyEditing = editingNoteId === note.id;

          // 실제로 변경사항이 있는지 확인
          const hasContentChange = existingNote.content !== transformedNote.content;
          const hasPositionChange =
            existingNote.position.x !== transformedNote.position.x ||
            existingNote.position.y !== transformedNote.position.y;
          const hasOtherChanges =
            existingNote.sentiment !== transformedNote.sentiment ||
            existingNote.width !== transformedNote.width ||
            existingNote.height !== transformedNote.height;

          if (!hasContentChange && !hasPositionChange && !hasOtherChanges) {
            return currentNotes; // 변경사항이 없으면 기존 배열 반환 (리렌더링 방지)
          }

          // 편집 중인 노트의 경우: 다른 사용자의 텍스트 업데이트는 받지 않음 (충돌 방지)
          // 하지만 위치나 기타 변경사항은 반영
          let updatedNote;
          if (isCurrentlyEditing && !isOwnUpdate && hasContentChange) {
            // 편집 중이고 다른 사용자의 텍스트 변경인 경우: 텍스트는 유지, 다른 속성만 업데이트
            console.log(`🚫 [CLIENT] Blocking text update for editing note ${note.id}:`, {
              isCurrentlyEditing,
              isOwnUpdate,
              hasContentChange,
            });
            updatedNote = {
              ...existingNote,
              ...transformedNote,
              content: existingNote.content,
              text: existingNote.text,
            };
          } else {
            // 자신의 업데이트이거나 편집 중이 아닌 경우: 모든 업데이트 반영
            updatedNote = { ...existingNote, ...transformedNote };
          }

          // 기존 노트 업데이트
          return currentNotes.map((n, index) => (index === existingIndex ? updatedNote : n));
        } else {
          // 새 노트 추가
          return [...currentNotes, transformedNote];
        }
      });
    };

    // 다른 사용자의 스티키 노트 삭제 수신
    const handleStickyNoteDeleted = (data: { noteId: string }) => {
      console.log('🗑️ Received sticky note deletion:', data);
      setNotes(currentNotes => currentNotes.filter(n => n.id !== data.noteId));
      setConnections(conns =>
        conns.filter(c => c.sourceId !== data.noteId && c.targetId !== data.noteId)
      );
    };

    // 다른 사용자의 연결선 업데이트 수신
    const handleConnectionUpdated = (connection: ConnectionData) => {
      console.log('🔗 Received connection update:', connection);
      setConnections(currentConnections => {
        const existingIndex = currentConnections.findIndex(c => c.id === connection.id);
        if (existingIndex >= 0) {
          // 기존 연결선 업데이트
          return currentConnections.map((c, index) =>
            index === existingIndex ? { ...c, ...connection } : c
          );
        } else {
          // 새 연결선 추가
          return [...currentConnections, connection];
        }
      });
    };

    // 다른 사용자의 연결선 삭제 수신
    const handleConnectionDeleted = (data: { connectionId: string }) => {
      console.log('🗑️ Received connection deletion:', data);
      setConnections(currentConnections =>
        currentConnections.filter(c => c.id !== data.connectionId)
      );
    };

    // 편집 상태 이벤트 수신
    const handleEditingStarted = (data: { itemId: string; itemType: string; userId: string }) => {
      console.log('✏️ Editing started:', data);
      setEditingItems(prev => ({
        ...prev,
        [data.itemId]: { userId: data.userId, itemType: data.itemType },
      }));
    };

    const handleEditingStopped = (data: { itemId: string; itemType: string; userId: string }) => {
      console.log('✅ Editing stopped:', data);
      setEditingItems(prev => {
        const newEditingItems = { ...prev };
        delete newEditingItems[data.itemId];
        return newEditingItems;
      });
    };

    // 다른 사용자의 층위 상태 업데이트 수신
    const handleLayerStateUpdated = (layerState: {
      totalHeight: number;
      boundaries?: Array<{ layerType: string; height: number }>;
    }) => {
      console.log('📥 [App] Received layer state update from other user:', {
        totalHeight: layerState.totalHeight,
        boundariesCount: layerState.boundaries?.length,
        boundaries: layerState.boundaries?.map(b => ({
          layerType: b.layerType,
          height: b.height,
          yMin: b.yMin,
          yMax: b.yMax,
        })),
      });
      setLayerState(layerState);
    };

    // 이벤트 리스너 등록
    FirebaseMultiUserService.on('sticky-note-updated', handleStickyNoteUpdated);
    FirebaseMultiUserService.on('sticky-note-deleted', handleStickyNoteDeleted);
    FirebaseMultiUserService.on('connection-updated', handleConnectionUpdated);
    FirebaseMultiUserService.on('connection-deleted', handleConnectionDeleted);
    FirebaseMultiUserService.on('editing-started', handleEditingStarted);
    FirebaseMultiUserService.on('editing-stopped', handleEditingStopped);
    FirebaseMultiUserService.on('layer-state-updated', handleLayerStateUpdated);

    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 정리
      FirebaseMultiUserService.off('sticky-note-updated', handleStickyNoteUpdated);
      FirebaseMultiUserService.off('sticky-note-deleted', handleStickyNoteDeleted);
      FirebaseMultiUserService.off('connection-updated', handleConnectionUpdated);
      FirebaseMultiUserService.off('connection-deleted', handleConnectionDeleted);
      FirebaseMultiUserService.off('editing-started', handleEditingStarted);
      FirebaseMultiUserService.off('editing-stopped', handleEditingStopped);
      FirebaseMultiUserService.off('layer-state-updated', handleLayerStateUpdated);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 프로젝트 저장 함수
  const handleSaveProject = useCallback(() => {
    if (notes.length === 0 && connections.length === 0) {
      alert('저장할 데이터가 없습니다.');
      return;
    }

    // 현재 맵 데이터를 JSON으로 저장
    const mapData = {
      notes,
      connections,
      project: selectedProject,
      savedAt: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(mapData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const fileName = selectedProject
      ? `${selectedProject.name}_culture_map.json`
      : `culture_map_${new Date().toISOString().slice(0, 10)}.json`;

    saveAs(dataBlob, fileName);

    // 상태 메시지 표시 (중복 방지)
    const existingMessage = document.querySelector('.save-status-message');
    if (!existingMessage) {
      const message = document.createElement('div');
      message.className = 'save-status-message';
      message.textContent = `컬처맵이 "${fileName}" 파일로 저장되었습니다.`;
      message.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #4CAF50; 
        color: white; 
        padding: 10px 20px; 
        border-radius: 4px; 
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(message);

      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
      }, 3000);
    }
  }, [notes, connections, selectedProject]);

  // =================================================================================
  // 층위 시스템 로직 (단순화 버전)
  // =================================================================================

  const [layerState, setLayerState] = useState<LayerSystemState>(() => {
    const initialLayerHeight = 200; // 초기 높이
    const layerGap = 20;
    const boundaries = Object.entries(LAYER_CONFIG).map(([type, config]) => {
      const yMin = config.index * (initialLayerHeight + layerGap);
      return {
        layerType: type as keyof typeof LAYER_CONFIG,
        layerIndex: config.index,
        yMin: yMin,
        yMax: yMin + initialLayerHeight,
        height: initialLayerHeight,
        isVisible: true,
        color: config.color,
        opacity: 0.1,
      };
    });

    const totalHeight =
      boundaries.reduce((acc, boundary) => acc + boundary.height + layerGap, 0) - layerGap;

    return {
      boundaries,
      snapEnabled: false,
      autoRealignEnabled: false,
      validationEnabled: false,
      showLayerGuides: true,
      layerHeight: initialLayerHeight, // 평균 높이 개념으로 유지
      layerGap: layerGap,
      totalHeight: totalHeight,
    };
  });

  const [visualizationOptions, setVisualizationOptions] = useState<LayerVisualizationOptions>({
    showLayerLabels: true,
    showLayerBoundaries: true,
    showLayerIcons: false,
    layerOpacity: 0.1,
    boundaryLineStyle: 'dashed',
    boundaryLineWidth: 1,
    labelPosition: 'left',
    animateTransitions: true,
    transitionDuration: 300,
  });

  const handleLayerHeightChange = useCallback((layerIndex: number, newHeight: number) => {
    console.log(`📏 [App] Layer height change: Layer ${layerIndex}, New height: ${newHeight}`);

    setLayerState(prev => {
      const newBoundaries = [...prev.boundaries];
      const minHeight = 100; // 최소 높이
      const validatedNewHeight = Math.max(minHeight, newHeight);

      // 해당 레이어 높이 변경
      newBoundaries[layerIndex] = {
        ...newBoundaries[layerIndex],
        height: validatedNewHeight,
      };

      // 후속 레이어 위치 재계산
      for (let i = 0; i < newBoundaries.length; i++) {
        const prevYMax = i > 0 ? newBoundaries[i - 1].yMax : -prev.layerGap;
        const yMin = prevYMax + prev.layerGap;
        newBoundaries[i] = {
          ...newBoundaries[i],
          yMin: yMin,
          yMax: yMin + newBoundaries[i].height,
        };
      }

      const newTotalHeight =
        newBoundaries.reduce((acc, boundary) => acc + boundary.height + prev.layerGap, 0) -
        prev.layerGap;

      const newLayerState = {
        ...prev,
        boundaries: newBoundaries,
        totalHeight: newTotalHeight,
      };

      // 다른 사용자들에게 층위 상태 변경 전송
      console.log('📤 [App] Sending layer state to other users via FirebaseMultiUserService');
      FirebaseMultiUserService.updateLayerState(newLayerState);

      return newLayerState;
    });
  }, []);

  // =================================================================================
  // 핸들러 함수 (Event Handlers)
  // =================================================================================

  const handleUpdateNote = useCallback((noteId: string, updates: Partial<NoteData>) => {
    // 로컬 상태 업데이트
    setNotes(currentNotes => {
      const updatedNotes = currentNotes.map(note => {
        if (note.id === noteId) {
          const updatedNote = { ...note, ...updates };

          // 의미있는 변경사항이 있을 때만 MultiUser 서비스로 전송
          const hasContentChange = updates.content !== undefined || updates.text !== undefined;
          const hasPositionChange = updates.position !== undefined;
          const hasSentimentChange = updates.sentiment !== undefined;
          const hasOtherChanges =
            updates.concept !== undefined ||
            updates.source !== undefined ||
            updates.category !== undefined;

          console.log('🔍 [CLIENT] Update analysis:', {
            noteId: noteId,
            updates,
            hasContentChange,
            hasPositionChange,
            hasSentimentChange,
            hasOtherChanges,
            oldContent: note.content,
            newContent: updatedNote.content,
          });

          if (hasContentChange || hasPositionChange || hasSentimentChange || hasOtherChanges) {
            // MultiUser 서비스로 업데이트 전송 (최소 디바운싱)
            setTimeout(() => {
              const updateData = {
                id: updatedNote.id,
                content: updatedNote.content || updatedNote.text,
                x: updatedNote.position.x,
                y: updatedNote.position.y,
                layer: updatedNote.layerIndex || updatedNote.layer,
                color: updatedNote.sentiment || 'neutral',
                type: updatedNote.type,
                width: updatedNote.width,
                height: updatedNote.height,
              };

              console.log('📤 [CLIENT] Sending sticky note update:', {
                id: updateData.id,
                content: updateData.content,
                hasContentChange,
                hasPositionChange,
                hasOtherChanges,
              });

              FirebaseMultiUserService.updateStickyNote(updateData);
            }, 50); // 50ms로 단축
          }

          return updatedNote;
        }
        return note;
      });
      return updatedNotes;
    });

    // 편집 완료 알림 (일반 업데이트용 - 제거됨)
    // FirebaseMultiUserService.stopEditing(noteId, 'note');
    // setEditingNoteId(null);
  }, []);

  // 편집 시작 핸들러
  const handleStartEdit = useCallback((noteId: string) => {
    console.log(`🎯 [App] Start edit for note:`, noteId);
    setEditingNoteId(noteId);
    FirebaseMultiUserService.startEditing(noteId, 'note');
  }, []);

  // 실제 편집 완료 핸들러
  const handleEditComplete = useCallback((noteId: string) => {
    console.log(`🔚 [App] Edit complete for note:`, noteId);
    FirebaseMultiUserService.stopEditing(noteId, 'note');
    setEditingNoteId(null);
  }, []);

  const handleProjectSelect = (project: CultureProject) => {
    setSelectedProject(project);
    setAppMode('culture_analysis');
  };

  const handleBackToCultureMap = () => {
    setAppMode('culture_map');
    setSelectedProject(null);
  };

  const handleMouseDownOnBoard = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('.enhanced-sticky-note') !== null) return;

      if (e.button === 0) {
        const board = boardRef.current;
        const scrollContainer = scrollContainerRef.current;
        if (!board || !scrollContainer) return;

        // 통합된 좌표 계산
        const getCanvasCoords = (clientX: number, clientY: number) => {
          const boardRect = board.getBoundingClientRect();
          const scrollLeft = scrollContainer.scrollLeft;
          const scrollTop = scrollContainer.scrollTop;
          const canvasX = clientX - boardRect.left + scrollLeft - boardTransform.x;
          const canvasY = clientY - boardRect.top + scrollTop - boardTransform.y;
          return { x: canvasX, y: canvasY };
        };

        const { x: startX, y: startY } = getCanvasCoords(e.clientX, e.clientY);
        setSelection({ startX, startY, endX: startX, endY: startY });
        setSelectedNoteIds(new Set());
        return;
      }

      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        const board = boardRef.current;
        if (!board) return;
        setContextMenu(null);
        setPanning({
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY,
          initialTransformX: boardTransform.x,
          initialTransformY: boardTransform.y,
        });
        setWasPanning(true);
        board.style.cursor = 'grabbing';
      }
    },
    [boardTransform]
  );

  const handleMouseDownOnNote = useCallback(
    (noteId: string, e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const note = notes.find(n => n.id === noteId);
      if (!note) {
        e.preventDefault();
        return;
      }

      // 보드와 스크롤 컨테이너를 기준으로 정확한 오프셋 계산
      const board = boardRef.current;
      const scrollContainer = scrollContainerRef.current;
      if (!board || !scrollContainer) return;

      // 통합된 좌표 계산
      const getCanvasCoords = (clientX: number, clientY: number) => {
        const boardRect = board.getBoundingClientRect();
        const scrollLeft = scrollContainer.scrollLeft;
        const scrollTop = scrollContainer.scrollTop;
        const canvasX = clientX - boardRect.left + scrollLeft - boardTransform.x;
        const canvasY = clientY - boardRect.top + scrollTop - boardTransform.y;
        return { x: canvasX, y: canvasY };
      };

      const { x: mouseX, y: mouseY } = getCanvasCoords(e.clientX, e.clientY);
      const offsetX = mouseX - note.position.x;
      const offsetY = mouseY - note.position.y;

      if (selectedNoteIds.has(noteId) && !e.shiftKey) {
        setMultiDragInfo({ noteId, offsetX, offsetY });
        e.currentTarget.style.cursor = 'grabbing';
        return;
      }

      if (e.shiftKey) {
        e.stopPropagation();
        setSelectedNoteIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(noteId)) newSet.delete(noteId);
          else newSet.add(noteId);
          return newSet;
        });
        return;
      }

      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

      setSelectedNoteIds(new Set([noteId]));
      setDraggingNote({ noteId, offsetX, offsetY });
      e.currentTarget.style.cursor = 'grabbing';
    },
    [notes, selectedNoteIds, boardTransform]
  );

  const handleMouseDownOnResizeHandle = useCallback(
    (noteId: string, e: MouseEvent<HTMLDivElement>) => {
      const noteToResize = notes.find(note => note.id === noteId);
      if (!noteToResize) return;
      e.stopPropagation();
      setResizingNote({
        noteId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: noteToResize.width || 200,
        startHeight: noteToResize.height || 120,
      });
    },
    [notes]
  );

  const handleMouseDownOnLayerResizeHandle = useCallback((layerIndex: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingLayerIndex(layerIndex);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement> | globalThis.MouseEvent) => {
      const board = boardRef.current;
      const scrollContainer = scrollContainerRef.current;
      if (!board || !scrollContainer) return;

      if (resizingLayerIndex !== null) {
        const layer = layerState.boundaries[resizingLayerIndex];
        if (!layer) return;

        // Get the mouse position relative to the scroll container's top.
        const scrollRect = scrollContainer.getBoundingClientRect();
        const mouseY = e.clientY - scrollRect.top + scrollContainer.scrollTop;

        const newHeight = mouseY - layer.yMin;
        handleLayerHeightChange(resizingLayerIndex, newHeight);
        return;
      }

      // 통합된 좌표 계산 함수
      const getCanvasCoords = (clientX: number, clientY: number) => {
        const boardRect = board.getBoundingClientRect();
        // const scrollRect = scrollContainer.getBoundingClientRect(); // 미사용

        // 스크롤 오프셋 계산
        const scrollLeft = scrollContainer.scrollLeft;
        const scrollTop = scrollContainer.scrollTop;

        // 마우스 좌표를 캔버스 좌표계로 변환
        const canvasX = clientX - boardRect.left + scrollLeft - boardTransform.x;
        const canvasY = clientY - boardRect.top + scrollTop - boardTransform.y;

        return { x: canvasX, y: canvasY };
      };

      if (selection && !draggingNote && !multiDragInfo) {
        const { x: endX, y: endY } = getCanvasCoords(e.clientX, e.clientY);
        setSelection(prev => (prev ? { ...prev, endX, endY } : null));
        const newSelectedIds = new Set<string>();
        const selRect = {
          x1: Math.min(selection.startX, endX),
          y1: Math.min(selection.startY, endY),
          x2: Math.max(selection.startX, endX),
          y2: Math.max(selection.startY, endY),
        };
        notes.forEach(note => {
          const noteRect = {
            x1: note.position.x,
            y1: note.position.y,
            x2: note.position.x + (note.width || 200),
            y2: note.position.y + (note.height || 120),
          };
          if (
            noteRect.x1 < selRect.x2 &&
            noteRect.x2 > selRect.x1 &&
            noteRect.y1 < selRect.y2 &&
            noteRect.y2 > selRect.y1
          ) {
            newSelectedIds.add(note.id);
          }
        });
        setSelectedNoteIds(newSelectedIds);
        return;
      }

      if (panning?.isPanning) {
        e.preventDefault();
        const dx = e.clientX - panning.startX;
        const dy = e.clientY - panning.startY;
        setBoardTransform({ x: panning.initialTransformX + dx, y: panning.initialTransformY + dy });
        return;
      }

      if (multiDragInfo) {
        const { noteId, offsetX, offsetY } = multiDragInfo;
        const referenceNote = notes.find(n => n.id === noteId);
        if (!referenceNote) return;
        const { x: mouseX, y: mouseY } = getCanvasCoords(e.clientX, e.clientY);
        const newRefX = mouseX - offsetX;
        const newRefY = mouseY - offsetY;
        const dx = newRefX - referenceNote.position.x;
        const dy = newRefY - referenceNote.position.y;
        setNotes(currentNotes =>
          currentNotes.map(n => {
            if (selectedNoteIds.has(n.id)) {
              let newX = n.position.x + dx;
              let newY = n.position.y + dy;
              newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
              newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
              const newPosition = { x: newX, y: newY };
              return { ...n, position: newPosition };
            }
            return n;
          })
        );
        return;
      }

      if (draggingNote) {
        const { x: mouseX, y: mouseY } = getCanvasCoords(e.clientX, e.clientY);
        let x = mouseX - draggingNote.offsetX;
        let y = mouseY - draggingNote.offsetY;
        x = Math.round(x / GRID_SIZE) * GRID_SIZE;
        y = Math.round(y / GRID_SIZE) * GRID_SIZE;
        const newPosition = { x, y };
        setNotes(currentNotes =>
          currentNotes.map(note => {
            if (note.id === draggingNote.noteId) {
              return { ...note, position: newPosition };
            }
            return note;
          })
        );
        return;
      }

      if (resizingNote) {
        const newWidth = resizingNote.startWidth + (e.clientX - resizingNote.startX);
        const newHeight = resizingNote.startHeight + (e.clientY - resizingNote.startY);
        setNotes(currentNotes =>
          currentNotes.map(note =>
            note.id === resizingNote.noteId
              ? { ...note, width: Math.max(150, newWidth), height: Math.max(100, newHeight) }
              : note
          )
        );
      }
    },
    [
      draggingNote,
      resizingNote,
      panning,
      selection,
      notes,
      multiDragInfo,
      selectedNoteIds,
      setNotes,
      setBoardTransform,
      setSelection,
      setSelectedNoteIds,
      resizingLayerIndex,
      layerState.boundaries,
      handleLayerHeightChange,
      boardTransform.x,
      boardTransform.y,
    ]
  );

  const handleMouseUp = useCallback(() => {
    // 드래그가 끝났을 때 위치 동기화
    if (draggingNote) {
      const noteElement = document.getElementById(draggingNote.noteId);
      if (noteElement) noteElement.style.cursor = 'grab';

      // 드래그된 노트의 최종 위치를 다른 사용자들에게 전송
      const draggedNote = notes.find(n => n.id === draggingNote.noteId);
      if (draggedNote) {
        FirebaseMultiUserService.updateStickyNote({
          id: draggedNote.id,
          content: draggedNote.content || draggedNote.text,
          x: draggedNote.position.x,
          y: draggedNote.position.y,
          layer: draggedNote.layerIndex || draggedNote.layer,
          color: draggedNote.sentiment || 'neutral',
          type: draggedNote.type,
          width: draggedNote.width,
          height: draggedNote.height,
        });
      }
    }

    // 리사이즈가 끝났을 때도 동기화
    if (resizingNote) {
      const resizedNote = notes.find(n => n.id === resizingNote.noteId);
      if (resizedNote) {
        FirebaseMultiUserService.updateStickyNote({
          id: resizedNote.id,
          content: resizedNote.content || resizedNote.text,
          x: resizedNote.position.x,
          y: resizedNote.position.y,
          layer: resizedNote.layerIndex || resizedNote.layer,
          color: resizedNote.sentiment || 'neutral',
          type: resizedNote.type,
          width: resizedNote.width,
          height: resizedNote.height,
        });
      }
    }

    if (panning) {
      const board = boardRef.current;
      if (board) board.style.cursor = 'default';
    }
    setDraggingNote(null);
    setResizingNote(null);
    setPanning(null);
    setSelection(null);
    setMultiDragInfo(null);
    setResizingLayerIndex(null);
    setTimeout(() => setWasPanning(false), 100);
  }, [draggingNote, resizingNote, panning, notes]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) =>
      handleMouseMove(e as React.MouseEvent);
    const handleGlobalMouseUp = () => handleMouseUp();
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleConnectStart = useCallback((noteId: string) => setConnectingNoteId(noteId), []);

  const handleUpdateConnection = useCallback((id: string, newType: 'direct' | 'indirect') => {
    // 로컬 상태 업데이트
    setConnections(conns => {
      const updatedConnections = conns.map(c => {
        if (c.id === id) {
          const updatedConnection = { ...c, relationType: newType };
          // MultiUser 서비스로 연결선 업데이트 전송
          FirebaseMultiUserService.updateConnection(updatedConnection);
          return updatedConnection;
        }
        return c;
      });
      return updatedConnections;
    });
  }, []);
  const handleDeleteConnection = useCallback((id: string) => {
    if (window.confirm('이 연결선을 삭제하시겠습니까?')) {
      // 로컬 상태 업데이트
      setConnections(conns => conns.filter(c => c.id !== id));
      // MultiUser 서비스로 연결선 삭제 전송
      FirebaseMultiUserService.deleteConnection(id);
    }
  }, []);
  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const handleNoteContextMenu = useCallback(
    (e: MouseEvent, noteId: string) => {
      e.preventDefault();
      e.stopPropagation();
      handleCloseContextMenu();
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      const sentimentCycle: Record<NoteData['sentiment'], NoteData['sentiment']> = {
        neutral: 'negative',
        negative: 'positive',
        positive: 'neutral',
      };

      const items = [
        {
          label: '편집',
          action: () => {
            console.log(`🖊️ [App] 편집 메뉴 클릭:`, {
              noteId,
              currentEditingNoteId: editingNoteId,
            });
            // 함수형 업데이트를 사용하여 최신 상태를 참조
            setEditingNoteId(prevId => {
              console.log(`📝 [App] 편집 상태 변경:`, { prevId, newId: noteId });
              if (prevId === noteId) {
                // 이미 편집 중인 경우 초기화 후 재설정
                console.log(`🔄 [App] 이미 편집 중이므로 재설정`);
                setTimeout(() => {
                  console.log(`⏰ [App] 편집 상태 재설정 실행`);
                  setEditingNoteId(noteId);
                  FirebaseMultiUserService.startEditing(noteId, 'note');
                }, 10);
                return null;
              }
              // 편집 시작 알림
              console.log(`🚀 [App] 새로운 편집 시작`);
              FirebaseMultiUserService.startEditing(noteId, 'note');
              return noteId;
            });
          },
        },
        {
          label: `색상 전환: ${note.sentiment} → ${sentimentCycle[note.sentiment]}`,
          action: () => {
            const nextSentiment = sentimentCycle[note.sentiment];
            handleUpdateNote(noteId, { sentiment: nextSentiment });
          },
        },
        { label: '연결 시작', action: () => handleConnectStart(noteId) },
        {
          label: '삭제',
          action: () => {
            if (window.confirm('이 포스트잇을 삭제하시겠습니까?')) {
              setNotes(currentNotes => currentNotes.filter(n => n.id !== noteId));
              setConnections(conns =>
                conns.filter(c => c.sourceId !== noteId && c.targetId !== noteId)
              );
              // 삭제된 노트가 편집 중이었다면 편집 상태 해제
              if (editingNoteId === noteId) {
                setEditingNoteId(null);
              }
              // 선택된 노트에서도 제거
              setSelectedNoteIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(noteId);
                return newSet;
              });
              // MultiUser 서비스로 삭제 전송
              FirebaseMultiUserService.deleteStickyNote(noteId);
            }
          },
          isDanger: true,
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [notes, editingNoteId, handleCloseContextMenu, handleConnectStart, handleUpdateNote]
  );

  const handleConnectionContextMenu = useCallback(
    (e: MouseEvent, connectionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      handleCloseContextMenu();
      const conn = connections.find(c => c.id === connectionId);
      if (!conn) return;
      const items = [
        {
          label: `'${conn.relationType === 'direct' ? '점선' : '실선'}'으로 전환`,
          action: () =>
            handleUpdateConnection(
              connectionId,
              conn.relationType === 'direct' ? 'indirect' : 'direct'
            ),
        },
        {
          label: '연결선 삭제',
          action: () => handleDeleteConnection(connectionId),
          isDanger: true,
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [connections, handleCloseContextMenu, handleUpdateConnection, handleDeleteConnection]
  );

  const handleClearAll = useCallback(() => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까?')) {
      console.log('🗑️ [App] 전체 삭제 및 멀티유저 동기화 시작');

      // 현재 상태 백업 (멀티유저 동기화용)
      const currentNotes = [...notes];
      const currentConnections = [...connections];

      // 로컬 상태 즉시 초기화
      setNotes([]);
      setConnections([]);
      setSelectedNoteIds(new Set());
      setAnalysisReportData([]);
      setEditingNoteId(null);

      // 멀티유저 동기화: 모든 노트와 연결선 삭제 전송
      console.log(
        `📤 [App] 삭제할 노트 ${currentNotes.length}개, 연결선 ${currentConnections.length}개`
      );

      // 모든 연결선 삭제
      currentConnections.forEach((connection, index) => {
        setTimeout(() => {
          console.log(`🗑️ [App] 연결선 삭제: ${connection.id}`);
          FirebaseMultiUserService.deleteConnection(connection.id);
        }, index * 50);
      });

      // 모든 노트 삭제
      currentNotes.forEach((note, index) => {
        setTimeout(
          () => {
            console.log(`🗑️ [App] 노트 삭제: ${note.id}`);
            FirebaseMultiUserService.deleteStickyNote(note.id);
          },
          currentConnections.length * 50 + index * 50
        );
      });

      console.log('✅ [App] 전체 삭제 멀티유저 동기화 완료');
    }
  }, [notes, connections]);

  const handleNoteClick = useCallback(
    (targetNoteId: string) => {
      if (connectingNoteId && connectingNoteId !== targetNoteId) {
        const newConnection = {
          id: uuidv4(),
          sourceId: connectingNoteId,
          targetId: targetNoteId,
          relationType: 'direct',
          isPositive: true,
        };

        // 로컬 상태 업데이트
        setConnections(prev => [...prev, newConnection]);
        setConnectingNoteId(null);

        // MultiUser 서비스로 연결선 전송
        FirebaseMultiUserService.updateConnection(newConnection);
      } else if (connectingNoteId === targetNoteId) {
        setConnectingNoteId(null);
      }
    },
    [connectingNoteId]
  );

  const handleAddNewNote = useCallback((type: NoteType, position: Position) => {
    const layerConfig = Object.values(LAYER_CONFIG).find(c =>
      c.label.startsWith(type.split('_')[0])
    );
    const newNoteId = uuidv4();
    const newNote: NoteData = {
      id: newNoteId,
      content: '새 포스트잇',
      text: '새 포스트잇', // 호환성을 위해 둘 다 설정
      type: type,
      layer: (layerConfig?.index as 1 | 2 | 3 | 4) || 1,
      layerIndex: (layerConfig?.index as 1 | 2 | 3 | 4) || 1, // 호환성
      sentiment: 'neutral',
      position: position,
      width: 200,
      height: 120,
    };

    // 로컬 상태 업데이트
    setNotes(currentNotes => [...currentNotes, newNote]);
    setEditingNoteId(newNoteId);

    // 편집 시작 알림
    FirebaseMultiUserService.startEditing(newNoteId, 'note');

    // Firebase 서비스로 새 포스트잇 전송
    FirebaseMultiUserService.updateStickyNote({
      id: newNote.id,
      content: newNote.content || newNote.text || '새 포스트잇',
      x: newNote.position.x,
      y: newNote.position.y,
      layer: newNote.layer,
      color: newNote.sentiment || 'neutral',
      type: newNote.type,
      width: newNote.width,
      height: newNote.height,
    });
  }, []);

  const handleBoardContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (panning?.isPanning || wasPanning) {
        e.preventDefault();
        if (wasPanning) setWasPanning(false);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('.enhanced-sticky-note')) return;
      e.preventDefault();
      const board = boardRef.current;
      const scrollContainer = scrollContainerRef.current;
      if (!board || !scrollContainer) return;
      const rect = board.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollContainer.scrollLeft;
      const y = e.clientY - rect.top + scrollContainer.scrollTop;
      const contextMenuItems = (['결과', '행동', '유형_레버', '무형_레버'] as const).map(type => ({
        label: `${type.replace('_레버', '')} 포스트잇 추가`,
        action: () => handleAddNewNote(type, { x, y }),
      }));
      setContextMenu({ x: e.clientX, y: e.clientY, items: contextMenuItems });
    },
    [panning, wasPanning, handleAddNewNote]
  );

  const handleRenderFromText = useCallback(
    (data: string | { notes: NoteData[]; connections: ConnectionData[] }) => {
      // 타입 체크 및 처리
      if (typeof data === 'string') {
        console.log('🗺️ [App] 텍스트 파싱 시작');
        if (!data.trim()) {
          handleClearAll();
          return;
        }
        try {
          const { notes: parsedNotes, connections: parsedConnections } = parseAIOutput(data);
          if (parsedNotes.length === 0) return;

          setNotes(parsedNotes);
          setConnections(parsedConnections);
        } catch (error) {
          console.error('분석 결과 파싱 오류:', error);
          return;
        }
      } else if (data && typeof data === 'object' && 'notes' in data && 'connections' in data) {
        console.log('🗺️ [App] 파싱된 데이터 직접 사용:', {
          noteCount: data.notes.length,
          connectionCount: data.connections.length,
        });
        if (data.notes.length === 0) {
          console.warn('⚠️ [App] 노트가 없어서 컬쳐맵 생성 중단');
          return;
        }

        setNotes(data.notes);
        setConnections(data.connections);
      } else {
        console.error('🚨 [App] handleRenderFromText received invalid data:', {
          type: typeof data,
          isArray: Array.isArray(data),
          hasNotes: data && 'notes' in data,
          hasConnections: data && 'connections' in data,
          data: data,
        });
        return;
      }

      console.log('🗺️ [App] 컬쳐맵 레이아웃 생성 시작');

      // 상태 업데이트 후 레이아웃 적용
      setTimeout(() => {
        // 상태가 업데이트된 후의 최신 값을 사용
        setNotes(currentNotes => {
          setConnections(currentConnections => {
            console.log(
              `🔍 레이아웃 생성 - 현재 노트: ${currentNotes.length}개, 연결선: ${currentConnections.length}개`
            );

            const { nodes: layoutedNodes, connections: layoutedConnections } = getLayoutedElements(
              currentNotes,
              currentConnections
            );

            // 레이아웃이 적용된 노드로 업데이트
            setNotes(layoutedNodes);
            setConnections(layoutedConnections);
            setActiveTab('map');

            // 멀티유저 동기화: 모든 생성된 노트를 다른 사용자에게 전송
            console.log(
              `📤 [App] 생성된 노트 ${layoutedNodes.length}개, 연결선 ${layoutedConnections.length}개 동기화 시작`
            );

            // 각 노트를 Firebase 서비스로 전송
            layoutedNodes.forEach((node, index) => {
              setTimeout(() => {
                console.log(`📝 [App] 노트 동기화: ${node.id}`);
                FirebaseMultiUserService.updateStickyNote({
                  id: node.id,
                  content: node.content || node.text || '',
                  x: node.position.x,
                  y: node.position.y,
                  layer: node.layerIndex || node.layer || 0,
                  color: node.sentiment || 'neutral',
                  type: node.type || 'sticky_note',
                  width: node.width || 200,
                  height: node.height || 120,
                  concept: node.concept,
                  source: node.source,
                  category: node.category,
                  metadata: node.metadata,
                  basis: node.basis, // 이론적 설명 추가
                });
              }, index * 100); // 100ms 간격으로 전송하여 서버 부하 방지
            });

            // 각 연결선을 Firebase 서비스로 전송
            layoutedConnections.forEach((connection, index) => {
              setTimeout(
                () => {
                  console.log(`🔗 [App] 연결선 동기화: ${connection.id}`);
                  FirebaseMultiUserService.updateConnection(connection);
                },
                layoutedNodes.length * 100 + index * 50
              ); // 노트 전송 후 연결선 전송
            });

            console.log('✅ [App] 컬쳐맵 멀티유저 동기화 완료');
            return currentConnections; // setConnections 반환값
          });
          return currentNotes; // setNotes 반환값
        });
      }, 100); // setTimeout 종료
    },
    [handleClearAll]
  );

  const handleShowReport = useCallback((reportText: string) => {
    const parsedData = parseIntelligent(reportText);
    setAnalysisReportData(parsedData);
    setActiveTab('report');
  }, []);

  const handleExportAsImage = useCallback(async () => {
    const scrollContainer = scrollContainerRef.current;
    const mapElement = boardRef.current;

    if (!mapElement || !scrollContainer || notes.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const originalScrollLeft = scrollContainer.scrollLeft;
    const originalScrollTop = scrollContainer.scrollTop;
    scrollContainer.scrollLeft = 0;
    scrollContainer.scrollTop = 0;

    // DOM 업데이트를 위한 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      let maxX = 0;
      let maxY = 0;

      notes.forEach(note => {
        maxX = Math.max(maxX, note.position.x + (note.width || 200));
        maxY = Math.max(maxY, note.position.y + (note.height || 120));
      });

      const padding = 150; // 여백을 늘려 레이블이 잘리지 않도록 함

      const captureWidth = maxX + padding;
      const captureHeight = Math.max(maxY + padding, layerState.totalHeight + padding);

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        scale: 1.5, // 스케일 조정
        backgroundColor: '#f0f2f5', // 배경색을 옅은 회색으로 변경
        width: captureWidth,
        height: captureHeight,
        x: 0, // 캡처 시작점을 0으로 고정
        y: 0,
        logging: false,
        onclone: document => {
          // 캡처 시점에만 적용될 스타일
          const clonedBoard = document.getElementById('enhanced-notes-board');
          if (clonedBoard) {
            // 보드의 transform을 제거하여 위치를 고정
            clonedBoard.style.transform = 'translate(0, 0)';
          }
        },
      });

      canvas.toBlob(blob => {
        if (blob) {
          saveAs(blob, 'culture-map-export.png');
        }
      });
    } catch (error) {
      console.error('이미지 내보내기 오류:', error);
      alert('이미지를 내보내는 중 오류가 발생했습니다.');
    } finally {
      // 스크롤 위치 복원
      scrollContainer.scrollLeft = originalScrollLeft;
      scrollContainer.scrollTop = originalScrollTop;
    }
  }, [notes, layerState]);

  const handleExportAsJson = useCallback(() => {
    const data = { notes, connections, layerState };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, 'culture-map-data.json');
  }, [notes, connections, layerState]);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        handleExportAsJson();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleExportAsJson]);

  // =================================================================================
  // 렌더링 (Rendering)
  // =================================================================================

  return (
    <Router>
      <div className="app-container">
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
          <>
            {/* React Flow 전환 토글 버튼 */}
            <div className="flow-toggle-container">
              <label className="flow-toggle-label">
                <input
                  type="checkbox"
                  checked={useReactFlow}
                  onChange={(e) => setUseReactFlow(e.target.checked)}
                  className="flow-toggle-checkbox"
                />
                <span className="flow-toggle-text">
                  {useReactFlow ? '🚀 React Flow 모드' : '📝 레거시 모드'}
                </span>
              </label>
            </div>

            {useReactFlow ? (
              <CultureMapFlow
                notes={notes}
                connections={connections}
                onNotesChange={setNotes}
                onConnectionsChange={setConnections}
                onNodeUpdate={(id, content) => {
                  // content와 text 둘 다 업데이트
                  console.log('📝 [App] onNodeUpdate called:', { id, content });
                  handleUpdateNote(id, { text: content, content: content });
                }}
              />
            ) : (
              <EnhancedCultureMapApp
            // 상태 전달
            notes={notes}
            connections={connections}
            activeTab={activeTab}
            analysisReportData={analysisReportData}
            boardTransform={boardTransform}
            editingNoteId={editingNoteId}
            selection={selection}
            selectedNoteIds={selectedNoteIds}
            connectingNoteId={connectingNoteId}
            editingItems={editingItems}
            contextMenu={contextMenu}
            isHelpModalOpen={isHelpModalOpen}
            layerControlVisible={layerControlVisible}
            draggingNoteId={draggingNote?.noteId || null}
            // 층위 시스템 상태 전달 (시각적 가이드용)
            layerState={layerState}
            visualizationOptions={visualizationOptions}
            // 참조 전달
            boardRef={boardRef}
            scrollContainerRef={scrollContainerRef}
            // 세션 정보 전달
            sessionInfo={sessionInfo}
            // 상태 설정 함수 전달
            setActiveTab={setActiveTab}
            setIsHelpModalOpen={setIsHelpModalOpen}
            setLayerControlVisible={setLayerControlVisible}
            // 핸들러 함수 전달
            handleMouseDownOnBoard={handleMouseDownOnBoard}
            handleMouseDownOnNote={handleMouseDownOnNote}
            handleMouseDownOnResizeHandle={handleMouseDownOnResizeHandle}
            handleMouseDownOnLayerResizeHandle={handleMouseDownOnLayerResizeHandle}
            handleUpdateConnection={handleUpdateConnection}
            handleDeleteConnection={handleDeleteConnection}
            handleCloseContextMenu={handleCloseContextMenu}
            handleNoteContextMenu={handleNoteContextMenu}
            handleConnectionContextMenu={handleConnectionContextMenu}
            handleClearAll={handleClearAll}
            handleNoteClick={handleNoteClick}
            handleUpdateNote={handleUpdateNote}
            handleBoardContextMenu={handleBoardContextMenu}
            handleRenderFromText={handleRenderFromText}
            handleShowReport={handleShowReport}
            handleExportAsImage={handleExportAsImage}
            handleExportAsJson={handleExportAsJson}
            onStartEditing={(noteId: string) =>
              FirebaseMultiUserService.startEditing(noteId, 'note')
            }
            onStartEdit={handleStartEdit}
            onEditComplete={handleEditComplete}
            // 층위 시스템 함수 전달 (단순화)
            onLayerHeightChange={handleLayerHeightChange}
            setVisualizationOptions={setVisualizationOptions}
            setLayerState={setLayerState}
            // 계산된 값 전달
            highlightedLayers={[]} // 더 이상 사용 안함
              />
            )}
          </>
        )}

        {/* Welcome Modal */}
        <WelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
      </div>
    </Router>
  );
}

export default App;
