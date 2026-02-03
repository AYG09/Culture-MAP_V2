// src/components/CultureMapFlow.tsx - 완전히 재작성된 버전
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  type NodeChange,
  type EdgeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useLiveblocksSync } from '../hooks/useLiveblocksSync';
import { useOthers, useUpdateMyPresence } from '@liveblocks/react/suspense';
import {
  ResultNode,
  BehaviorNode,
  TangibleLeverNode,
  IntangibleLeverNode,
} from './flow-nodes';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Box,
  ChevronDown,
  Cloud,
  Frown,
  LayoutGrid,
  Layers,
  Link2,
  Minus,
  Pin,
  PinOff,
  PlusSquare,
  Route,
  SlidersHorizontal,
  Smile,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import AnimatedFlowEdge from './edges/AnimatedFlowEdge';
import MobileGestureGuide from './MobileGestureGuide';
import HelpModal from './HelpModal';
import AIChatSidebar from './AIChatSidebar'; // 좌측 사이드메뉴 (AI 챗봇)
import { useIsMobile } from '../hooks/useResponsive'; // 반응형 훅 추가
import LayerBackground from './LayerBackground';
import LayerControlPanel from './LayerControlPanel';
import { useAiActions } from '../hooks/useAiActions';

// Lazy loaded components for code splitting
const ExportMenu = lazy(() => import('./ExportMenu'));
const ReportEditor = lazy(() => import('./ReportEditor'));

// 타입
import type { NoteData, ConnectionData, PerceptionIntensity } from '../types/culture';
import type { StickyNoteData, ConnectionData as LBConnectionData, SessionType } from '../types/liveblocks';

// 유틸리티
import { convertToFlowData, convertFromFlowData } from '../utils/flowDataConverter';
import { buildElkLayoutOptions, getElkLayoutedElements, getLayoutedElements, applyOptimalHandlesToEdges, getOptimalHandles, LAYER_MAX_HEIGHT } from '../utils/flowAutoLayout';
import { parseAIOutput } from '../utils/parser';

// Liveblocks 서비스
import liveblocksService from '../services/LiveblocksService';
import SessionInfoPanel from './SessionInfoPanel';

// AI 서비스 및 유틸리티
import { aiService } from '../services/AIService';
import { parseMarkdown } from '../utils/markdownParser';

import './CultureMapFlow.css';

interface CultureMapFlowProps {
  onNotesChange: (notes: NoteData[]) => void;
  onConnectionsChange: (connections: ConnectionData[]) => void;
  onNodeUpdate: (id: string, content: string) => void;
}

type PaneContextMenuState = {
  type: 'pane';
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
};

type NodeContextMenuState = {
  type: 'node';
  x: number;
  y: number;
  targetId: string;
};

type EdgeContextMenuState = {
  type: 'edge';
  x: number;
  y: number;
  targetId: string;
};

type ContextMenuState = PaneContextMenuState | NodeContextMenuState | EdgeContextMenuState;

type CollaborationLock = {
  itemId: string;
  itemType: 'note' | 'connection';
  userId: string;
  displayName?: string;
};

// 커스텀 노드 타입 정의
const nodeTypes = {
  result: ResultNode,
  behavior: BehaviorNode,
  tangible_lever: TangibleLeverNode,
  intangible_lever: IntangibleLeverNode,
};

// 커스텀 엣지 타입 정의 - 화살표 이동 애니메이션
const edgeTypes = {
  animatedFlow: AnimatedFlowEdge,
};

const NOTE_TYPE_MAP: Record<string, NoteData['type']> = {
  result: '결과',
  behavior: '행동',
  tangible_lever: '유형_레버',
  intangible_lever: '무형_레버',
  결과: '결과',
  행동: '행동',
  유형_레버: '유형_레버',
  무형_레버: '무형_레버',
};


const NOTE_TYPE_TO_LAYER: Record<NoteData['type'], NoteData['layer']> = {
  결과: 1,
  행동: 2,
  유형_레버: 3,
  무형_레버: 4,
  insight: 2,
};

const isSentiment = (value: unknown): value is NoteData['sentiment'] =>
  value === 'positive' || value === 'negative' || value === 'neutral';

const toNoteType = (value?: string): NoteData['type'] => NOTE_TYPE_MAP[value ?? ''] ?? '행동';

const toLayerValue = (layer?: number, noteType?: NoteData['type']): NoteData['layer'] => {
  if (layer && layer >= 1 && layer <= 4) {
    return layer as NoteData['layer'];
  }
  return NOTE_TYPE_TO_LAYER[noteType ?? '행동'] ?? 2;
};

const mapLiveblocksNoteToNoteData = (note: StickyNoteData): NoteData => {
  const noteType = toNoteType(note.type);
  const sentiment = isSentiment(note.sentiment) ? note.sentiment : 'neutral';

  // x, y가 undefined/NaN이면 기본값 설정 (노드 겨침 방지)
  const x = typeof note.x === 'number' && Number.isFinite(note.x) ? note.x : 100 + Math.random() * 200;
  const y = typeof note.y === 'number' && Number.isFinite(note.y) ? note.y : 100 + Math.random() * 100;

  return {
    id: note.id,
    content: note.content ?? '',
    position: { x, y },
    width: note.width ?? 200,
    height: note.height ?? 120,
    type: noteType,
    sentiment,
    perceptionIntensity: note.frequency ?? undefined,
    basis: note.basis,
    layer: toLayerValue(note.layer, noteType),
    createdBy: note.createdBy,
    pinned: note.pinned === true,
    pinnedHandles: note.pinnedHandles === true,
  };
};

const mapLiveblocksConnectionToConnectionData = (
  connection: LBConnectionData
): ConnectionData => {
  const relationTypeRaw = String(connection.relationType ?? '').toLowerCase();
  const relationType = relationTypeRaw === 'indirect' ? 'indirect' : 'direct';

  return {
    id: connection.id,
    sourceId: connection.sourceId,
    targetId: connection.targetId,
    relationType,
    isPositive: connection.isPositive !== false,
    createdBy: connection.createdBy,
    // 핸들 정보 유지 (저장된 연결선 흐름 보존)
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
  };
};


const CultureMapFlow = ({
  onNotesChange,
  onConnectionsChange,
  onNodeUpdate,
}: CultureMapFlowProps) => {
  // 세션 타입 기반 모드 결정
  const currentSession = liveblocksService.getCurrentSession();
  const [sessionType, setSessionType] = useState<SessionType>(currentSession?.type ?? 'workshop');
  const mode = sessionType;
  const isConsultingMode = sessionType === 'consulting';

  // React Flow 노드/엣지 상태
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const layoutSpacingRef = useRef<'compact' | 'normal' | 'wide'>('normal');
  const previousLayerStartsRef = useRef<number[] | null>(null);
  const isHydratingRef = useRef(false);
  const isUserLayerHeightChangeRef = useRef(false);
  const draggingNodeIdsRef = useRef(new Set<string>());
  const resizingNodeIdsRef = useRef(new Set<string>());


  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  /* useEffect for session type removed */

  const lastSyncWarningRef = useRef(0);

  const ensureLiveblocksConnected = useCallback((actionLabel: string) => {
    if (liveblocksService.isConnected()) {
      return true;
    }

    const now = Date.now();
    if (now - lastSyncWarningRef.current > 3000) {
      lastSyncWarningRef.current = now;
      alert('세션 동기화 중입니다. 잠시 후 다시 시도해주세요.');
    }

    console.warn('⚠️ [React Flow] Liveblocks 미연결로 작업 중단:', actionLabel);
    return false;
  }, []);

  // AI 일괄 생성 입력 상태
  const [aiInput, setAiInput] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);

  // 탭 시스템 상태 (컬쳐맵 / 보고서)
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map');
  const [reportContent, setReportContent] = useState(''); // 보고서 내용
  const [isGeneratingReport, setIsGeneratingReport] = useState(false); // AI 보고서 생성 중

  // 선택된 노드/엣지 상태 (추후 활용 가능)
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [, setSelectedEdges] = useState<Edge[]>([]);
  const selectedNodeIds = useMemo(() => selectedNodes.map((node) => node.id), [selectedNodes]);
  const hasSelectedNodes = selectedNodeIds.length > 0;

  // 보고서 내용 변경 핸들러
  const handleReportChange = useCallback((content: string) => {
    setReportContent(content);

    if (liveblocksService.isConnected()) {
      liveblocksService.updateReportContent(content);
    }
  }, []);

  // AI 보고서 생성 핸들러
  const handleGenerateReport = useCallback(async () => {
    if (isGeneratingReport) return;

    try {
      setIsGeneratingReport(true);

      // 1. 프롬프트 파일 로드
      const promptResponse = await fetch('/prompts/comprehensive_analysis.md');
      if (!promptResponse.ok) {
        throw new Error('프롬프트 파일을 불러올 수 없습니다.');
      }
      const promptTemplate = await promptResponse.text();

      // 2. 현재 맵 데이터를 텍스트로 변환 (LiveblocksService에서 가져오기)
      const notesList = liveblocksService.getStickyNotes();
      const connectionsList = liveblocksService.getConnections();

      const layerNames = ['결과 (Layer 1)', '행동 (Layer 2)', '유형 레버 (Layer 3)', '무형 레버 (Layer 4)'];

      const mapDataSection = `
### 노드 목록 (${notesList.length}개)
${notesList.map((note: import('../types/liveblocks').StickyNoteData) => {
        const layerName = layerNames[note.layer - 1] || `Layer ${note.layer}`;
        return `- [${layerName}] ${note.content} (감정: ${note.sentiment || 'neutral'})`;
      }).join('\n')}

### 연결 관계 (${connectionsList.length}개)
${connectionsList.map((conn: import('../types/liveblocks').ConnectionData) => {
        const sourceNote = notesList.find((n: import('../types/liveblocks').StickyNoteData) => n.id === conn.sourceId);
        const targetNote = notesList.find((n: import('../types/liveblocks').StickyNoteData) => n.id === conn.targetId);
        const relation = conn.relationType || 'direct';
        return `- "${sourceNote?.content || conn.sourceId}" → "${targetNote?.content || conn.targetId}" (${relation})`;
      }).join('\n')}
`;

      // 3. AI가 캐싱한 핵심 인사이트 가져오기 (동적으로 추출된 분석 결과)
      const cachedInsights = aiService.getInsights();

      // 인사이트를 유형별로 그룹화하여 정리
      const insightsByType = cachedInsights.reduce((acc, insight) => {
        if (!acc[insight.type]) acc[insight.type] = [];
        acc[insight.type].push(insight);
        return acc;
      }, {} as Record<string, typeof cachedInsights>);

      const typeLabels: Record<string, string> = {
        'berkman': '📊 버크만 진단 분석',
        'raci': '📋 RACI 매트릭스 분석',
        'org-chart': '🏢 조직 구조 분석',
        'diagnosis': '🔍 문화 진단 결과',
        'solution': '💡 솔루션 제안',
        'recommendation': '✅ 핵심 추천 사항',
        'general': '📝 기타 분석 결과'
      };

      const chatHistorySection = cachedInsights.length > 0
        ? Object.entries(insightsByType).map(([type, insights]) => {
          const label = typeLabels[type] || type;
          const insightContents = insights.map(ins => {
            const personsInfo = ins.persons?.length ? `\n[관련 인물: ${ins.persons.join(', ')}]` : '';
            return `### ${ins.title}\n${ins.content}${personsInfo}`;
          }).join('\n\n');
          return `## ${label}\n\n${insightContents}`;
        }).join('\n\n---\n\n')
        : '(캐싱된 분석 인사이트 없음)';

      // 4. 통합 컨텍스트 생성
      const fullContext = `
## 1. Culture Map 현황

${mapDataSection}

## 2. AI 분석 인사이트 (자동 캐싱된 핵심 분석 결과)

아래는 대화 중 AI가 자동으로 추출하여 캐싱한 핵심 인사이트입니다. 
버크만 진단, RACI, 조직도 분석 등 의미 있는 분석 결과만 포함되어 있습니다.

${chatHistorySection}
`;

      // 4-1. 채팅 요약 생성 (토큰 예산 고려)
      const chatMessages = liveblocksService.getChatMessages();
      const basePrompt = `${promptTemplate}\n\n${fullContext}`;
      const baseTokens = aiService.estimateTokenCount(basePrompt);
      const modelLimits = await aiService.getModelTokenLimits();
      const reservedTokens = 12000; // 출력/안전 여유분
      const remainingTokens = Math.max(modelLimits.inputTokenLimit - reservedTokens - baseTokens, 0);
      const summaryInputBudget = Math.min(Math.floor(remainingTokens * 0.2), 12000);

      const chatSummary = summaryInputBudget > 0
        ? await aiService.summarizeChatMessages(chatMessages, {
          maxInputTokens: summaryInputBudget,
          maxOutputChars: 1200,
          maxMessages: 160,
        })
        : '';

      const fullContextWithSummary = chatSummary
        ? `${fullContext}\n\n## 3. 최근 채팅 요약\n\n${chatSummary}\n`
        : fullContext;

      // 5. AI에게 분석 요청
      const fullPrompt = `${promptTemplate}\n\n${fullContextWithSummary}\n\n위 Culture Map 데이터와 캐싱된 AI 분석 인사이트를 바탕으로 종합 분석 보고서를 작성해주세요.
인사이트에 포함된 버크만 진단, RACI, 조직도 분석 결과가 있다면 솔루션 제안에 적극 반영해주세요.
특히 솔루션 실행 담당자 배정 시 관련 인물 정보와 개인별 특성을 참고해주세요.`;

      // 단발성 생성 (채팅 세션/히스토리와 분리)
      const responseText = await aiService.analyzeCulture(fullPrompt);

      if (!responseText) {
        throw new Error('AI 응답을 받지 못했습니다.');
      }

      // 6. 마크다운을 HTML로 변환
      const htmlContent = parseMarkdown(responseText);

      // 7. 보고서 내용 설정 및 탭 전환
      setReportContent(htmlContent);
      setActiveTab('report');

      // Firebase에도 저장
      if (liveblocksService.isConnected()) {
        liveblocksService.updateReportContent(htmlContent);
      }

    } catch (error) {
      console.error('❌ 보고서 생성 실패:', error);
      alert(`보고서 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [isGeneratingReport]);

  // 보고서 내용 Firebase 동기화 (컨설팅 모드에서만) - useLiveblocksSync에서 처리됨
  /* useEffect removed */


  // 층위별 개별 높이 조절 상태 (레거시 모드와 동일)
  const [layerHeights, setLayerHeights] = useState<number[]>([220, 220, 220, 220]); // [결과, 행동, 유형, 무형]
  const [layerOpacities, setLayerOpacities] = useState<number[]>([1, 1, 1, 1]); // 층위별 투명도
  const [showLayerBackground, setShowLayerBackground] = useState(true);
  const layerHeightsRef = useRef(layerHeights);
  const layerOpacitiesRef = useRef(layerOpacities);
  const showLayerBackgroundRef = useRef(showLayerBackground);

  useEffect(() => {
    layerHeightsRef.current = layerHeights;
  }, [layerHeights]);

  useEffect(() => {
    layerOpacitiesRef.current = layerOpacities;
  }, [layerOpacities]);

  useEffect(() => {
    showLayerBackgroundRef.current = showLayerBackground;
  }, [showLayerBackground]);
  const [showControls, setShowControls] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(true);

  const [styleVariables, setStyleVariables] = useState({
    nodeBackground: 'rgba(255, 255, 255, 0.95)',
    nodeBorderColor: '#d1d5db',
    nodeTextColor: '#1f2937',
    nodeBorderRadius: 12,
    nodeShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
    nodeFontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    nodeFontSize: 14,
    edgeColor: '#10b981',
    edgeWidth: 2,
  });



  // 선택된 층위 (높이 조절용, null = 선택 없음)
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(0);

  // translateExtent 동적 계산 (층위 높이/노드 배치 변경 시 자동 업데이트)
  const totalHeight = layerHeights.reduce((sum, height) => sum + height, 0);
  const translateExtent: [[number, number], [number, number]] = useMemo(() => {
    const fallbackMinX = -100;
    const fallbackMinY = -100;
    const baseMaxX = 3200;
    const baseMaxY = totalHeight + 100;
    const extentPadding = 400;
    const fallbackWidth = 250;
    const fallbackHeight = 120;

    if (!nodes.length) {
      return [[fallbackMinX, fallbackMinY], [baseMaxX, baseMaxY]];
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    nodes.forEach((node) => {
      const width =
        typeof node.measured?.width === 'number'
          ? node.measured.width
          : typeof node.width === 'number'
            ? node.width
            : fallbackWidth;
      const height =
        typeof node.measured?.height === 'number'
          ? node.measured.height
          : typeof node.height === 'number'
            ? node.height
            : fallbackHeight;
      const x = node.position?.x;
      const y = node.position?.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }

      minX = Math.min(minX, x as number);
      minY = Math.min(minY, y as number);
      maxX = Math.max(maxX, (x as number) + width);
      maxY = Math.max(maxY, (y as number) + height);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return [[fallbackMinX, fallbackMinY], [baseMaxX, baseMaxY]];
    }

    const paddedMinX = Math.min(fallbackMinX, minX - extentPadding);
    const paddedMinY = Math.min(fallbackMinY, minY - extentPadding);
    const paddedMaxX = Math.max(baseMaxX, maxX + extentPadding);
    const paddedMaxY = Math.max(baseMaxY, maxY + extentPadding);

    return [[paddedMinX, paddedMinY], [paddedMaxX, paddedMaxY]];
  }, [nodes, totalHeight]);

  // 층위 관리 패널 표시 여부
  const [showLayerControlPanel, setShowLayerControlPanel] = useState(false);

  // 세션 관리 모달 상태
  const [showSessionInfo, setShowSessionInfo] = useState(false);

  // 반응형: 모바일 감지
  const isMobile = useIsMobile();

  // 사이드 패널 리사이즈 상태
  const [sidebarWidth, setSidebarWidth] = useState(380); // 초기 너비 280px → 380px
  const [isResizing, setIsResizing] = useState(false);

  // 모바일 사이드바 토글 상태
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // 모바일 포스트잇 생성 모달 상태
  const [showMobileAddMenu, setShowMobileAddMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  const [collaborationLocks, setCollaborationLocks] = useState<Record<string, CollaborationLock>>({});
  const collaborationLocksRef = useRef<Record<string, CollaborationLock>>({});

  const getCurrentUserId = useCallback(() => liveblocksService.getCurrentUserId() ?? 'local-user', []);

  const applyEdgeBundling = useCallback((edges: Edge[]): Edge[] => {
    const byTarget = new Map<string, Edge[]>();
    const bySource = new Map<string, Edge[]>();

    edges.forEach((edge) => {
      if (!byTarget.has(edge.target)) {
        byTarget.set(edge.target, []);
      }
      byTarget.get(edge.target)!.push(edge);

      if (!bySource.has(edge.source)) {
        bySource.set(edge.source, []);
      }
      bySource.get(edge.source)!.push(edge);
    });

    const bundleMap = new Map<string, { bundleSize: number; bundleIndex: number }>();

    byTarget.forEach((group) => {
      if (group.length <= 1) return;
      const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
      sorted.forEach((edge, index) => {
        bundleMap.set(edge.id, { bundleSize: sorted.length, bundleIndex: index });
      });
    });

    bySource.forEach((group) => {
      if (group.length <= 1) return;
      const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
      sorted.forEach((edge, index) => {
        if (bundleMap.has(edge.id)) return;
        bundleMap.set(edge.id, { bundleSize: sorted.length, bundleIndex: index });
      });
    });

    return edges.map((edge) => {
      const bundle = bundleMap.get(edge.id);
      if (!bundle) {
        return edge;
      }
      const data = (edge.data as Record<string, unknown> | undefined) ?? {};
      return {
        ...edge,
        data: {
          ...data,
          bundleSize: bundle.bundleSize,
          bundleIndex: bundle.bundleIndex,
        },
      };
    });
  }, []);

  const safeAutoLayout = useCallback(async (showAlert = false) => {
    const normalizeLayerType = (value?: string) => {
      if (
        value === 'result'
        || value === 'behavior'
        || value === 'tangible_lever'
        || value === 'intangible_lever'
      ) {
        return value;
      }
      return 'behavior';
    };

    const dedupeNodesById = (items: Node[]) => {
      const deduped = new Map<string, Node>();
      const duplicates = new Set<string>();

      items.forEach((node) => {
        if (deduped.has(node.id)) {
          duplicates.add(node.id);
        }
        deduped.set(node.id, node);
      });

      return {
        dedupedNodes: Array.from(deduped.values()),
        duplicateIds: Array.from(duplicates),
      };
    };

    if (reactFlowInstance) {
      try {
        const beforeLayout = {
          nodes: reactFlowInstance.getNodes(),
          edges: reactFlowInstance.getEdges(),
          viewport: reactFlowInstance.getViewport(),
          timestamp: Date.now(),
        };
        localStorage.setItem('culture-map-snapshot:_before_layout', JSON.stringify(beforeLayout));
      } catch (err) {
        console.warn('⚠️ [React Flow] auto_layout 스냅샷 저장 실패:', err);
      }
    }

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (!currentNodes.length) {
      console.warn('⚠️ [React Flow] auto_layout 중단: 노드가 비어 있습니다.', {
        nodes: currentNodes.length,
        edges: currentEdges.length,
      });
      return;
    }

    const { dedupedNodes, duplicateIds } = dedupeNodesById(currentNodes);
    if (duplicateIds.length > 0) {
      console.warn('⚠️ [React Flow] auto_layout: 중복 node id 감지', {
        duplicates: duplicateIds.length,
        sample: duplicateIds.slice(0, 8),
      });
    }

    const nodeIdSet = new Set(dedupedNodes.map((node) => node.id));
    const filteredEdges = currentEdges.filter(
      (edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
    );

    const pinnedNodes = dedupedNodes.filter((node) => (node.data as { pinned?: boolean } | undefined)?.pinned === true);
    const floatingNodes = dedupedNodes.filter((node) => (node.data as { pinned?: boolean } | undefined)?.pinned !== true);
    const floatingNodeIdSet = new Set(floatingNodes.map((node) => node.id));
    const floatingEdges = filteredEdges.filter(
      (edge) => floatingNodeIdSet.has(edge.source) && floatingNodeIdSet.has(edge.target)
    );
    const pinnedNodeIdSet = new Set(pinnedNodes.map((node) => node.id));
    const hasPinnedConnections = filteredEdges.some((edge) =>
      (pinnedNodeIdSet.has(edge.source) && floatingNodeIdSet.has(edge.target))
      || (pinnedNodeIdSet.has(edge.target) && floatingNodeIdSet.has(edge.source))
    );

    const nodeTypeById = new Map(
      dedupedNodes.map((node) => [node.id, normalizeLayerType(node.type)])
    );
    const hasIntraLayerEdges = filteredEdges.some((edge) => {
      const sourceType = nodeTypeById.get(edge.source);
      const targetType = nodeTypeById.get(edge.target);
      return Boolean(sourceType && targetType && sourceType === targetType);
    });

    let layoutedNodes: Node[] = [];
    let layoutedEdges: Edge[] = [];

    if (!floatingNodes.length) {
      layoutedNodes = [];
      layoutedEdges = filteredEdges;
    } else if (hasIntraLayerEdges || hasPinnedConnections) {
      const result = getLayoutedElements(floatingNodes, floatingEdges, {
        layerHeights,
        spacingPreset: layoutSpacingRef.current,
        pinnedNodes: pinnedNodes,
        allEdges: filteredEdges,
      });
      layoutedNodes = result.nodes;
      layoutedEdges = result.edges;
    } else {
      const result = await getElkLayoutedElements(
        floatingNodes,
        floatingEdges,
        buildElkLayoutOptions(layoutSpacingRef.current)
      );
      layoutedNodes = result.nodes;
      layoutedEdges = result.edges;
    }

    if (floatingNodes.length && (!layoutedNodes.length || layoutedNodes.length !== floatingNodes.length)) {
      const fallback = getLayoutedElements(floatingNodes, floatingEdges, {
        layerHeights,
        spacingPreset: layoutSpacingRef.current,
        pinnedNodes: pinnedNodes,
        allEdges: filteredEdges,
      });
      layoutedNodes = fallback.nodes;
      layoutedEdges = fallback.edges;
    }

    if (floatingNodes.length && (!layoutedNodes.length || layoutedNodes.length !== floatingNodes.length)) {
      console.warn('⚠️ [React Flow] auto_layout 중단: 레이아웃 결과가 비정상입니다.', {
        before: floatingNodes.length,
        after: layoutedNodes.length,
        raw: currentNodes.length,
      });
      return;
    }

    const mergedNodes = pinnedNodes.length ? [...layoutedNodes, ...pinnedNodes] : layoutedNodes;
    const mergedEdges = pinnedNodes.length ? filteredEdges : layoutedEdges;

    const layerIndexMap: Record<string, number> = {
      result: 0,
      behavior: 1,
      tangible_lever: 2,
      intangible_lever: 3,
    };

    const displayLayerOrder: Array<keyof typeof layerIndexMap> = [
      'result',
      'behavior',
      'tangible_lever',
      'intangible_lever',
    ];

    const getNodeHeight = (node: Node) => {
      if (typeof node.measured?.height === 'number') return node.measured.height;
      if (typeof node.height === 'number') return node.height;
      return 120;
    };

    const layerPaddingY = 20;
    const minHeight = 120 + layerPaddingY * 2;
    const maxHeight = LAYER_MAX_HEIGHT;
    const layerStats = new Map<number, {
      minY: number;
      maxBottom: number;
      maxNodeHeight: number;
    }>();

    mergedNodes.forEach((node) => {
      const layerIndex = layerIndexMap[normalizeLayerType(node.type)] ?? 0;
      const nodeHeight = getNodeHeight(node);
      const current = layerStats.get(layerIndex) ?? {
        minY: Number.POSITIVE_INFINITY,
        maxBottom: Number.NEGATIVE_INFINITY,
        maxNodeHeight: 0,
      };
      const nextMinY = Math.min(current.minY, node.position.y);
      const nextMaxBottom = Math.max(current.maxBottom, node.position.y + nodeHeight);
      const nextMaxHeight = Math.max(current.maxNodeHeight, nodeHeight);
      layerStats.set(layerIndex, {
        minY: nextMinY,
        maxBottom: nextMaxBottom,
        maxNodeHeight: nextMaxHeight,
      });
    });

    const resolvedLayerHeights = layerHeights.map((height, index) => {
      const stats = layerStats.get(index);
      if (!stats || !Number.isFinite(stats.minY) || !Number.isFinite(stats.maxBottom)) {
        return Math.min(maxHeight, Math.max(minHeight, height));
      }
      const requiredSpan = stats.maxBottom - stats.minY;
      const required = Math.max(requiredSpan + layerPaddingY * 2, stats.maxNodeHeight + layerPaddingY * 2);
      return Math.min(maxHeight, Math.max(minHeight, required));
    });

    const shouldUpdateHeights = resolvedLayerHeights.some(
      (height, index) => height !== layerHeights[index]
    );
    if (shouldUpdateHeights) {
      setLayerHeights(resolvedLayerHeights);
    }

    const layerStartByIndex = new Map<number, number>();
    let cumulativeY = 0;
    displayLayerOrder.forEach((layerKey) => {
      const index = layerIndexMap[layerKey];
      layerStartByIndex.set(index, cumulativeY);
      cumulativeY += resolvedLayerHeights[index] ?? 0;
    });

    const adjustedNodes = mergedNodes.map((node) => {
      const isPinned = (node.data as { pinned?: boolean } | undefined)?.pinned === true;
      if (isPinned) {
        return node;
      }
      const layerIndex = layerIndexMap[normalizeLayerType(node.type)] ?? 0;
      const bandStart = layerStartByIndex.get(layerIndex) ?? 0;
      const bandHeight = resolvedLayerHeights[layerIndex] ?? minHeight;
      const nodeHeight = getNodeHeight(node);
      const stats = layerStats.get(layerIndex);
      const relativeY = stats && Number.isFinite(stats.minY)
        ? node.position.y - stats.minY
        : 0;
      const bandMinY = bandStart + layerPaddingY;
      const bandMaxY = bandStart + Math.max(0, bandHeight - nodeHeight - layerPaddingY);
      const targetY = bandMinY + relativeY;
      const clampedY = Math.min(Math.max(bandMinY, targetY), bandMaxY);
      return {
        ...node,
        position: {
          x: node.position.x,
          y: clampedY,
        },
      };
    });

    const currentUserId = getCurrentUserId();
    const resolvedNodes = adjustedNodes.map((node) => {
      const nodeData = (node.data as { pinned?: boolean } | undefined) ?? {};
      const isPinned = nodeData.pinned === true;
      const lock = collaborationLocksRef.current[node.id];
      const isLockedByOther = Boolean(
        lock && lock.itemType === 'note' && lock.userId !== currentUserId
      );
      const nextDraggable = !isPinned && !isLockedByOther;
      if (node.draggable === nextDraggable) {
        return node;
      }
      return {
        ...node,
        draggable: nextDraggable,
      };
    });

    setNodes(resolvedNodes);

    const originalEdgeMap = new Map(currentEdges.map((edge) => [edge.id, edge]));
    const pinnedHandleNodeIds = new Set(
      currentNodes
        .filter((node) => (node.data as { pinnedHandles?: boolean } | undefined)?.pinnedHandles === true)
        .map((node) => node.id)
    );
    const edgesWithPreservedHandles = mergedEdges.map((edge) => {
      const original = originalEdgeMap.get(edge.id);
      const hasPinnedHandleNode = pinnedHandleNodeIds.has(edge.source) || pinnedHandleNodeIds.has(edge.target);
      if (hasPinnedHandleNode) {
        if (original) {
          return {
            ...edge,
            sourceHandle: original.sourceHandle,
            targetHandle: original.targetHandle,
            type: original.type,
          };
        }
      }
      return edge;
    });

    const finalEdges = edgesWithPreservedHandles;
    setEdges(finalEdges);
    edgesRef.current = finalEdges;

    const { connections: updatedConnections } = convertFromFlowData(resolvedNodes, finalEdges);
    onConnectionsChange(updatedConnections);

    if (liveblocksService.isConnected()) {
      updatedConnections.forEach((connection) => {
        liveblocksService.updateConnection(connection as LBConnectionData);
      });
    }

    // 일괄 트랜잭션으로 Liveblocks 업데이트 (observer 트리거 최소화)
    const batchUpdates = resolvedNodes.map((node) => {
      const currentData = node.data as { content?: string; sentiment?: string };
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        content: currentData.content,
        layer: (node.type === 'result' ? 1 : node.type === 'behavior' ? 2 : node.type === 'tangible_lever' ? 3 : 4),
        sentiment: currentData.sentiment || 'neutral'
      };
    });
    liveblocksService.batchUpdateNodePositions(batchUpdates);

    if (showAlert) {
      alert('컬처맵이 데이브 그레이 모델 구조에 맞춰 정렬되었습니다.');
    }
  }, [applyEdgeBundling, getCurrentUserId, onConnectionsChange, setEdges, setNodes]);

  const rerouteEdges = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    if (!currentNodes.length || !currentEdges.length) {
      return;
    }

    const nodeIdSet = new Set(currentNodes.map((node) => node.id));
    const filteredEdges = currentEdges.filter(
      (edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
    );

    const pinnedHandleNodeIds = new Set(
      currentNodes
        .filter((node) => (node.data as { pinnedHandles?: boolean } | undefined)?.pinnedHandles === true)
        .map((node) => node.id)
    );

    const optimizedEdges = applyOptimalHandlesToEdges(currentNodes, filteredEdges, {
      force: true,
      pinnedNodeIds: pinnedHandleNodeIds,
    });
    const bundledEdges = applyEdgeBundling(optimizedEdges);

    setEdges(bundledEdges);
    edgesRef.current = bundledEdges;

    const { connections: updatedConnections } = convertFromFlowData(currentNodes, bundledEdges);
    onConnectionsChange(updatedConnections);

    if (liveblocksService.isConnected()) {
      updatedConnections.forEach((connection) => {
        liveblocksService.updateConnection(connection as LBConnectionData);
      });
    }
  }, [applyEdgeBundling, onConnectionsChange, setEdges]);

  const applyStyleVariables = useCallback((variables: typeof styleVariables) => ({
    '--node-bg': variables.nodeBackground,
    '--node-border-color': variables.nodeBorderColor,
    '--node-text-color': variables.nodeTextColor,
    '--node-border-radius': `${variables.nodeBorderRadius}px`,
    '--node-shadow': variables.nodeShadow,
    '--node-font-family': variables.nodeFontFamily,
    '--node-font-size': `${variables.nodeFontSize}px`,
    '--edge-color': variables.edgeColor,
    '--edge-width': `${variables.edgeWidth}px`,
  }), []);

  // [REFACTORED] AI Action Logic moved to useAiActions hook (called below)
  // See src/hooks/useAiActions.ts

  useEffect(() => {
    collaborationLocksRef.current = collaborationLocks;
  }, [collaborationLocks]);


  const handleStartNodeEditing = useCallback(
    (nodeId: string) => {
      const userId = getCurrentUserId();
      const displayName = liveblocksService.getCurrentUserDisplayName();
      const existingLock = collaborationLocksRef.current[nodeId];

      if (existingLock && existingLock.userId !== userId) {
        console.warn('🔒 [React Flow] 노드가 다른 사용자에 의해 잠겨있습니다.', {
          nodeId,
          existingLock,
        });
        return false;
      }

      const registerLocalLock = () => {
        setCollaborationLocks(prev => {
          const prevLock = prev[nodeId];
          if (prevLock && prevLock.userId === userId && prevLock.displayName === displayName) {
            return prev;
          }

          return {
            ...prev,
            [nodeId]: {
              itemId: nodeId,
              itemType: 'note',
              userId,
              displayName,
            },
          };
        });
      };

      if (liveblocksService.isConnected()) {
        liveblocksService.startEditing(nodeId, 'note');
      }

      registerLocalLock();

      return true;
    },
    [getCurrentUserId]
  );

  const handleStopNodeEditing = useCallback(
    (nodeId: string) => {
      const userId = getCurrentUserId();
      const displayName = liveblocksService.getCurrentUserDisplayName();

      if (liveblocksService.isConnected()) {
        liveblocksService.stopEditing(nodeId, 'note');
      }

      setCollaborationLocks(prev => {
        const prevLock = prev[nodeId];
        if (!prevLock || prevLock.userId !== userId) {
          return prev;
        }

        const updated = { ...prev };
        delete updated[nodeId];
        return updated;
      });
      // 편집 중간에 네트워크 상태가 바뀔 수 있으므로 동일 이름의 잠금이 남아있는 상태를 방지
      collaborationLocksRef.current = {
        ...collaborationLocksRef.current,
        [nodeId]: {
          itemId: nodeId,
          itemType: 'note',
          userId,
          displayName,
        },
      };
      delete collaborationLocksRef.current[nodeId];
    },
    [getCurrentUserId]
  );

  // 사이드 패널 리사이즈 핸들러
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // 최소 280px, 최대 600px로 제한
      const newWidth = Math.min(Math.max(e.clientX, 280), 600);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // 리사이징 중 텍스트 선택 방지
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuAdjustedRef = useRef(false);
  const [contextMenuClampTick, setContextMenuClampTick] = useState(0);
  const [contextMenuSections, setContextMenuSections] = useState({
    pane: { create: false, layout: false, selection: false },
    node: { attributes: false, frequency: false, type: false },
    edge: { settings: false },
  });

  const toggleContextSection = useCallback((menuType: 'pane' | 'node' | 'edge', key: string) => {
    setContextMenuSections((prev) => ({
      ...prev,
      [menuType]: {
        ...(prev as Record<string, Record<string, boolean>>)[menuType],
        [key]: !(prev as Record<string, Record<string, boolean>>)[menuType]?.[key],
      },
    }));
    contextMenuAdjustedRef.current = false;
    setContextMenuClampTick((prev) => prev + 1);
  }, []);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.react-flow-context-menu')) {
        setContextMenu(null);
      }
    };

    // 짧은 딜레이 후 리스너 등록 (메뉴가 열릴 때 즉시 닫히는 것 방지)
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      contextMenuAdjustedRef.current = false;
      return;
    }

    setContextMenuSections((prev) => {
      if (contextMenu.type === 'pane') {
        return { ...prev, pane: { create: false, layout: false, selection: false } };
      }
      if (contextMenu.type === 'edge') {
        return { ...prev, edge: { settings: false } };
      }
      return { ...prev, node: { attributes: false, frequency: false, type: false } };
    });
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu) {
      contextMenuAdjustedRef.current = false;
      return;
    }

    if (contextMenuAdjustedRef.current) {
      return;
    }

    const menuEl = contextMenuRef.current;
    if (!menuEl) {
      return;
    }

    const rect = menuEl.getBoundingClientRect();
    const margin = 12;
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    const desiredX = Math.round(Math.min(Math.max(contextMenu.x, margin), Math.max(margin, maxX)));
    const desiredY = Math.round(Math.min(Math.max(contextMenu.y, margin), Math.max(margin, maxY)));

    if (contextMenu.x !== desiredX || contextMenu.y !== desiredY) {
      setContextMenu((prev) => {
        if (!prev) return prev;
        if (prev.x === desiredX && prev.y === desiredY) return prev;
        return { ...prev, x: desiredX, y: desiredY };
      });
    }

    contextMenuAdjustedRef.current = true;
  }, [contextMenu, contextMenuClampTick]);

  const handleNodeContentUpdate = useCallback(
    (nodeId: string, newContent: string) => {
      if (!ensureLiveblocksConnected('노드 편집')) {
        return;
      }
      console.log('📝 [React Flow] handleNodeContentUpdate', { nodeId, newContent });

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const currentData = node.data as Record<string, unknown>;

          return {
            ...node,
            data: {
              ...currentData,
              content: newContent,
            },
          };
        })
      );

      liveblocksService.updateStickyNote({
        id: nodeId,
        content: newContent,
      } as StickyNoteData);

      onNodeUpdate(nodeId, newContent);
    },
    [ensureLiveblocksConnected, onNodeUpdate, setNodes]
  );

  const handleTogglePin = useCallback(
    (nodeId: string, nextPinned: boolean) => {
      const currentUserId = getCurrentUserId();
      const activeLock = collaborationLocksRef.current[nodeId];
      const isLockedByOther = Boolean(
        activeLock && activeLock.itemType === 'note' && activeLock.userId !== currentUserId
      );

      setNodes((currentNodes) => {
        const updated = currentNodes.map((node) =>
          node.id === nodeId
            ? {
              ...node,
              draggable: !nextPinned && !isLockedByOther,
              data: {
                ...node.data,
                pinned: nextPinned,
              },
            }
            : node
        );
        nodesRef.current = updated;
        return updated;
      });

      if (liveblocksService.isConnected()) {
        liveblocksService.updateStickyNote({ id: nodeId, pinned: nextPinned });
      }

      const updatedData = convertFromFlowData(nodesRef.current, edgesRef.current);
      onNotesChange(updatedData.notes);
    },
    [getCurrentUserId, onNotesChange, setNodes]
  );

  const handleBulkPin = useCallback(
    (targetIds: string[], nextPinned: boolean) => {
      if (!targetIds.length) {
        return;
      }

      const currentUserId = getCurrentUserId();
      const targetIdSet = new Set(targetIds);
      const previousNodes = nodesRef.current;

      const updatedNodes = previousNodes.map((node) => {
        if (!targetIdSet.has(node.id)) {
          return node;
        }

        const activeLock = collaborationLocksRef.current[node.id];
        const isLockedByOther = Boolean(
          activeLock && activeLock.itemType === 'note' && activeLock.userId !== currentUserId
        );

        if (isLockedByOther) {
          return node;
        }

        const currentPinned = (node.data as { pinned?: boolean } | undefined)?.pinned === true;
        if (currentPinned === nextPinned) {
          return node;
        }

        return {
          ...node,
          draggable: !nextPinned && !isLockedByOther,
          data: {
            ...node.data,
            pinned: nextPinned,
          },
        };
      });

      const changedNodes = updatedNodes.filter((node, index) => node !== previousNodes[index]);

      nodesRef.current = updatedNodes;
      setNodes(updatedNodes);

      const { notes } = convertFromFlowData(updatedNodes, edgesRef.current);
      onNotesChange(notes);

      if (liveblocksService.isConnected() && changedNodes.length > 0) {
        changedNodes.forEach((node) => {
          liveblocksService.updateStickyNote({ id: node.id, pinned: nextPinned });
        });
      }
    },
    [getCurrentUserId, onNotesChange, setNodes]
  );

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;
      const updated = currentNodes.map((node) => {
        const data = node.data as Record<string, unknown>;
        const hasToggle = typeof (data as { onTogglePin?: unknown }).onTogglePin === 'function';
        const hasPinned = typeof (data as { pinned?: unknown }).pinned === 'boolean';

        if (hasToggle && hasPinned) {
          return node;
        }

        changed = true;
        return {
          ...node,
          data: {
            ...data,
            onTogglePin: handleTogglePin,
            pinned: hasPinned ? (data as { pinned?: boolean }).pinned : false,
          },
        };
      });

      if (!changed) {
        return currentNodes;
      }

      nodesRef.current = updated;
      return updated;
    });
  }, [handleTogglePin, setNodes]);

  // [REFACTORED] Use AI Logic Hook
  const { handleAiAction } = useAiActions({
    setNodes,
    setEdges,
    setLayerHeights,
    setLayerOpacities,
    setShowLayerBackground,
    setShowControls,
    setShowMiniMap,
    setShowLayerControlPanel,
    setShowExportMenu,
    setStyleVariables,
    onNotesChange,
    onConnectionsChange,
    isConsultingMode: isConsultingMode ?? false,
    nodesRef,
    edgesRef,
    layerHeights,
    layerOpacities,
    reactFlowInstance,
    safeAutoLayout,
    rerouteEdges,
    handleNodeContentUpdate,
    handleStartNodeEditing,
    handleStopNodeEditing,
    ensureLiveblocksConnected,
    layoutSpacingRef,
    isUserLayerHeightChangeRef,
    styleVariables,
    handleTogglePin
  });

  const handleSaveSnapshot = useCallback(
    (snapshotName: string) => {
      handleAiAction({ name: 'save_snapshot', args: { name: snapshotName } });
    },
    [handleAiAction]
  );

  const handleRestoreSnapshot = useCallback(
    (snapshotName: string) => {
      handleAiAction({ name: 'restore_snapshot', args: { name: snapshotName } });
    },
    [handleAiAction]
  );

  const handleUndoLayout = useCallback(() => {
    handleAiAction({ name: 'undo_layout', args: {} });
  }, [handleAiAction]);

  const aiContext = useMemo(() => convertFromFlowData(nodes, edges), [nodes, edges]);

  const layerDefinitions = useMemo(
    () => [
      {
        name: '결과',
        color: 'rgba(202, 228, 255, OPACITY)',
        gradient: 'linear-gradient(180deg, rgba(226, 240, 255, OPACITY) 0%, rgba(185, 218, 255, OPACITY) 100%)',
        index: 0,
        description: '성과와 KPI, 산출물 등 가시적 결과',
        examples: '프로젝트 성공률, 고객 만족도, 매출 지표',
      },
      {
        name: '행동',
        color: 'rgba(146, 193, 255, OPACITY)',
        gradient: 'linear-gradient(180deg, rgba(170, 210, 255, OPACITY) 0%, rgba(126, 178, 255, OPACITY) 100%)',
        index: 1,
        description: '구성원이 실제로 보이는 행동 패턴',
        examples: '협업 방식, 보고 습관, 의사결정 참여',
      },
      {
        name: '유형 레버',
        color: 'rgba(78, 132, 215, OPACITY)',
        gradient: 'linear-gradient(180deg, rgba(96, 150, 230, OPACITY) 0%, rgba(60, 112, 200, OPACITY) 100%)',
        index: 2,
        description: '조직의 유형적 기능과 제도/시스템',
        examples: '구조, 권한, 프로세스, 제도, 도구',
      },
      {
        name: '무형 레버',
        color: 'rgba(24, 74, 160, OPACITY)',
        gradient: 'linear-gradient(180deg, rgba(14, 50, 120, OPACITY) 0%, rgba(38, 92, 185, OPACITY) 100%)',
        index: 3,
        description: '기본 가정, 가치관, 신념',
        examples: '조직이 당연하게 여기는 원칙과 문화',
      },
    ],
    []
  );

  const handleLayerLabelClick = useCallback(
    (layerIndex: number) => {
      if (selectedLayerIndex === layerIndex) {
        setSelectedLayerIndex(null);
        setShowLayerControlPanel(false);
      } else {
        setSelectedLayerIndex(layerIndex);
        setShowLayerControlPanel(true);
      }
    },
    [selectedLayerIndex]
  );

  const handleLayerHeightChange = useCallback(
    (value: number) => {
      if (selectedLayerIndex === null) return;
      const layerIndexMap: Record<string, number> = {
        result: 0,
        behavior: 1,
        tangible_lever: 2,
        intangible_lever: 3,
      };
      const displayLayerOrder: Array<keyof typeof layerIndexMap> = [
        'result',
        'behavior',
        'tangible_lever',
        'intangible_lever',
      ];

      const getNodeHeight = (node: Node) => {
        if (typeof node.measured?.height === 'number') return node.measured.height;
        if (typeof node.height === 'number') return node.height;
        return 120;
      };

      const layerPaddingY = 20;
      const minHeight = 100;
      const maxHeight = LAYER_MAX_HEIGHT;

      const requested = Math.min(maxHeight, Math.max(minHeight, value));
      const nextHeights = [...layerHeights];
      nextHeights[selectedLayerIndex] = requested;

      const maxBottomByLayer = [0, 0, 0, 0];
      nodesRef.current.forEach((node) => {
        const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
        const nodeHeight = getNodeHeight(node);
        const bottom = node.position.y + nodeHeight;
        if (bottom > maxBottomByLayer[layerIndex]) {
          maxBottomByLayer[layerIndex] = bottom;
        }
      });

      const currentStarts = new Map<number, number>();
      let currentCumulative = 0;
      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        currentStarts.set(index, currentCumulative);
        currentCumulative += layerHeights[index] ?? minHeight;
      });

      const constrainedHeights: number[] = [];
      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        const maxBottom = maxBottomByLayer[index];
        const requestedHeight = nextHeights[index] ?? minHeight;
        const currentStart = currentStarts.get(index) ?? 0;
        const requiredMin = maxBottom
          ? Math.max(minHeight, maxBottom - currentStart + layerPaddingY)
          : minHeight;
        const clamped = Math.min(maxHeight, Math.max(requestedHeight, requiredMin));
        constrainedHeights[index] = clamped;
      });

      const oldStarts = currentStarts;

      const newStarts = new Map<number, number>();
      let newCumulative = 0;
      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        newStarts.set(index, newCumulative);
        newCumulative += constrainedHeights[index] ?? minHeight;
      });

      const adjustedNodes = nodesRef.current.map((node) => {
        const isPinned = (node.data as { pinned?: boolean } | undefined)?.pinned === true;
        if (isPinned) {
          return node;
        }
        const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
        const oldStart = oldStarts.get(layerIndex) ?? 0;
        const newStart = newStarts.get(layerIndex) ?? 0;
        const nodeHeight = getNodeHeight(node);
        const relativeY = node.position.y - oldStart;
        const bandHeight = constrainedHeights[layerIndex] ?? minHeight;
        const minY = newStart + layerPaddingY;
        const maxY = newStart + Math.max(0, bandHeight - nodeHeight - layerPaddingY);
        const nextY = Math.min(Math.max(minY, newStart + relativeY), maxY);
        return {
          ...node,
          position: {
            ...node.position,
            y: nextY,
          },
        };
      });

      const didClamp = constrainedHeights[selectedLayerIndex] > requested;
      isUserLayerHeightChangeRef.current = true;
      setLayerHeights(constrainedHeights);
      setNodes(adjustedNodes);
      nodesRef.current = adjustedNodes;

      if (liveblocksService.isConnected()) {
        liveblocksService.updateLayerSettings({ layerHeights: constrainedHeights, layerOpacities });
        const batchUpdates = adjustedNodes.map((node) => {
          const currentData = node.data as { content?: string; sentiment?: string };
          return {
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            content: currentData.content,
            layer: (node.type === 'result' ? 1 : node.type === 'behavior' ? 2 : node.type === 'tangible_lever' ? 3 : 4),
            sentiment: currentData.sentiment || 'neutral',
          };
        });
        liveblocksService.batchUpdateNodePositions(batchUpdates);
      }

      if (didClamp) {
        alert('더 이상 줄이시려면 배치된 노드의 위치를 조정하셔야 합니다.');
      }
    },
    [layerHeights, layerOpacities, selectedLayerIndex, setNodes]
  );

  const handleLayerOpacityChange = useCallback(
    (value: number) => {
      if (selectedLayerIndex === null) return;
      const newOpacities = [...layerOpacities];
      newOpacities[selectedLayerIndex] = value;
      setLayerOpacities(newOpacities);
      if (liveblocksService.isConnected()) {
        liveblocksService.updateLayerSettings({ layerHeights, layerOpacities: newOpacities });
      }
    },
    [layerHeights, layerOpacities, selectedLayerIndex]
  );

  const hydrateFromLiveblocks = useCallback(
    (reason: string) => {
      if (!liveblocksService.isConnected()) {
        return;
      }

      const rawNotes = liveblocksService.getStickyNotes();
      const rawConnections = liveblocksService.getConnections();
      const hasRemoteData = rawNotes.length > 0 || rawConnections.length > 0;
      const hasLocalData =
        nodesRef.current.length > 0 || edgesRef.current.length > 0;

      if (!hasRemoteData && hasLocalData) {
        console.log('ℹ️ [React Flow] 초기 동기화 보류 (원격 비어 있음):', reason);
        return;
      }

      const mappedNotes = rawNotes.map(mapLiveblocksNoteToNoteData);
      const mappedConnections = rawConnections.map(mapLiveblocksConnectionToConnectionData);

      isHydratingRef.current = true;
      previousLayerStartsRef.current = null;

      const { nodes: flowNodes, edges: flowEdges } = convertToFlowData(
        mappedNotes,
        mappedConnections,
        handleNodeContentUpdate,
        {
          activeLocks: collaborationLocksRef.current,
          onNodeEditStart: handleStartNodeEditing,
          onNodeEditEnd: handleStopNodeEditing,
          onTogglePin: handleTogglePin,
          currentUserId: getCurrentUserId(),
          includeFrequency: isConsultingMode,
        }
      );

      const optimizedEdges = applyOptimalHandlesToEdges(flowNodes, flowEdges);

      setNodes(() => {
        nodesRef.current = flowNodes;
        return flowNodes;
      });
      setEdges(() => {
        edgesRef.current = optimizedEdges;
        return optimizedEdges;
      });

      requestAnimationFrame(() => {
        isHydratingRef.current = false;
      });

      onNotesChange(mappedNotes);
      onConnectionsChange(mappedConnections);

      console.log('✅ [React Flow] 세션 데이터 복원 완료:', {
        reason,
        notes: mappedNotes.length,
        connections: mappedConnections.length,
      });
    },
    [
      getCurrentUserId,
      handleNodeContentUpdate,
      handleStartNodeEditing,
      handleStopNodeEditing,
      isConsultingMode,
      onConnectionsChange,
      onNotesChange,
      setEdges,
      setNodes,
    ]
  );

  useLiveblocksSync({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    hydrateFromLiveblocks,
    handleNodeContentUpdate,
    handleStartNodeEditing,
    handleStopNodeEditing,
    setLayerHeights,
    setLayerOpacities,
    setShowLayerBackground,
    collaborationLocksRef,
    setCollaborationLocks,
    setReportContent,
    setSessionType,
    isConsultingMode: isConsultingMode ?? false
  });

  /* Removed old useEffect logic handled by useLiveblocksSync */

  useEffect(() => {
    const currentUserId = getCurrentUserId();

    setNodes(currentNodes =>
      currentNodes.map(node => {
        const lock = collaborationLocks[node.id];
        const isLockedByOther = Boolean(
          lock && lock.itemType === 'note' && lock.userId !== currentUserId
        );
        const lockLabel = lock?.displayName ?? lock?.userId;

        const currentData = node.data as Record<string, unknown>;
        const existingIsLocked = (currentData as { isLocked?: boolean }).isLocked ?? false;
        const existingLockedBy = (currentData as { lockedBy?: string }).lockedBy;
        const isPinned = (currentData as { pinned?: boolean }).pinned === true;
        const nextDraggable = !isPinned && !isLockedByOther;

        if (
          existingIsLocked === Boolean(isLockedByOther) &&
          existingLockedBy === lockLabel &&
          node.draggable === nextDraggable
        ) {
          return node;
        }

        return {
          ...node,
          draggable: nextDraggable,
          data: {
            ...currentData,
            isLocked: Boolean(isLockedByOther),
            lockedBy: lockLabel,
          },
        };
      })
    );
  }, [collaborationLocks, getCurrentUserId, setNodes]);

  // ============================================================================
  // AI 일괄 생성 기능
  // ============================================================================
  const handleGenerateFromAI = useCallback(async () => {
    if (!aiInput.trim()) {
      alert('AI 출력 텍스트를 입력해주세요.');
      return;
    }

    console.log('🤖 [React Flow] AI 일괄 생성 시작');

    try {
      // parseAIOutput로 텍스트 파싱
      const { notes: parsedNotes, connections: parsedConnections } = parseAIOutput(aiInput);

      console.log(`📊 [React Flow] 파싱 결과: 노드 ${parsedNotes.length}개, 연결선 ${parsedConnections.length}개`);

      if (parsedNotes.length === 0) {
        alert('유효한 노드를 찾을 수 없습니다. AI 출력 형식을 확인해주세요.');
        return;
      }

      // React Flow 데이터로 변환
      const { nodes: flowNodes, edges: flowEdges } = convertToFlowData(
        parsedNotes,
        parsedConnections,
        handleNodeContentUpdate,
        {
          activeLocks: collaborationLocks,
          onNodeEditStart: handleStartNodeEditing,
          onNodeEditEnd: handleStopNodeEditing,
          onTogglePin: handleTogglePin,
          currentUserId: getCurrentUserId(),
          includeFrequency: isConsultingMode,
        }
      );

      // 자동 레이아웃 적용
      const layouted = await getElkLayoutedElements(
        flowNodes,
        flowEdges,
        buildElkLayoutOptions(layoutSpacingRef.current)
      );

      // 상태 업데이트
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      nodesRef.current = layouted.nodes;
      edgesRef.current = layouted.edges;
      requestAnimationFrame(() => safeAutoLayout(false));

      // 로컬 notes/connections 상태도 업데이트
      onNotesChange(parsedNotes);
      onConnectionsChange(parsedConnections);

      // ⚡ Firebase 멀티유저 동기화
      console.log(`📤 [React Flow] Firebase 동기화 시작: ${parsedNotes.length}개 노드`);

      liveblocksService.clearMapData();

      parsedNotes.forEach((note, index) => {
        setTimeout(() => {
          const payload = {
            id: note.id,
            content: note.content || '',
            x: note.position.x,
            y: note.position.y,
            layer: note.layer || 1,
            sentiment: note.sentiment || 'neutral',
            type: note.type || 'sticky_note',
            width: note.width || 200,
            height: note.height || 120,
            ...(isConsultingMode && note.perceptionIntensity
              ? { frequency: note.perceptionIntensity }
              : {}),
          };

          liveblocksService.updateStickyNote(payload);
        }, index * 100); // 100ms 간격
      });

      parsedConnections.forEach((connection, index) => {
        setTimeout(
          () => {
            liveblocksService.updateConnection(connection as LBConnectionData);
          },
          parsedNotes.length * 100 + index * 50
        );
      });

      console.log('✅ [React Flow] AI 일괄 생성 및 Firebase 동기화 완료');

      // 입력 초기화
      setAiInput('');
      setShowAiInput(false);

      alert(`컬처맵 생성 완료! 노드 ${parsedNotes.length}개, 연결선 ${parsedConnections.length}개`);
    } catch (error) {
      console.error('❌ [React Flow] AI 일괄 생성 실패:', error);
      alert('AI 출력 파싱 중 오류가 발생했습니다. 형식을 확인해주세요.');
    }
  }, [
    aiInput,
    collaborationLocks,
    getCurrentUserId,
    handleNodeContentUpdate,
    handleStartNodeEditing,
    handleStopNodeEditing,
    isConsultingMode,
    setNodes,
    setEdges,
    onNotesChange,
    onConnectionsChange,
    safeAutoLayout
  ]);

  // 자동 레이아웃 실행 핸들러
  const handleAutoLayout = useCallback(() => {
    console.log('📐 [React Flow] 자동 레이아웃 실행');
    safeAutoLayout(true);
  }, [safeAutoLayout]);

  // ============================================================================
  // 노드 변경 핸들러 + Firebase 동기화
  // ============================================================================
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isHydratingRef.current) {
        const nextNodes = applyNodeChanges(changes, nodesRef.current);
        setNodes(nextNodes);
        nodesRef.current = nextNodes;
        return;
      }

      const currentUserId = getCurrentUserId();
      const filteredChanges = changes.filter((change) => {
        if (change.type !== 'position' || !change.position) return true;
        const targetNode = nodesRef.current.find((node) => node.id === change.id);
        if (!targetNode) return true;
        const isPinned = (targetNode.data as { pinned?: boolean } | undefined)?.pinned === true;
        const lock = collaborationLocksRef.current[change.id];
        const isLockedByOther = Boolean(
          lock && lock.itemType === 'note' && lock.userId !== currentUserId
        );
        return !(isPinned || isLockedByOther);
      });

      filteredChanges.forEach((change) => {
        if (change.type === 'position' && change.dragging) {
          draggingNodeIdsRef.current.add(change.id);
        }
        // NodeResizer로 크기 변경 중 추적
        if (change.type === 'dimensions' && change.resizing) {
          resizingNodeIdsRef.current.add(change.id);
        }
      });

      const layerIndexMap: Record<string, number> = {
        result: 0,
        behavior: 1,
        tangible_lever: 2,
        intangible_lever: 3,
      };
      const displayLayerOrder: Array<keyof typeof layerIndexMap> = [
        'result',
        'behavior',
        'tangible_lever',
        'intangible_lever',
      ];

      const getNodeHeight = (node: Node) => {
        if (typeof node.measured?.height === 'number') return node.measured.height;
        if (typeof node.height === 'number') return node.height;
        return 120;
      };

      const draftNodes = applyNodeChanges(filteredChanges, nodesRef.current);
      const maxBottomByLayer = [0, 0, 0, 0];
      draftNodes.forEach((node) => {
        const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
        const nodeHeight = getNodeHeight(node);
        const bottom = node.position.y + nodeHeight;
        if (bottom > maxBottomByLayer[layerIndex]) {
          maxBottomByLayer[layerIndex] = bottom;
        }
      });

      const layerPaddingY = 20;
      const minHeight = 100;
      const maxHeight = LAYER_MAX_HEIGHT;
      const currentLayerHeights = layerHeightsRef.current;
      const nextHeights: number[] = [];
      let hasExpansionAbove = false;

      const oldLayerStartByIndex = new Map<number, number>();
      let oldCumulativeY = 0;
      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        oldLayerStartByIndex.set(index, oldCumulativeY);
        oldCumulativeY += currentLayerHeights[index] ?? 0;
      });

      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        const maxBottom = maxBottomByLayer[index];
        const currentHeight = currentLayerHeights[index] ?? minHeight;
        const currentStart = oldLayerStartByIndex.get(index) ?? 0;
        const required = maxBottom
          ? Math.max(minHeight, maxBottom - currentStart + layerPaddingY)
          : minHeight;
        let nextHeight = required;
        if (required < currentHeight && hasExpansionAbove) {
          nextHeight = currentHeight;
        }
        const clamped = Math.min(maxHeight, Math.max(minHeight, nextHeight));
        nextHeights[index] = clamped;
        if (clamped > currentHeight) {
          hasExpansionAbove = true;
        }
      });

      const shouldUpdateHeights = nextHeights.some(
        (height, index) => height !== (currentLayerHeights[index] ?? minHeight)
      );
      const effectiveLayerHeights = shouldUpdateHeights ? nextHeights : currentLayerHeights;

      if (shouldUpdateHeights) {
        setLayerHeights(nextHeights);
        layerHeightsRef.current = nextHeights;
      }

      const layerStartByIndex = new Map<number, number>();
      let cumulativeY = 0;
      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        layerStartByIndex.set(index, cumulativeY);
        cumulativeY += effectiveLayerHeights[index] ?? 0;
      });

      const clampedChanges = filteredChanges.map((change) => {
        if (change.type !== 'position' || !change.position) return change;
        const node = draftNodes.find((n) => n.id === change.id) || nodesRef.current.find((n) => n.id === change.id);
        if (!node) return change;
        const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
        const bandStart = layerStartByIndex.get(layerIndex) ?? 0;
        const bandHeight = effectiveLayerHeights[layerIndex] ?? 0;
        const nodeHeight = getNodeHeight(node);
        const minY = bandStart + layerPaddingY;
        const maxY = bandStart + Math.max(0, bandHeight - nodeHeight - layerPaddingY);
        const clampedY = Math.min(Math.max(minY, maxY), Math.max(minY, change.position.y));
        if (clampedY === change.position.y) return change;
        return {
          ...change,
          position: {
            ...change.position,
            y: clampedY,
          },
        };
      });

      // 노드 겹침 방지: 드래그 완료 시 다른 노드와 겹치면 위치 조정
      const NODE_PADDING = 20; // 노드 간 최소 간격

      const getNodeWidth = (node: Node): number => {
        if (typeof node.measured?.width === 'number') return node.measured.width;
        if (typeof node.width === 'number') return node.width;
        return 200;
      };

      const resolveNodeOverlap = (nodes: Node[], changedNodeId: string): Node[] => {
        const changedNode = nodes.find(n => n.id === changedNodeId);
        if (!changedNode) return nodes;

        const changedNodeWidth = getNodeWidth(changedNode);
        const changedNodeHeight = getNodeHeight(changedNode);

        // 같은 층위의 다른 노드들과 겹침 확인
        const sameLayerNodes = nodes.filter(n => n.id !== changedNodeId && n.type === changedNode.type);

        let adjustedX = changedNode.position.x;
        let adjustedY = changedNode.position.y;
        let hasOverlap = true;
        let iterations = 0;
        const maxIterations = 10;

        while (hasOverlap && iterations < maxIterations) {
          hasOverlap = false;
          iterations++;

          for (const otherNode of sameLayerNodes) {
            const otherWidth = getNodeWidth(otherNode);
            const otherHeight = getNodeHeight(otherNode);

            // 겹침 감지 (패딩 포함)
            const isOverlappingX = adjustedX < otherNode.position.x + otherWidth + NODE_PADDING &&
              adjustedX + changedNodeWidth + NODE_PADDING > otherNode.position.x;
            const isOverlappingY = adjustedY < otherNode.position.y + otherHeight + NODE_PADDING &&
              adjustedY + changedNodeHeight + NODE_PADDING > otherNode.position.y;

            if (isOverlappingX && isOverlappingY) {
              hasOverlap = true;
              // X축으로 밀어내기 (더 가까운 방향으로)
              const pushLeft = otherNode.position.x - changedNodeWidth - NODE_PADDING;
              const pushRight = otherNode.position.x + otherWidth + NODE_PADDING;
              const distLeft = Math.abs(adjustedX - pushLeft);
              const distRight = Math.abs(adjustedX - pushRight);

              adjustedX = distLeft < distRight ? pushLeft : pushRight;
              break;
            }
          }
        }

        if (adjustedX !== changedNode.position.x || adjustedY !== changedNode.position.y) {
          return nodes.map(n => n.id === changedNodeId ? {
            ...n,
            position: { x: adjustedX, y: adjustedY }
          } : n);
        }

        return nodes;
      };

      let nextNodes = applyNodeChanges(clampedChanges, nodesRef.current);

      if (shouldUpdateHeights) {
        nextNodes = nextNodes.map((node) => {
          const isPinned = (node.data as { pinned?: boolean } | undefined)?.pinned === true;
          if (isPinned) {
            return node;
          }
          const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
          const oldStart = oldLayerStartByIndex.get(layerIndex) ?? 0;
          const newStart = layerStartByIndex.get(layerIndex) ?? 0;
          const offsetY = newStart - oldStart;
          if (offsetY === 0) {
            return node;
          }
          const nodeHeight = getNodeHeight(node);
          const bandHeight = effectiveLayerHeights[layerIndex] ?? 0;
          const minY = newStart + layerPaddingY;
          const maxY = newStart + Math.max(0, bandHeight - nodeHeight - layerPaddingY);
          const shiftedY = node.position.y + offsetY;
          const clampedY = Math.min(Math.max(minY, shiftedY), maxY);
          return {
            ...node,
            position: {
              ...node.position,
              y: clampedY,
            },
          };
        });
      }

      // 드래그 종료 시 겹침 방지 적용
      clampedChanges.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.position) {
          if (draggingNodeIdsRef.current.has(change.id)) {
            nextNodes = resolveNodeOverlap(nextNodes, change.id);
          }
        }
      });

      setNodes(nextNodes);
      nodesRef.current = nextNodes;

      // 위치 변경 완료 시 Firebase 동기화 (드래그 종료 케이스만)
      clampedChanges.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.position) {
          const wasDragging = draggingNodeIdsRef.current.has(change.id);
          if (!wasDragging) {
            return;
          }
          draggingNodeIdsRef.current.delete(change.id);
          const node = nextNodes.find((n) => n.id === change.id);
          if (node) {
            // 노드 타입에 따른 층위 계산
            const layerMap: { [key: string]: number } = {
              result: 1,
              behavior: 2,
              tangible_lever: 3,
              intangible_lever: 4,
            };

            const layer = layerMap[node.type || 'result'] || 1;
            const activeLock = collaborationLocksRef.current[node.id];
            const currentUserId = getCurrentUserId();
            const isLockedByOther = Boolean(
              activeLock &&
              activeLock.itemType === 'note' &&
              activeLock.userId !== currentUserId
            );

            if (isLockedByOther) {
              return;
            }

            const nodeFrequency = isConsultingMode
              ? ((node.data as { frequency?: PerceptionIntensity | null }).frequency ?? undefined)
              : undefined;

            liveblocksService.updateStickyNote({
              id: node.id,
              content: (node.data as { content?: string }).content || '',
              x: change.position.x,
              y: change.position.y,
              layer: layer,
              sentiment: (node.data as { sentiment?: string }).sentiment || 'neutral',
              type: node.type || 'sticky_note',
              width: (node.width as number) || 200,
              height: (node.height as number) || 120,
              ...(isConsultingMode && nodeFrequency ? { frequency: nodeFrequency } : {}),
            });

            console.log('📤 [React Flow] Firebase 노드 동기화:', {
              id: node.id,
              position: change.position,
              layer,
            });
          }
        }

        // 리사이즈 완료 시 크기 동기화 (NodeResizer)
        if (change.type === 'dimensions' && !change.resizing && change.dimensions) {
          const wasResizing = resizingNodeIdsRef.current.has(change.id);
          if (!wasResizing) {
            return;
          }
          resizingNodeIdsRef.current.delete(change.id);
          const node = nextNodes.find((n) => n.id === change.id);
          if (node) {
            const layerMap: { [key: string]: number } = {
              result: 1,
              behavior: 2,
              tangible_lever: 3,
              intangible_lever: 4,
            };
            const layer = layerMap[node.type || 'result'] || 1;
            const activeLock = collaborationLocksRef.current[node.id];
            const currentUserId = getCurrentUserId();
            const isLockedByOther = Boolean(
              activeLock &&
              activeLock.itemType === 'note' &&
              activeLock.userId !== currentUserId
            );

            if (isLockedByOther) {
              return;
            }

            const nodeFrequency = isConsultingMode
              ? ((node.data as { frequency?: PerceptionIntensity | null }).frequency ?? undefined)
              : undefined;

            liveblocksService.updateStickyNote({
              id: node.id,
              content: (node.data as { content?: string }).content || '',
              x: node.position.x,
              y: node.position.y,
              layer: layer,
              sentiment: (node.data as { sentiment?: string }).sentiment || 'neutral',
              type: node.type || 'sticky_note',
              width: change.dimensions.width,
              height: change.dimensions.height,
              ...(isConsultingMode && nodeFrequency ? { frequency: nodeFrequency } : {}),
            });

            console.log('📐 [React Flow] Firebase 노드 크기 동기화:', {
              id: node.id,
              dimensions: change.dimensions,
              layer,
            });
          }
        }
      });

      // 로컬 상태 업데이트
      const updatedData = convertFromFlowData(nodesRef.current, edgesRef.current);
      onNotesChange(updatedData.notes);
    },
    [getCurrentUserId, layerHeights, isConsultingMode, onNotesChange, setNodes]
  );

  // ============================================================================
  // 엣지 변경 핸들러 + Firebase 동기화
  // ============================================================================
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const previousEdges = edgesRef.current;
      const nextEdges = applyEdgeChanges(changes, previousEdges);
      setEdges(nextEdges);
      edgesRef.current = nextEdges;

      // 엣지 삭제 시 Firebase 동기화
      changes.forEach((change) => {
        if (change.type === 'remove') {
          liveblocksService.deleteConnection(change.id);
          console.log('🗑️ [React Flow] Firebase 연결선 삭제:', change.id);
        }
      });

      // 로컬 상태 업데이트
      const updatedData = convertFromFlowData(nodesRef.current, edgesRef.current);
      onConnectionsChange(updatedData.connections);
    },
    [onConnectionsChange, setEdges]
  );

  // ============================================================================
  // 새 연결 생성 + 속성 기반 색상 자동 계산
  // ============================================================================
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // 노드 속성에 따른 연결선 색상 자동 계산
      const sourceSentiment =
        (sourceNode?.data as { sentiment?: string })?.sentiment || 'neutral';
      const targetSentiment =
        (targetNode?.data as { sentiment?: string })?.sentiment || 'neutral';

      let edgeColor = '#10b981'; // 기본 초록색
      let isPositive = true;

      // 긍정↔긍정: 초록색
      if (sourceSentiment === 'positive' && targetSentiment === 'positive') {
        edgeColor = '#10b981';
        isPositive = true;
      }
      // 긍정↔부정 또는 부정↔긍정: 빨강색
      else if (
        (sourceSentiment === 'positive' && targetSentiment === 'negative') ||
        (sourceSentiment === 'negative' && targetSentiment === 'positive')
      ) {
        edgeColor = '#ef4444';
        if (!ensureLiveblocksConnected('노드 빈도 변경')) {
          return;
        }
        isPositive = false;
      }
      // 부정↔부정: 빨강색
      else if (sourceSentiment === 'negative' && targetSentiment === 'negative') {
        edgeColor = '#ef4444';
        isPositive = false;
      }
      // 중립 포함: 회색
      else {
        edgeColor = '#6b7280';
        isPositive = true;
      }

      let resolvedSourceHandle = params.sourceHandle;
      let resolvedTargetHandle = params.targetHandle;

      if ((!resolvedSourceHandle || !resolvedTargetHandle) && sourceNode && targetNode) {
        const handles = getOptimalHandles(sourceNode, targetNode);
        resolvedSourceHandle = resolvedSourceHandle ?? handles.sourceHandle;
        resolvedTargetHandle = resolvedTargetHandle ?? handles.targetHandle;
      }

      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: resolvedSourceHandle,
        targetHandle: resolvedTargetHandle,
        type: 'animatedFlow',
        style: {
          strokeWidth: 2,
          stroke: edgeColor,
        },
        markerEnd: {
          type: 'arrowclosed',
          width: 20,
          height: 20,
          color: edgeColor,
        },
        data: {
          relationType: 'direct',
          isPositive,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));

      // Firebase 실시간 동기화 (핸들 정보 포함)
      liveblocksService.updateConnection({
        id: newEdge.id,
        sourceId: params.source!,
        targetId: params.target!,
        relationType: 'direct',
        isPositive: isPositive,
        sourceHandle: resolvedSourceHandle ?? undefined,
        targetHandle: resolvedTargetHandle ?? undefined,
      });

      console.log('🔗 [React Flow] Firebase 연결선 생성:', {
        id: newEdge.id,
        color: edgeColor,
        isPositive,
      });

      // 로컬 상태 업데이트
      const updatedData = convertFromFlowData(nodes, [...edges, newEdge]);
      onConnectionsChange(updatedData.connections);
    },
    [edges, nodes, setEdges, onConnectionsChange, ensureLiveblocksConnected]
  );


  // ============================================================================
  // AI 일괄 생성 패널 열기
  // ============================================================================

  // ============================================================================
  // 선택 변경 핸들러
  // ============================================================================
  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);
    setSelectedEdges(params.edges);
  }, []);

  const handleViewportChange = useCallback(
    (_event: unknown, nextViewport: { x: number; y: number; zoom: number }) => {
      setViewport(nextViewport);
    },
    []
  );

  const handleReactFlowInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    setViewport(instance.getViewport());
  }, []);

  const lastPresenceUpdateRef = useRef(0);

  // Liveblocks useOthers 훅으로 다른 사용자 커서 가져오기
  // ⚠️ selector는 반드시 pure function이어야 함 - console.log 등 side effect 금지!
  const otherCursors = useOthers((others) =>
    others
      .filter((other) => other.presence?.cursor != null || other.presence?.cursorClient != null)
      .map((other) => ({
        id: String(other.connectionId),
        x: other.presence.cursor?.x,
        y: other.presence.cursor?.y,
        clientX: other.presence.cursorClient?.x,
        clientY: other.presence.cursorClient?.y,
        userName: other.presence.userName,
        userColor: other.presence.userColor,
      }))
  );
  const updateMyPresence = useUpdateMyPresence();

  // 디버깅용: selector 외부에서 로그 (useEffect 사용)
  useEffect(() => {
    if (otherCursors.length > 0) {
      console.log('👁️ [Cursor] otherCursors:', otherCursors.length, otherCursors);
    }
  }, [otherCursors]);

  const updateCursorPresence = useCallback((clientX: number, clientY: number) => {
    const now = performance.now();
    if (now - lastPresenceUpdateRef.current < 50) return;
    lastPresenceUpdateRef.current = now;

    const cursor = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY })
      : null;

    // Liveblocks React 훅으로 presence 업데이트
    updateMyPresence({
      cursor,
      cursorClient: { x: clientX, y: clientY },
    });
  }, [reactFlowInstance, updateMyPresence]);

  const handlePaneMouseMove = useCallback((event: React.MouseEvent) => {
    updateCursorPresence(event.clientX, event.clientY);
  }, [updateCursorPresence]);

  const handleWrapperMouseMove = useCallback((event: React.MouseEvent) => {
    updateCursorPresence(event.clientX, event.clientY);
  }, [updateCursorPresence]);

  const handlePaneMouseLeave = useCallback(() => {
    // Liveblocks React 훅으로 presence 업데이트
    updateMyPresence({ cursor: null, cursorClient: null });
  }, [updateMyPresence]);

  const handleWrapperMouseLeave = useCallback(() => {
    updateMyPresence({ cursor: null, cursorClient: null });
  }, [updateMyPresence]);

  // ============================================================================
  // 노드 클릭 이벤트
  // ============================================================================
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('Clicked node:', node.id);
  }, []);

  // ============================================================================
  // 노드 더블클릭 → 편집 시작 (충돌 방지)
  // ============================================================================
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('🖊️ [React Flow] 노드 편집 시작:', node.id);
    // Firebase에 편집 시작 알림 (추후 구현 가능)
    // TODO: editing-started 이벤트 발송
  }, []);

  // ============================================================================
  // 컨텍스트 메뉴 (우클릭)
  // ============================================================================
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.react-flow__node') || target?.closest('.react-flow__edge')) {
        return;
      }
      console.log('🎯 handlePaneContextMenu called', { x: event.clientX, y: event.clientY });
      event.preventDefault();
      event.stopPropagation();

      if (!reactFlowInstance) {
        console.warn('⚠️ reactFlowInstance not available');
        return;
      }

      const projector = reactFlowInstance as ReactFlowInstance & {
        screenToFlowPosition?: (position: { x: number; y: number }) => {
          x: number;
          y: number;
        };
        project?: (position: { x: number; y: number }) => { x: number; y: number };
      };

      const projected =
        projector.screenToFlowPosition?.({ x: event.clientX, y: event.clientY }) ??
        projector.project?.({ x: event.clientX, y: event.clientY }) ??
        { x: event.clientX, y: event.clientY };

      console.log('📍 Context menu position:', { screen: { x: event.clientX, y: event.clientY }, flow: projected });

      const newContextMenu = {
        x: event.clientX,
        y: event.clientY,
        type: 'pane' as const,
        flowPosition: projected,
      };
      console.log('🔥 Setting contextMenu state:', newContextMenu);
      setContextMenu(newContextMenu);
    },
    [reactFlowInstance]
  );

  const handleWrapperContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.react-flow__node') || target?.closest('.react-flow__edge')) {
        return;
      }

      if (target?.closest('.react-flow__pane') || target?.closest('.react-flow')) {
        handlePaneContextMenu(event);
        return;
      }

      event.preventDefault();
    },
    [handlePaneContextMenu]
  );

  const handleNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      targetId: node.id,
    });
  }, []);

  // 모바일용 포스트잇 생성 함수
  const handleMobileAddNote = useCallback((nodeType: 'result' | 'behavior' | 'tangible_lever' | 'intangible_lever') => {
    if (!reactFlowInstance) return;
    if (!ensureLiveblocksConnected('모바일 노드 생성')) {
      return;
    }

    // 화면 중앙에 노드 생성
    const viewport = reactFlowInstance.getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

    const layerMap: { [key: string]: number } = {
      result: 1,
      behavior: 2,
      tangible_lever: 3,
      intangible_lever: 4,
    };

    const newNodeId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: nodeType,
      position: { x: centerX - 100, y: centerY - 60 }, // 중앙 정렬
      data: {
        id: newNodeId,
        layer: layerMap[nodeType],
        content: '새 노트',
        sentiment: 'neutral',
        onUpdate: handleNodeContentUpdate,
        onEditStart: handleStartNodeEditing,
        onEditEnd: handleStopNodeEditing,
        onTogglePin: handleTogglePin,
        pinned: false,
        isLocked: false,
        lockedBy: undefined,
      },
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);

    const { notes: updatedNotes } = convertFromFlowData(updatedNodes, edges);
    onNotesChange(updatedNotes);

    // Firebase 동기화
    liveblocksService.updateStickyNote({
      id: newNodeId,
      content: '새 노트',
      x: newNode.position.x,
      y: newNode.position.y,
      layer: layerMap[nodeType],
      sentiment: 'neutral',
      type: nodeType,
      width: 200,
      height: 120,
    });

    console.log('📱 [Mobile] 새 노드 생성:', newNodeId, nodeType);
    setShowMobileAddMenu(false);
  }, [ensureLiveblocksConnected, reactFlowInstance, nodes, edges, onNotesChange, handleNodeContentUpdate, handleStartNodeEditing, handleStopNodeEditing, setNodes]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'edge',
      targetId: edge.id,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    console.log('🚪 closeContextMenu called');
    setContextMenu(null);
  }, []);

  // 컨텍스트 메뉴 액션
  const handleContextMenuAction = useCallback(
    (action: string) => {
      if (!contextMenu) return;

      if (contextMenu.type === 'pane' && (action === 'pin_selected' || action === 'unpin_selected')) {
        if (!hasSelectedNodes) {
          return;
        }
        handleBulkPin(selectedNodeIds, action === 'pin_selected');
        closeContextMenu();
        return;
      }

      if (contextMenu.type === 'pane' && action.startsWith('selection_')) {
        if (!hasSelectedNodes) {
          return;
        }

        const currentUserId = getCurrentUserId();
        const targetIdSet = new Set(selectedNodeIds);
        const canEditNode = (node: Node) => {
          const activeLock = collaborationLocksRef.current[node.id];
          return !(
            activeLock &&
            activeLock.itemType === 'note' &&
            activeLock.userId !== currentUserId
          );
        };

        if (
          action === 'selection_positive'
          || action === 'selection_negative'
          || action === 'selection_neutral'
        ) {
          if (!ensureLiveblocksConnected('선택 노드 속성 변경')) {
            return;
          }

          const sentiment = action.replace('selection_', '') as 'positive' | 'negative' | 'neutral';
          const updatedIds = new Set<string>();

          const updatedNodes = nodes.map((node) => {
            if (!targetIdSet.has(node.id) || !canEditNode(node)) {
              return node;
            }
            updatedIds.add(node.id);
            return {
              ...node,
              data: {
                ...node.data,
                sentiment,
              },
            };
          });

          const recalculatedEdges = edges.map((edge) => {
            if (!updatedIds.has(edge.source) && !updatedIds.has(edge.target)) {
              return edge;
            }

            const sourceNode = updatedNodes.find((n) => n.id === edge.source);
            const targetNode = updatedNodes.find((n) => n.id === edge.target);

            const sourceSentiment =
              (sourceNode?.data as { sentiment?: string })?.sentiment || 'neutral';
            const targetSentiment =
              (targetNode?.data as { sentiment?: string })?.sentiment || 'neutral';

            let edgeColor = '#10b981';
            let isPositive = true;

            if (sourceSentiment === 'positive' && targetSentiment === 'positive') {
              edgeColor = '#10b981';
              isPositive = true;
            } else if (
              (sourceSentiment === 'positive' && targetSentiment === 'negative')
              || (sourceSentiment === 'negative' && targetSentiment === 'positive')
            ) {
              edgeColor = '#ef4444';
              isPositive = false;
            } else if (sourceSentiment === 'negative' && targetSentiment === 'negative') {
              edgeColor = '#ef4444';
              isPositive = false;
            } else {
              edgeColor = '#6b7280';
              isPositive = true;
            }

            liveblocksService.updateConnection({
              id: edge.id,
              sourceId: edge.source,
              targetId: edge.target,
              relationType:
                (edge.data as { relationType?: string })?.relationType === 'indirect'
                  ? 'indirect'
                  : 'direct',
              isPositive,
              sourceHandle: edge.sourceHandle ?? undefined,
              targetHandle: edge.targetHandle ?? undefined,
            });

            return {
              ...edge,
              style: {
                ...edge.style,
                stroke: edgeColor,
              },
              markerEnd: {
                type: 'arrowclosed' as const,
                width: 20,
                height: 20,
                color: edgeColor,
              },
              data: { ...edge.data, isPositive },
            };
          });

          setNodes(updatedNodes);
          setEdges(recalculatedEdges);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            recalculatedEdges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);

          const layerMap: { [key: string]: number } = {
            result: 1,
            behavior: 2,
            tangible_lever: 3,
            intangible_lever: 4,
          };

          updatedNodes.forEach((node) => {
            if (!updatedIds.has(node.id)) {
              return;
            }
            const updatedFrequency = isConsultingMode
              ? ((node.data as { frequency?: PerceptionIntensity | null })?.frequency ?? undefined)
              : undefined;
            liveblocksService.updateStickyNote({
              id: node.id,
              content: (node.data as { content?: string }).content || '',
              x: node.position.x,
              y: node.position.y,
              layer: layerMap[node.type || 'result'] || 1,
              sentiment,
              type: node.type || 'sticky_note',
              width: (node.width as number) || 200,
              height: (node.height as number) || 120,
              ...(isConsultingMode && updatedFrequency ? { frequency: updatedFrequency } : {}),
            });
          });

          closeContextMenu();
          return;
        }

        if (action === 'selection_delete') {
          if (!ensureLiveblocksConnected('선택 노드 삭제')) {
            return;
          }

          const deletableIds = new Set<string>();
          selectedNodeIds.forEach((id) => {
            const node = nodes.find((item) => item.id === id);
            if (node && canEditNode(node)) {
              deletableIds.add(id);
            }
          });

          if (!deletableIds.size) {
            closeContextMenu();
            return;
          }

          const edgesToDelete = edges.filter(
            (edge) => deletableIds.has(edge.source) || deletableIds.has(edge.target)
          );

          const updatedNodes = nodes.filter((node) => !deletableIds.has(node.id));
          const updatedEdges = edges.filter(
            (edge) => !deletableIds.has(edge.source) && !deletableIds.has(edge.target)
          );

          setNodes(updatedNodes);
          setEdges(updatedEdges);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            updatedEdges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);

          deletableIds.forEach((id) => liveblocksService.deleteStickyNote(id));
          edgesToDelete.forEach((edge) => liveblocksService.deleteConnection(edge.id));

          closeContextMenu();
          return;
        }

        if (action.startsWith('selection_set_type_')) {
          if (!ensureLiveblocksConnected('선택 노드 유형 변경')) {
            return;
          }

          const typeMap: Record<string, { nodeType: string; layer: number }> = {
            selection_set_type_result: { nodeType: 'result', layer: 1 },
            selection_set_type_behavior: { nodeType: 'behavior', layer: 2 },
            selection_set_type_tangible_lever: { nodeType: 'tangible_lever', layer: 3 },
            selection_set_type_intangible_lever: { nodeType: 'intangible_lever', layer: 4 },
          };

          const target = typeMap[action];
          if (!target) {
            return;
          }

          const updatedIds = new Set<string>();
          const updatedNodes = nodes.map((node) => {
            if (!targetIdSet.has(node.id) || !canEditNode(node)) {
              return node;
            }
            updatedIds.add(node.id);
            return {
              ...node,
              type: target.nodeType,
              data: {
                ...node.data,
                layer: target.layer,
              },
            };
          });

          setNodes(updatedNodes);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            edges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);

          updatedNodes.forEach((node) => {
            if (!updatedIds.has(node.id)) {
              return;
            }
            const updatedFrequency = isConsultingMode
              ? ((node.data as { frequency?: PerceptionIntensity | null })?.frequency ?? undefined)
              : undefined;
            liveblocksService.updateStickyNote({
              id: node.id,
              content: (node.data as { content?: string }).content || '',
              x: node.position.x,
              y: node.position.y,
              layer: target.layer,
              sentiment: (node.data as { sentiment?: string }).sentiment || 'neutral',
              type: target.nodeType,
              width: (node.width as number) || 200,
              height: (node.height as number) || 120,
              ...(isConsultingMode && updatedFrequency ? { frequency: updatedFrequency } : {}),
            });
          });

          closeContextMenu();
          return;
        }
      }

      // 빈 캔버스 우클릭 → 노드 생성
      if (contextMenu.type === 'pane' && action.startsWith('create_')) {
        if (!ensureLiveblocksConnected('노드 생성')) {
          return;
        }
        const nodeType = action.replace('create_', '');
        const newNodeId = `node-${Date.now()}`;

        const basePosition = contextMenu.flowPosition;
        const nodePosition = {
          x: basePosition.x - 100,
          y: basePosition.y - 60,
        };

        const newNode: Node = {
          id: newNodeId,
          type: nodeType,
          position: nodePosition,
          data: {
            content: '새 노트',
            sentiment: 'neutral',
            onUpdate: handleNodeContentUpdate,
            onEditStart: handleStartNodeEditing,
            onEditEnd: handleStopNodeEditing,
            onTogglePin: handleTogglePin,
            pinned: false,
            isLocked: false,
            lockedBy: undefined,
          },
        };

        const updatedNodes = [...nodes, newNode];
        setNodes(updatedNodes);

        const { notes: updatedNotes } = convertFromFlowData(updatedNodes, edges);
        onNotesChange(updatedNotes);

        // Firebase 동기화
        const layerMap: { [key: string]: number } = {
          result: 1,
          behavior: 2,
          tangible_lever: 3,
          intangible_lever: 4,
        };

        liveblocksService.updateStickyNote({
          id: newNodeId,
          content: '새 노트',
          x: nodePosition.x,
          y: nodePosition.y,
          layer: layerMap[nodeType] || 1,
          sentiment: 'neutral',
          type: nodeType,
          width: 200,
          height: 120,
        });

        console.log('📌 [React Flow] 새 노드 생성:', newNodeId, nodeType);
        closeContextMenu();
        return;
      }

      if (contextMenu.type === 'node') {
        const node = nodes.find((n) => n.id === contextMenu.targetId);
        if (!node) return;

        if (action === 'delete') {
          if (!ensureLiveblocksConnected('노드 삭제')) {
            return;
          }
          const edgesToDelete = edges.filter(
            (edge) => edge.source === contextMenu.targetId || edge.target === contextMenu.targetId
          );
          // 노드 삭제
          const updatedNodes = nodes.filter((n) => n.id !== contextMenu.targetId);
          const updatedEdges = edges.filter(
            (e) => e.source !== contextMenu.targetId && e.target !== contextMenu.targetId
          );

          setNodes(updatedNodes);
          setEdges(updatedEdges);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            updatedEdges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);
          liveblocksService.deleteStickyNote(contextMenu.targetId!);
          edgesToDelete.forEach((edge) => liveblocksService.deleteConnection(edge.id));
        } else if (action === 'positive' || action === 'negative' || action === 'neutral') {
          if (!ensureLiveblocksConnected('노드 색상 변경')) {
            return;
          }
          // 색상 변경 + Firebase 동기화 + 연결선 색상 재계산
          const updatedNodes = nodes.map((n) =>
            n.id === contextMenu.targetId ? { ...n, data: { ...n.data, sentiment: action } } : n
          );

          const recalculatedEdges = edges.map((e) => {
            if (e.source !== contextMenu.targetId && e.target !== contextMenu.targetId) {
              return e;
            }

            const sourceNode = updatedNodes.find((n) => n.id === e.source);
            const targetNode = updatedNodes.find((n) => n.id === e.target);

            const sourceSentiment =
              (sourceNode?.data as { sentiment?: string })?.sentiment || 'neutral';
            const targetSentiment =
              (targetNode?.data as { sentiment?: string })?.sentiment || 'neutral';

            let edgeColor = '#10b981';
            let isPositive = true;

            if (sourceSentiment === 'positive' && targetSentiment === 'positive') {
              edgeColor = '#10b981';
              isPositive = true;
            } else if (
              (sourceSentiment === 'positive' && targetSentiment === 'negative') ||
              (sourceSentiment === 'negative' && targetSentiment === 'positive')
            ) {
              edgeColor = '#ef4444';
              isPositive = false;
            } else if (sourceSentiment === 'negative' && targetSentiment === 'negative') {
              edgeColor = '#ef4444';
              isPositive = false;
            } else {
              edgeColor = '#6b7280';
              isPositive = true;
            }

            liveblocksService.updateConnection({
              id: e.id,
              sourceId: e.source,
              targetId: e.target,
              relationType:
                (e.data as { relationType?: string })?.relationType === 'indirect'
                  ? 'indirect'
                  : 'direct',
              isPositive,
              sourceHandle: e.sourceHandle ?? undefined,
              targetHandle: e.targetHandle ?? undefined,
            });

            return {
              ...e,
              style: {
                ...e.style,
                stroke: edgeColor,
              },
              markerEnd: {
                type: 'arrowclosed' as const,
                width: 20,
                height: 20,
                color: edgeColor,
              },
              data: { ...e.data, isPositive },
            };
          });

          setNodes(updatedNodes);
          setEdges(recalculatedEdges);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            recalculatedEdges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);

          const layerMap: { [key: string]: number } = {
            result: 1,
            behavior: 2,
            tangible_lever: 3,
            intangible_lever: 4,
          };

          const updatedNode = updatedNodes.find((n) => n.id === node.id);
          const updatedFrequency = isConsultingMode
            ? ((updatedNode?.data as { frequency?: PerceptionIntensity | null })?.frequency ?? undefined)
            : undefined;

          liveblocksService.updateStickyNote({
            id: node.id,
            content: (node.data as { content?: string }).content || '',
            x: node.position.x,
            y: node.position.y,
            layer: layerMap[node.type || 'result'] || 1,
            sentiment: action,
            type: node.type || 'sticky_note',
            width: (node.width as number) || 200,
            height: (node.height as number) || 120,
            ...(isConsultingMode && updatedFrequency ? { frequency: updatedFrequency } : {}),
          });
        } else if (action.startsWith('set_type_')) {
          if (!ensureLiveblocksConnected('노드 유형 변경')) {
            return;
          }

          const typeMap: Record<string, { nodeType: string; layer: number }> = {
            set_type_result: { nodeType: 'result', layer: 1 },
            set_type_behavior: { nodeType: 'behavior', layer: 2 },
            set_type_tangible_lever: { nodeType: 'tangible_lever', layer: 3 },
            set_type_intangible_lever: { nodeType: 'intangible_lever', layer: 4 },
          };

          const target = typeMap[action];
          if (!target) {
            return;
          }

          const activeLock = collaborationLocksRef.current[node.id];
          const currentUserId = getCurrentUserId();
          const isLockedByOther = Boolean(
            activeLock &&
            activeLock.itemType === 'note' &&
            activeLock.userId !== currentUserId
          );

          if (isLockedByOther) {
            return;
          }

          const updatedNodes = nodes.map((n) =>
            n.id === contextMenu.targetId
              ? {
                ...n,
                type: target.nodeType,
                data: {
                  ...n.data,
                  layer: target.layer,
                },
              }
              : n
          );

          setNodes(updatedNodes);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            edges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);

          const updatedNode = updatedNodes.find((n) => n.id === node.id);
          const updatedFrequency = isConsultingMode
            ? ((updatedNode?.data as { frequency?: PerceptionIntensity | null })?.frequency ?? undefined)
            : undefined;

          liveblocksService.updateStickyNote({
            id: node.id,
            content: (node.data as { content?: string }).content || '',
            x: node.position.x,
            y: node.position.y,
            layer: target.layer,
            sentiment: (node.data as { sentiment?: string }).sentiment || 'neutral',
            type: target.nodeType,
            width: (node.width as number) || 200,
            height: (node.height as number) || 120,
            ...(isConsultingMode && updatedFrequency ? { frequency: updatedFrequency } : {}),
          });
        } else if (
          action === 'frequency_high' ||
          action === 'frequency_medium' ||
          action === 'frequency_low' ||
          action === 'frequency_remove'
        ) {
          // 빈도 설정 (컨설팅 모드)
          const frequencyMap: { [key: string]: PerceptionIntensity } = {
            frequency_high: 'high',
            frequency_medium: 'medium',
            frequency_low: 'low',
            frequency_remove: null,
          };

          const newFrequency = frequencyMap[action];

          const updatedNodes = nodes.map((n) =>
            n.id === contextMenu.targetId ? { ...n, data: { ...n.data, frequency: newFrequency } } : n
          );

          setNodes(updatedNodes);

          const { notes: updatedNotes, connections: updatedConnections } = convertFromFlowData(
            updatedNodes,
            edges
          );
          onNotesChange(updatedNotes);
          onConnectionsChange(updatedConnections);

          const layerMap: { [key: string]: number } = {
            result: 1,
            behavior: 2,
            tangible_lever: 3,
            intangible_lever: 4,
          };

          liveblocksService.updateStickyNote({
            id: node.id,
            content: (node.data as { content?: string }).content || '',
            x: node.position.x,
            y: node.position.y,
            layer: layerMap[node.type || 'result'] || 1,
            sentiment: (node.data as { sentiment?: string }).sentiment || 'neutral',
            type: node.type || 'sticky_note',
            width: (node.width as number) || 200,
            height: (node.height as number) || 120,
            ...(isConsultingMode ? { frequency: newFrequency } : {}),
          });
        }
      } else if (contextMenu.type === 'edge') {
        const edge = edges.find((e) => e.id === contextMenu.targetId);
        if (!edge) return;

        if (action === 'delete') {
          if (!ensureLiveblocksConnected('연결선 삭제')) {
            return;
          }
          // 엣지 삭제
          const updatedEdges = edges.filter((e) => e.id !== contextMenu.targetId);
          setEdges(updatedEdges);
          edgesRef.current = updatedEdges;

          const { connections: updatedConnections } = convertFromFlowData(nodes, updatedEdges);
          onConnectionsChange(updatedConnections);
          liveblocksService.deleteConnection(contextMenu.targetId!);
        } else if (action === 'direct' || action === 'indirect') {
          if (!ensureLiveblocksConnected('연결선 유형 변경')) {
            return;
          }
          // 점선/실선 전환 + Firebase 동기화
          const updatedEdges = edges.map((e) =>
            e.id === contextMenu.targetId
              ? {
                ...e,
                animated: false, // 애니메이션은 사용하지 않음
                style: {
                  ...e.style,
                  strokeDasharray: action === 'indirect' ? '5 5' : undefined,
                },
                data: { ...e.data, relationType: action },
              }
              : e
          );

          setEdges(updatedEdges);
          edgesRef.current = updatedEdges;

          const { connections: updatedConnections } = convertFromFlowData(nodes, updatedEdges);
          onConnectionsChange(updatedConnections);

          liveblocksService.updateConnection({
            id: edge.id,
            sourceId: edge.source,
            targetId: edge.target,
            relationType: action,
            isPositive: (edge.data as { isPositive?: boolean })?.isPositive !== false,
            sourceHandle: edge.sourceHandle ?? undefined,
            targetHandle: edge.targetHandle ?? undefined,
          });
        }
      }

      closeContextMenu();
    },
    [
      contextMenu,
      nodes,
      edges,
      setNodes,
      setEdges,
      closeContextMenu,
      ensureLiveblocksConnected,
      handleBulkPin,
      handleNodeContentUpdate,
      handleStartNodeEditing,
      handleStopNodeEditing,
      onConnectionsChange,
      onNotesChange,
      isConsultingMode,
      hasSelectedNodes,
      selectedNodeIds,
    ]
  );

  // PromptGenerator에서 맵 생성 (AI 텍스트 파싱)

  // 렌더링 시점 로그 (contextMenu가 열릴 때만 출력하여 로그 폭탄 방지)
  if (contextMenu !== null) {
    console.log('🎨 [Render] contextMenu opened:', contextMenu);
  }

  return (
    <div className="culture-map-flow-wrapper" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100vh',  // 뷰포트 기준 고정 (아코디언 펼쳐도 높이 변하지 않음)
      overflow: 'hidden', // 자식 요소가 부모를 넘치지 못하게
      ...(applyStyleVariables(styleVariables) as CSSProperties)
    }}>
      {/* 상단 바 */}
      <div className="culture-top-bar no-print">
        <div className="top-bar-left">
          <h1 className="top-bar-title">
            <span role="img" aria-label="map icon">🗺️</span>
            조직문화 분석기
          </h1>

          {/* 탭 전환 버튼 */}
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'map' ? 'tab-button--active' : ''}`}
              type="button"
              onClick={() => setActiveTab('map')}
            >
              🗺️ 컬쳐맵
            </button>
            <button
              className={`tab-button ${activeTab === 'report' ? 'tab-button--active' : ''}`}
              type="button"
              onClick={() => setActiveTab('report')}
            >
              📄 보고서
            </button>
          </div>

          <button
            className="glass-circle-button"
            type="button"
            onClick={() => setShowHelpModal(true)}
          >
            ?
          </button>
        </div>

        <div className="top-bar-right">
          {/* 컬쳐맵 내보내기 메뉴 */}
          {showExportMenu && (
            <Suspense fallback={<div className="lazy-loading">로딩...</div>}>
              <ExportMenu
                reactFlowInstance={reactFlowInstance}
                nodes={nodes}
                edges={edges}
                onSaveSnapshot={handleSaveSnapshot}
                onRestoreSnapshot={handleRestoreSnapshot}
                onUndoLayout={handleUndoLayout}
              />
            </Suspense>
          )}

          {/* 세션 정보 */}
          {(() => {
            const session = liveblocksService.getCurrentSession();

            return session ? (
              <>
                <button
                  className="glass-button glass-button--accent"
                  type="button"
                  onClick={() => setShowSessionInfo(true)}
                  title="세션 관리 및 접속 안내"
                >
                  🔗 세션 관리
                </button>
                <button
                  className="glass-button"
                  type="button"
                  onClick={() => {
                    if (window.confirm('세션에서 나가시겠습니까?\n\n작업 내용은 저장됩니다.')) {
                      localStorage.removeItem('culture-map-last-session');
                      liveblocksService.leaveSession();
                      window.location.reload();
                    }
                  }}
                  title="세션 나가기"
                >
                  🚪 나가기
                </button>
              </>
            ) : (
              <span style={{ fontSize: '14px', color: '#6b7280' }}>세션 연결 중...</span>
            );
          })()}

          {/* Clear All 버튼 */}
          <button
            className="glass-button glass-button--danger"
            type="button"
            onClick={() => {
              if (window.confirm('⚠️ 모든 노드와 연결선을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
                // 모든 노드와 엣지 삭제
                setNodes([]);
                setEdges([]);
                onNotesChange([]);
                onConnectionsChange([]);

                // Liveblocks 저장소 일괄 초기화
                liveblocksService.clearMapData();

                console.log('🗑️ [React Flow] 전체 삭제 완료');
              }
            }}
          >
            🗑️ 전체 삭제
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="culture-map-flow-container" style={{
        display: 'flex',
        width: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden' // 자식(left-panel, flowWrapperRef)이 부모 높이 초과 방지
      }}>

        {/* 컬쳐맵 탭 */}
        {activeTab === 'map' && (
          <>
            {/* 왼쪽 사이드메뉴 - 데스크톱만 표시 */}
            {!isMobile && (
              <div className="left-panel no-print" style={{
                position: 'relative',
                width: `${sidebarWidth}px`,
                minWidth: `${sidebarWidth}px`,
                height: '100%',
                overflowY: 'auto',
                borderRight: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                wordBreak: 'keep-all',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}>
                <AIChatSidebar
                  onActionExecute={handleAiAction}
                  notes={aiContext.notes}
                  connections={aiContext.connections}
                  layerHeights={layerHeights}
                  passwordType={mode}
                />

                {/* 리사이즈 핸들 */}
                <div
                  onMouseDown={handleMouseDown}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '5px',
                    height: '100%',
                    cursor: 'col-resize',
                    backgroundColor: isResizing ? '#3b82f6' : 'transparent',
                    transition: isResizing ? 'none' : 'background-color 0.2s',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => {
                    if (!isResizing) e.currentTarget.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                />
              </div>
            )}

            {/* 모바일 사이드바 오버레이 */}
            {isMobile && isMobileSidebarOpen && (
              <>
                {/* 배경 오버레이 */}
                <div
                  onClick={() => setIsMobileSidebarOpen(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 999,
                    animation: 'fadeIn 0.3s ease'
                  }}
                />

                {/* 슬라이드 사이드바 */}
                <div
                  className="mobile-sidebar-panel"
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '85%',
                    maxWidth: '320px',
                    height: '100%',
                    backgroundColor: '#f9fafb',
                    zIndex: 1000,
                    overflowY: 'auto',
                    boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
                    animation: 'slideInLeft 0.3s ease'
                  }}
                >
                  {/* 닫기 버튼 */}
                  <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>조직문화 분석기</h2>
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      style={{
                        border: 'none',
                        background: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        color: '#6b7280'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <AIChatSidebar
                    onActionExecute={handleAiAction}
                    notes={aiContext.notes}
                    connections={aiContext.connections}
                    layerHeights={layerHeights}
                    passwordType={mode}
                  />
                </div>
              </>
            )}

            {/* 메인 React Flow 영역 */}
            <div
              ref={flowWrapperRef}
              data-capture-root="true"
              style={{ position: 'relative', flex: '1 1 0', overflow: 'hidden' }}
              onMouseMove={handleWrapperMouseMove}
              onMouseLeave={handleWrapperMouseLeave}
              onContextMenu={handleWrapperContextMenu}
            >
              {/* 모바일 햄버거 버튼 */}
              {isMobile && (
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    zIndex: 10,
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ☰
                </button>
              )}

              {/* 모바일 제스처 가이드 */}
              <MobileGestureGuide />
              {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onlyRenderVisibleElements={true}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onSelectionChange={handleSelectionChange}
                onMove={handleViewportChange}
                onPaneMouseMove={handlePaneMouseMove}
                onPaneMouseLeave={handlePaneMouseLeave}
                onPaneContextMenu={handlePaneContextMenu}
                onNodeContextMenu={handleNodeContextMenu}
                onEdgeContextMenu={handleEdgeContextMenu}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'animatedFlow' }}
                connectionMode={ConnectionMode.Loose}
                fitView={!isMobile} // 모바일: fitView 비활성화 (전체 캔버스 자유 이동)
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: isMobile ? 0.5 : 0.8 }} // 모바일: 더 작은 줌으로 전체 보기
                translateExtent={translateExtent} // 팬(이동) 범위 제한: 가로 3200px, 세로는 층위 높이 합
                proOptions={{ hideAttribution: true }}
                // 모바일/데스크톱 구분 제스처 설정
                panOnDrag={isMobile ? true : [1, 2]} // 모바일: 빈 공간 터치로 팬, 데스크톱: 중간/우클릭 팬
                panOnScroll={false}
                zoomOnScroll={!isMobile} // 모바일: 스크롤 줌 비활성화
                zoomOnPinch={true} // 모바일: 핀치 줌만 활성화
                zoomOnDoubleClick={false}
                preventScrolling={true}
                // 모바일 제스처 및 다중 선택
                selectionOnDrag={!isMobile} // 모바일: 드래그 선택 비활성화 (노드 드래그와 충돌 방지)
                panActivationKeyCode="Space" // 데스크톱: 스페이스바로 팬 가능
                // 성능 최적화
                nodesDraggable={true} // 노드 드래그는 항상 활성화
                nodesConnectable={true}
                elementsSelectable={true}
                onInit={handleReactFlowInit}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

                {/* 층위 배경 레이어 (ViewportPortal 사용 - transform 적용됨) */}
                <LayerBackground
                  showLayerBackground={showLayerBackground}
                  layerDefinitions={layerDefinitions}
                  layerHeights={layerHeights}
                  layerOpacities={layerOpacities}
                  selectedLayerIndex={selectedLayerIndex}
                  onLayerLabelClick={handleLayerLabelClick}
                />

                <LayerControlPanel
                  isMobile={isMobile}
                  showLayerControlPanel={showLayerControlPanel}
                  showLayerBackground={showLayerBackground}
                  selectedLayerIndex={selectedLayerIndex}
                  layerHeights={layerHeights}
                  layerOpacities={layerOpacities}
                  layerMaxHeight={LAYER_MAX_HEIGHT}
                  onOpenPanel={() => setShowLayerControlPanel(true)}
                  onClosePanel={() => setShowLayerControlPanel(false)}
                  onToggleLayerBackground={() => setShowLayerBackground(!showLayerBackground)}
                  onSelectLayerIndex={(index) => setSelectedLayerIndex(index)}
                  onChangeLayerHeight={handleLayerHeightChange}
                  onChangeLayerOpacity={handleLayerOpacityChange}
                />

                {/* Controls의 top 제거 - 기본 위치(top: 10px) 사용 */}
                {showControls && <Controls style={{ left: 16, bottom: 'auto' }} />}
                {showMiniMap && (
                  <MiniMap
                    nodeStrokeWidth={3}
                    zoomable
                    pannable
                    nodeColor={(node) => {
                      const data = node.data as { sentiment?: string };
                      const sentiment = data.sentiment || 'neutral';

                      // sentiment에 따른 색상 반환
                      if (sentiment === 'positive') return '#10b981'; // 녹색
                      if (sentiment === 'negative') return '#ef4444'; // 빨강
                      return '#6b7280'; // 회색 (중립)
                    }}
                    style={{
                      backgroundColor: '#f8f9fa',
                    }}
                  />
                )}
              </ReactFlow>

              {/* 다른 사용자 커서 - ViewportPortal 대신 상단 오버레이 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              >
                {otherCursors.map((cursor) => {
                  const bounds = flowWrapperRef.current?.getBoundingClientRect();
                  const flowX = cursor.x;
                  const flowY = cursor.y;
                  const clientX = cursor.clientX;
                  const clientY = cursor.clientY;
                  const hasFlowCoords = typeof flowX === 'number' && typeof flowY === 'number';
                  const hasClientCoords = typeof clientX === 'number' && typeof clientY === 'number';
                  const screenPosition = hasFlowCoords
                    ? reactFlowInstance?.flowToScreenPosition({
                      x: flowX,
                      y: flowY,
                    })
                    : undefined;
                  const screenX = screenPosition
                    ? screenPosition.x - (bounds?.left ?? 0)
                    : hasClientCoords
                      ? (clientX ?? 0) - (bounds?.left ?? 0)
                      : (flowX ?? 0) * viewport.zoom + viewport.x;
                  const screenY = screenPosition
                    ? screenPosition.y - (bounds?.top ?? 0)
                    : hasClientCoords
                      ? (clientY ?? 0) - (bounds?.top ?? 0)
                      : (flowY ?? 0) * viewport.zoom + viewport.y;

                  return (
                    <div
                      key={cursor.id}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        transform: `translate(${screenX}px, ${screenY}px)`,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: cursor.userColor || '#8b5cf6',
                          boxShadow: '0 0 6px rgba(0, 0, 0, 0.35)',
                        }}
                      />
                      <div
                        style={{
                          marginTop: 4,
                          padding: '2px 6px',
                          borderRadius: 6,
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          fontSize: 10,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cursor.userName ?? '참여자'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div> {/* 메인 React Flow 영역 닫기 */}
          </>
        )} {/* 컬쳐맵 탭 닫기 */}

        {/* 보고서 탭 */}
        {activeTab === 'report' && (
          <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '24px' }}>
            <Suspense fallback={<div className="lazy-loading">보고서 에디터 로딩 중...</div>}>
              <ReportEditor
                initialContent={reportContent}
                onSave={handleReportChange}
                onGenerateReport={handleGenerateReport}
                isGenerating={isGeneratingReport}
              />
            </Suspense>
          </div>
        )}

      </div> {/* culture-map-flow-container 닫기 */}

      {/* AI 일괄 생성 입력 패널 */}
      {showAiInput && (
        <div className="ai-input-panel">
          <div className="ai-input-header">
            <h3>🤖 AI 출력 텍스트 입력</h3>
            <button onClick={() => setShowAiInput(false)}>✕</button>
          </div>
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="AI가 생성한 Culture Map 텍스트를 붙여넣으세요...(예시)&#10;[결과] (긍정) 프로젝트 성공률 향상&#10;[행동] (부정) 보고 절차가 복잡하다&#10;[유형_레버] (부정) 다단계 승인 구조 (저자: 막스 베버, 이론: 계층제 이론, 연도: 1922)"
            className="ai-input-textarea"
          />
          <button onClick={handleGenerateFromAI} className="ai-generate-submit">
            📊 컬처맵 생성하기
          </button>
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="react-flow-context-menu"
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
          }}
          onMouseLeave={closeContextMenu}
        >
          {contextMenu.type === 'pane' && (
            <>
              {!hasSelectedNodes && (
                <>
                  <button
                    className="context-menu-section-toggle"
                    onClick={() => toggleContextSection('pane', 'create')}
                    type="button"
                  >
                    <span className="context-menu-section-label">
                      <PlusSquare className="context-menu-icon" />
                      새 노트 생성
                    </span>
                    <ChevronDown className={`context-menu-chevron ${contextMenuSections.pane.create ? 'open' : ''}`} />
                  </button>
                  {contextMenuSections.pane.create && (
                    <div className="context-menu-section-body">
                      <button onClick={() => handleContextMenuAction('create_result')}>
                        <Target className="context-menu-icon icon-result" />
                        결과
                      </button>
                      <button onClick={() => handleContextMenuAction('create_behavior')}>
                        <Activity className="context-menu-icon icon-behavior" />
                        행동
                      </button>
                      <button onClick={() => handleContextMenuAction('create_tangible_lever')}>
                        <Box className="context-menu-icon icon-tangible" />
                        유형
                      </button>
                      <button onClick={() => handleContextMenuAction('create_intangible_lever')}>
                        <Cloud className="context-menu-icon icon-intangible" />
                        무형
                      </button>
                    </div>
                  )}
                </>
              )}
              {hasSelectedNodes && (
                <>
                  <div className="context-menu-divider" />
                  <button
                    className="context-menu-section-toggle"
                    onClick={() => toggleContextSection('pane', 'selection')}
                    type="button"
                  >
                    <span className="context-menu-section-label">
                      <Pin className="context-menu-icon" />
                      선택 노드 ({selectedNodes.length})
                    </span>
                    <ChevronDown
                      className={`context-menu-chevron ${contextMenuSections.pane.selection ? 'open' : ''}`}
                    />
                  </button>
                  {contextMenuSections.pane.selection && (
                    <div className="context-menu-section-body">
                      <button onClick={() => handleContextMenuAction('pin_selected')}>
                        <Pin className="context-menu-icon" />
                        전체 고정
                      </button>
                      <button onClick={() => handleContextMenuAction('unpin_selected')}>
                        <PinOff className="context-menu-icon" />
                        전체 고정해제
                      </button>
                      <div className="context-menu-divider" />
                      <div className="context-menu-section-body context-menu-grid-3">
                        <button onClick={() => handleContextMenuAction('selection_positive')}>
                          <Smile className="context-menu-icon icon-positive" />
                          긍정
                        </button>
                        <button onClick={() => handleContextMenuAction('selection_neutral')}>
                          <Minus className="context-menu-icon icon-neutral" />
                          중립
                        </button>
                        <button onClick={() => handleContextMenuAction('selection_negative')}>
                          <Frown className="context-menu-icon icon-negative" />
                          부정
                        </button>
                      </div>
                      <div className="context-menu-divider" />
                      <div className="context-menu-section-body context-menu-grid-2">
                        <button onClick={() => handleContextMenuAction('selection_set_type_result')}>
                          <Target className="context-menu-icon icon-result" />
                          결과
                        </button>
                        <button onClick={() => handleContextMenuAction('selection_set_type_behavior')}>
                          <Activity className="context-menu-icon icon-behavior" />
                          행동
                        </button>
                        <button onClick={() => handleContextMenuAction('selection_set_type_tangible_lever')}>
                          <Box className="context-menu-icon icon-tangible" />
                          유형
                        </button>
                        <button onClick={() => handleContextMenuAction('selection_set_type_intangible_lever')}>
                          <Cloud className="context-menu-icon icon-intangible" />
                          무형
                        </button>
                      </div>
                      <div className="context-menu-divider" />
                      <button onClick={() => handleContextMenuAction('selection_delete')}>
                        <Trash2 className="context-menu-icon" />
                        선택 삭제
                      </button>
                    </div>
                  )}
                </>
              )}
              {!hasSelectedNodes && (
                <>
                  <div className="context-menu-divider" />
                  <button
                    className="context-menu-section-toggle"
                    onClick={() => toggleContextSection('pane', 'layout')}
                    type="button"
                  >
                    <span className="context-menu-section-label">
                      <LayoutGrid className="context-menu-icon" />
                      정렬
                    </span>
                    <ChevronDown className={`context-menu-chevron ${contextMenuSections.pane.layout ? 'open' : ''}`} />
                  </button>
                  {contextMenuSections.pane.layout && (
                    <div className="context-menu-section-body">
                      <button
                        onClick={() => {
                          handleAutoLayout();
                          closeContextMenu();
                        }}
                      >
                        <LayoutGrid className="context-menu-icon" />
                        노드 정렬
                      </button>
                      <button
                        onClick={() => {
                          rerouteEdges();
                          closeContextMenu();
                        }}
                      >
                        <Route className="context-menu-icon" />
                        연결선 정렬
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {contextMenu.type === 'node' && (
            <>
              <button
                className="context-menu-section-toggle"
                onClick={() => toggleContextSection('node', 'attributes')}
                type="button"
              >
                <span className="context-menu-section-label">
                  <SlidersHorizontal className="context-menu-icon" />
                  속성 변경
                </span>
                <ChevronDown className={`context-menu-chevron ${contextMenuSections.node.attributes ? 'open' : ''}`} />
              </button>
              {contextMenuSections.node.attributes && (
                <div className="context-menu-section-body context-menu-grid-3">
                  <button onClick={() => handleContextMenuAction('positive')}>
                    <Smile className="context-menu-icon icon-positive" />
                    긍정
                  </button>
                  <button onClick={() => handleContextMenuAction('neutral')}>
                    <Minus className="context-menu-icon icon-neutral" />
                    중립
                  </button>
                  <button onClick={() => handleContextMenuAction('negative')}>
                    <Frown className="context-menu-icon icon-negative" />
                    부정
                  </button>
                </div>
              )}

              {isConsultingMode && (
                <>
                  <div className="context-menu-divider" />
                  <button
                    className="context-menu-section-toggle"
                    onClick={() => toggleContextSection('node', 'frequency')}
                    type="button"
                  >
                    <span className="context-menu-section-label">
                      <BarChart3 className="context-menu-icon" />
                      빈도 설정
                    </span>
                    <ChevronDown className={`context-menu-chevron ${contextMenuSections.node.frequency ? 'open' : ''}`} />
                  </button>
                  {contextMenuSections.node.frequency && (
                    <div className="context-menu-section-body">
                      <button onClick={() => handleContextMenuAction('frequency_high')}>
                        <ArrowUp className="context-menu-icon icon-high" />
                        빈도多
                      </button>
                      <button onClick={() => handleContextMenuAction('frequency_medium')}>
                        <Minus className="context-menu-icon icon-medium" />
                        빈도中
                      </button>
                      <button onClick={() => handleContextMenuAction('frequency_low')}>
                        <ArrowDown className="context-menu-icon icon-low" />
                        빈도少
                      </button>
                      <button onClick={() => handleContextMenuAction('frequency_remove')}>
                        <X className="context-menu-icon icon-muted" />
                        빈도 제거
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="context-menu-divider" />
              <button
                className="context-menu-section-toggle"
                onClick={() => toggleContextSection('node', 'type')}
                type="button"
              >
                <span className="context-menu-section-label">
                  <Layers className="context-menu-icon" />
                  유형 변경
                </span>
                <ChevronDown className={`context-menu-chevron ${contextMenuSections.node.type ? 'open' : ''}`} />
              </button>
              {contextMenuSections.node.type && (
                <div className="context-menu-section-body context-menu-grid-2">
                  <button onClick={() => handleContextMenuAction('set_type_result')}>
                    <Target className="context-menu-icon icon-result" />
                    결과
                  </button>
                  <button onClick={() => handleContextMenuAction('set_type_behavior')}>
                    <Activity className="context-menu-icon icon-behavior" />
                    행동
                  </button>
                  <button onClick={() => handleContextMenuAction('set_type_tangible_lever')}>
                    <Box className="context-menu-icon icon-tangible" />
                    유형
                  </button>
                  <button onClick={() => handleContextMenuAction('set_type_intangible_lever')}>
                    <Cloud className="context-menu-icon icon-intangible" />
                    무형
                  </button>
                </div>
              )}

              <div className="context-menu-divider" />
              <div className="context-menu-section-body">
                <button onClick={() => handleContextMenuAction('delete')}>
                  <Trash2 className="context-menu-icon" />
                  삭제
                </button>
              </div>
            </>
          )}
          {contextMenu.type === 'edge' && (
            <>
              <button
                className="context-menu-section-toggle"
                onClick={() => toggleContextSection('edge', 'settings')}
                type="button"
              >
                <span className="context-menu-section-label">
                  <Link2 className="context-menu-icon" />
                  연결선 설정
                </span>
                <ChevronDown className={`context-menu-chevron ${contextMenuSections.edge.settings ? 'open' : ''}`} />
              </button>
              {contextMenuSections.edge.settings && (
                <div className="context-menu-section-body">
                  <button onClick={() => handleContextMenuAction('direct')}>
                    <Link2 className="context-menu-icon" />
                    실선 (직접)
                  </button>
                  <button onClick={() => handleContextMenuAction('indirect')}>
                    <Route className="context-menu-icon" />
                    점선 (간접)
                  </button>
                </div>
              )}
              <div className="context-menu-divider" />
              <div className="context-menu-section-body">
                <button onClick={() => handleContextMenuAction('delete')}>
                  <Trash2 className="context-menu-icon" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 모바일 포스트잇 추가 FAB 버튼 */}
      {isMobile && activeTab === 'map' && (
        <button
          className="mobile-add-fab"
          onClick={() => setShowMobileAddMenu(true)}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
        >
          ➕
        </button>
      )}

      {/* 모바일 포스트잇 타입 선택 모달 */}
      {showMobileAddMenu && (
        <div
          className="mobile-add-menu-overlay"
          onClick={() => setShowMobileAddMenu(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 10001,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div
            className="mobile-add-menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              animation: 'slideUp 0.3s ease',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              📌 포스트잇 타입 선택
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => handleMobileAddNote('result')}
                style={{
                  padding: '16px',
                  fontSize: '16px',
                  backgroundColor: '#E3F2FD',
                  border: '2px solid #2196F3',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '500',
                }}
              >
                <span style={{ fontSize: '20px', marginRight: '8px' }}>🎯</span>
                결과 (가시적 요소)
              </button>
              <button
                onClick={() => handleMobileAddNote('behavior')}
                style={{
                  padding: '16px',
                  fontSize: '16px',
                  backgroundColor: '#FFF3E0',
                  border: '2px solid #FF9800',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '500',
                }}
              >
                <span style={{ fontSize: '20px', marginRight: '8px' }}>👥</span>
                행동 (관찰 행동)
              </button>
              <button
                onClick={() => handleMobileAddNote('tangible_lever')}
                style={{
                  padding: '16px',
                  fontSize: '16px',
                  backgroundColor: '#E8F5E9',
                  border: '2px solid #4CAF50',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '500',
                }}
              >
                <span style={{ fontSize: '20px', marginRight: '8px' }}>📋</span>
                유형 레버 (규범/가치)
              </button>
              <button
                onClick={() => handleMobileAddNote('intangible_lever')}
                style={{
                  padding: '16px',
                  fontSize: '16px',
                  backgroundColor: '#F3E5F5',
                  border: '2px solid #9C27B0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '500',
                }}
              >
                <span style={{ fontSize: '20px', marginRight: '8px' }}>💡</span>
                무형 레버 (기본 가정)
              </button>
            </div>
            <button
              onClick={() => setShowMobileAddMenu(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 세션 정보 모달 */}
      {showSessionInfo && (() => {
        const session = liveblocksService.getCurrentSession();
        return session ? (
          <div
            className="connection-guide-overlay"
            onClick={() => setShowSessionInfo(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <SessionInfoPanel
                sessionCode={session.code}
                sessionName={session.name}
                isHost={session.isHost}
                connectedUsers={session.connectedUsers}
                onClose={() => setShowSessionInfo(false)}
              />
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
};

export default CultureMapFlow;
