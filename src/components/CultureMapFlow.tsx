// src/components/CultureMapFlow.tsx - 완전히 재작성된 버전
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ViewportPortal,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
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
import {
  ResultNode,
  BehaviorNode,
  TangibleLeverNode,
  IntangibleLeverNode,
} from './flow-nodes';
import MobileGestureGuide from './MobileGestureGuide';
import AIChatSidebar from './AIChatSidebar'; // 좌측 사이드메뉴 (AI 챗봇)
import { useIsMobile } from '../hooks/useResponsive'; // 반응형 훅 추가
import ExportMenu from './ExportMenu'; // 컬쳐맵 내보내기 메뉴
import ReportEditor from './ReportEditor'; // 보고서 편집기

// 타입
import type { NoteData, ConnectionData, PerceptionIntensity } from '../types/culture';
import type { AiAction, BatchConnectionInput, BatchNodeInput } from '../types/actions';
import { INTENSITY_MAP } from '../types/culture';
import type { StickyNoteData, ConnectionData as LBConnectionData, LayerSettings } from '../types/liveblocks';

// 유틸리티
import { convertToFlowData, convertFromFlowData } from '../utils/flowDataConverter';
import { buildElkLayoutOptions, getElkLayoutedElements } from '../utils/flowAutoLayout';
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

  return {
    id: note.id,
    content: note.content ?? '',
    position: { x: note.x, y: note.y },
    width: note.width ?? 200,
    height: note.height ?? 120,
    type: noteType,
    sentiment,
    perceptionIntensity: note.frequency ?? undefined,
    basis: note.basis,
    layer: toLayerValue(note.layer, noteType),
  };
};

const mapLiveblocksConnectionToConnectionData = (
  connection: LBConnectionData
): ConnectionData => ({
  id: connection.id,
  sourceId: connection.sourceId,
  targetId: connection.targetId,
  relationType: connection.relationType === 'indirect' ? 'indirect' : 'direct',
  isPositive: connection.isPositive !== false,
});

const CultureMapFlow = ({
  onNotesChange,
  onConnectionsChange,
  onNodeUpdate,
}: CultureMapFlowProps) => {
  // 세션 타입 기반 모드 결정
  const currentSession = liveblocksService.getCurrentSession();
  const mode = (currentSession?.type || 'workshop') as 'workshop' | 'consulting';
  const isConsultingMode = mode === 'consulting';

  // React Flow 노드/엣지 상태
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const layoutSpacingRef = useRef<'compact' | 'normal' | 'wide'>('normal');
  const previousLayerStartsRef = useRef<number[] | null>(null);
  const isHydratingRef = useRef(false);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const pendingActionsRef = useRef<AiAction[]>([]);
  const flushScheduledRef = useRef(false);
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

  const applyLayerSettings = useCallback((settings: LayerSettings | null, reason: string) => {
    if (!settings) return;

    applyingLayerSettingsRef.current = true;
    setLayerHeights(settings.layerHeights);
    setLayerOpacities(settings.layerOpacities);

    requestAnimationFrame(() => {
      applyingLayerSettingsRef.current = false;
    });

    console.log('✅ [React Flow] 레이어 설정 복원:', { reason, settings });
  }, []);

  // AI 일괄 생성 입력 상태
  const [aiInput, setAiInput] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);

  // 탭 시스템 상태 (컬쳐맵 / 보고서)
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map');
  const [reportContent, setReportContent] = useState(''); // 보고서 내용
  const [isGeneratingReport, setIsGeneratingReport] = useState(false); // AI 보고서 생성 중

  // 선택된 노드/엣지 상태 (추후 활용 가능)
  const [, setSelectedNodes] = useState<Node[]>([]);
  const [, setSelectedEdges] = useState<Edge[]>([]);

  // 보고서 내용 변경 핸들러 (컨설팅 모드에서만 Firebase에 저장)
  const handleReportChange = useCallback((content: string) => {
    setReportContent(content);

    // 컨설팅 모드에서만 Firebase에 저장
    if (isConsultingMode) {
      liveblocksService.updateReportContent(content);
    }
  }, [isConsultingMode]);

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

      // 컨설팅 모드에서는 Firebase에도 저장
      if (isConsultingMode) {
        liveblocksService.updateReportContent(htmlContent);
      }

    } catch (error) {
      console.error('❌ 보고서 생성 실패:', error);
      alert(`보고서 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [isGeneratingReport, isConsultingMode]);

  // 보고서 내용 Firebase 동기화 (컨설팅 모드에서만)
  useEffect(() => {
    if (!isConsultingMode) return;

    const unsubscribe = liveblocksService.onReportContent((content) => {
      setReportContent(content);
    });

    return unsubscribe;
  }, [isConsultingMode]);

  // AI 인사이트 Liveblocks 동기화
  useEffect(() => {
    let unsubscribeInsights = () => { };

    const syncInsights = () => {
      if (!liveblocksService.isConnected()) {
        return;
      }

      const currentInsights = liveblocksService.getInsights();
      if (currentInsights.length > 0) {
        aiService.setInsights(currentInsights);
      }

      unsubscribeInsights();
      unsubscribeInsights = liveblocksService.onInsights((insights) => {
        aiService.setInsights(insights);
      });
    };

    syncInsights();
    liveblocksService.on('sync-complete', syncInsights);

    return () => {
      liveblocksService.off('sync-complete', syncInsights);
      unsubscribeInsights();
    };
  }, []);

  // 층위별 개별 높이 조절 상태 (레거시 모드와 동일)
  const [layerHeights, setLayerHeights] = useState<number[]>([220, 220, 220, 220]); // [결과, 행동, 유형, 무형]
  const [layerOpacities, setLayerOpacities] = useState<number[]>([1, 1, 1, 1]); // 층위별 투명도
  const [showLayerBackground, setShowLayerBackground] = useState(true);

  const applyingLayerSettingsRef = useRef(false);

  // 선택된 층위 (높이 조절용, null = 선택 없음)
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(0);

  // translateExtent 동적 계산 (층위 높이 변경 시 자동 업데이트)
  const totalHeight = layerHeights.reduce((sum, height) => sum + height, 0);
  const translateExtent: [[number, number], [number, number]] = [
    [-100, -100],  // 좌상단 여유 공간
    [3200, totalHeight + 100],  // 우하단 (가로 3200px, 세로는 총 층위 높이 + 여유)
  ];

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

  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [collaborationLocks, setCollaborationLocks] = useState<Record<string, CollaborationLock>>({});
  const collaborationLocksRef = useRef<Record<string, CollaborationLock>>({});

  const safeAutoLayout = useCallback(async (showAlert = false) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (!currentNodes.length) {
      console.warn('⚠️ [React Flow] auto_layout 중단: 노드가 비어 있습니다.', {
        nodes: currentNodes.length,
        edges: currentEdges.length,
      });
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = await getElkLayoutedElements(
      currentNodes,
      currentEdges,
      buildElkLayoutOptions(layoutSpacingRef.current)
    );

    if (!layoutedNodes.length || layoutedNodes.length !== currentNodes.length) {
      console.warn('⚠️ [React Flow] auto_layout 중단: 레이아웃 결과가 비정상입니다.', {
        before: currentNodes.length,
        after: layoutedNodes.length,
      });
      return;
    }

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

    const layerPaddingY = 40;
    const maxHeightsByLayer = [0, 0, 0, 0];

    layoutedNodes.forEach((node) => {
      const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
      const nodeHeight = getNodeHeight(node);
      if (nodeHeight > maxHeightsByLayer[layerIndex]) {
        maxHeightsByLayer[layerIndex] = nodeHeight;
      }
    });

    const resolvedLayerHeights = layerHeights.map((height, index) => {
      const required = maxHeightsByLayer[index] + layerPaddingY;
      return Math.min(800, Math.max(height, required));
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

    const adjustedNodes = layoutedNodes.map((node) => {
      const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
      const bandStart = layerStartByIndex.get(layerIndex) ?? 0;
      const bandHeight = resolvedLayerHeights[layerIndex] ?? 0;
      const nodeHeight = getNodeHeight(node);
      const centeredY = bandStart + Math.max(0, (bandHeight - nodeHeight) / 2);
      return {
        ...node,
        position: {
          x: node.position.x,
          y: centeredY,
        },
      };
    });

    setNodes(adjustedNodes);
    setEdges(layoutedEdges);

    adjustedNodes.forEach((node) => {
      const currentData = node.data as { content?: string; sentiment?: string };
      liveblocksService.updateStickyNote({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        content: currentData.content,
        layer: (node.type === 'result' ? 1 : node.type === 'behavior' ? 2 : node.type === 'tangible_lever' ? 3 : 4),
        sentiment: currentData.sentiment || 'neutral'
      });
    });

    if (showAlert) {
      alert('컬처맵이 데이브 그레이 모델 구조에 맞춰 정렬되었습니다.');
    }
  }, [setEdges, setNodes]);

  // AI 액션 실행 핸들러 (배치 처리)
  const executeAiAction = useCallback((action: AiAction) => {
    console.log('🤖 [Action Bridge] AI 액션 실행:', action);
    const { name, args } = action;

    const requiresSync = [
      'add_node',
      'add_nodes_with_connections',
      'update_node',
      'delete_node',
      'delete_connection',
      'create_connection',
    ];

    if (requiresSync.includes(name) && !ensureLiveblocksConnected('AI 액션')) {
      return;
    }

    switch (name) {
      case 'add_node': {
        const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const layerIndex = (args.layer || 2) - 1;

        let currentY = 0;
        for (let i = 0; i < layerIndex; i++) {
          currentY += layerHeights[i];
        }
        const defaultY = currentY + (layerHeights[layerIndex] / 2);

        const existingNodesInLayer = nodesRef.current.filter(n => n.data?.layer === args.layer).length;
        const baseX = 150 + (existingNodesInLayer * 220);
        const x = args.x || baseX;
        const y = args.y || defaultY + (Math.random() * 20 - 10);

        const typeMap: Record<string, string> = {
          '결과': 'result',
          '행동': 'behavior',
          '유형_레버': 'tangible_lever',
          '무형_레버': 'intangible_lever',
          'result': 'result',
          'behavior': 'behavior',
          'tangible_lever': 'tangible_lever',
          'intangible_lever': 'intangible_lever',
        };
        const nodeType = typeMap[args.type] || 'result';

        const content = args.content || args.label || '새 노드';
        const sentiment = args.sentiment === 'positive' ? 'positive' : (args.sentiment === 'negative' ? 'negative' : 'neutral');
        const frequency = typeof args.intensity === 'number' ? INTENSITY_MAP.TO_STRING(args.intensity) : (args.intensity || '보통');

        liveblocksService.updateStickyNote({
          id: newNodeId,
          content,
          x,
          y,
          layer: args.layer || 2,
          sentiment,
          type: nodeType,
          frequency,
        });

        const newNode: Node = {
          id: newNodeId,
          type: nodeType,
          position: { x, y },
          data: {
            id: newNodeId,
            content,
            author: liveblocksService.getCurrentUserDisplayName(),
            timestamp: Date.now(),
            sentiment,
            frequency,
            type: nodeType,
            layer: args.layer || 2,
          },
          draggable: true,
        };

        setNodes((nds) => {
          const updated = nds.concat(newNode);
          nodesRef.current = updated;
          return updated;
        });
        console.log('✅ [Action Bridge] New node added to UI:', newNodeId, 'type:', nodeType, 'layer:', args.layer);
        break;
      }

      case 'add_nodes_with_connections': {
        const nodeInputs = Array.isArray(args.nodes) ? (args.nodes as BatchNodeInput[]) : [];
        const connectionInputs = Array.isArray(args.connections) ? (args.connections as BatchConnectionInput[]) : [];

        if (!nodeInputs.length) break;

        const typeMap: Record<string, string> = {
          '결과': 'result',
          '행동': 'behavior',
          '유형_레버': 'tangible_lever',
          '무형_레버': 'intangible_lever',
          'result': 'result',
          'behavior': 'behavior',
          'tangible_lever': 'tangible_lever',
          'intangible_lever': 'intangible_lever',
        };

        const layerCounts = new Map<number, number>();
        nodesRef.current.forEach((node) => {
          const layerValue = typeof node.data?.layer === 'number' ? node.data.layer : undefined;
          if (layerValue) {
            layerCounts.set(layerValue, (layerCounts.get(layerValue) ?? 0) + 1);
          }
        });

        const idMap: Record<string, string> = {};
        const newNodes: Node[] = [];
        const batchTimestamp = Date.now();

        nodeInputs.forEach((input, index) => {
          const layerValue = typeof input.layer === 'number' ? input.layer : 2;
          const layerIndex = Math.max(1, Math.min(4, layerValue)) - 1;
          const currentCount = layerCounts.get(layerValue) ?? 0;
          layerCounts.set(layerValue, currentCount + 1);

          let currentY = 0;
          for (let i = 0; i < layerIndex; i++) {
            currentY += layerHeights[i];
          }
          const defaultY = currentY + (layerHeights[layerIndex] / 2);
          const baseX = 150 + (currentCount * 220);

          const x = typeof input.x === 'number' && Number.isFinite(input.x)
            ? input.x
            : baseX;
          const y = typeof input.y === 'number' && Number.isFinite(input.y)
            ? input.y
            : defaultY + (Math.random() * 20 - 10);

          const nodeType = typeMap[input.type] || 'result';
          const content = input.content || input.label || '새 노드';
          const sentiment = input.sentiment === 'positive' ? 'positive' : (input.sentiment === 'negative' ? 'negative' : 'neutral');
          const frequency = typeof input.intensity === 'number'
            ? INTENSITY_MAP.TO_STRING(input.intensity)
            : input.intensity;

          const newNodeId = `node-${batchTimestamp}-${index}-${Math.random().toString(36).substr(2, 4)}`;
          if (input.tempId) {
            idMap[input.tempId] = newNodeId;
          }

          liveblocksService.updateStickyNote({
            id: newNodeId,
            content,
            x,
            y,
            layer: layerValue,
            sentiment,
            type: nodeType,
            frequency,
          });

          newNodes.push({
            id: newNodeId,
            type: nodeType,
            position: { x, y },
            data: {
              id: newNodeId,
              content,
              author: liveblocksService.getCurrentUserDisplayName(),
              timestamp: Date.now(),
              sentiment,
              frequency,
              type: nodeType,
              layer: layerValue,
            },
            draggable: true,
          });
        });

        const updatedNodes = [...nodesRef.current, ...newNodes];
        setNodes(() => {
          nodesRef.current = updatedNodes;
          return updatedNodes;
        });

        const newEdges: Edge[] = [];
        connectionInputs.forEach((connection, index) => {
          const sourceId = idMap[connection.sourceId] || connection.sourceId;
          const targetId = idMap[connection.targetId] || connection.targetId;
          if (!sourceId || !targetId) {
            return;
          }

          const relationType = connection.relationType === 'indirect' ? 'indirect' : 'direct';
          const isPositive = connection.isPositive !== false;
          const edgeColor = isPositive ? '#10b981' : '#ef4444';
          const edgeId = `edge-${sourceId}-${targetId}-${batchTimestamp}-${index}`;

          newEdges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: 'default',
            animated: false,
            style: {
              strokeWidth: 2,
              stroke: edgeColor,
              strokeDasharray: relationType === 'indirect' ? '5 5' : undefined,
            },
            markerEnd: {
              type: 'arrowclosed',
              width: 20,
              height: 20,
              color: edgeColor,
            },
            data: {
              relationType,
              isPositive,
            },
          });

          liveblocksService.updateConnection({
            id: edgeId,
            sourceId,
            targetId,
            relationType,
            isPositive,
          });
        });

        const updatedEdges = [...edgesRef.current, ...newEdges];
        setEdges(() => {
          edgesRef.current = updatedEdges;
          return updatedEdges;
        });

        const { connections: updatedConnections } = convertFromFlowData(updatedNodes, updatedEdges);
        onConnectionsChange(updatedConnections);

        console.log('✅ [Action Bridge] Batch nodes/connections added:', newNodes.length, newEdges.length);
        break;
      }

      case 'update_node': {
        if (!args.id) break;
        const sentiment = args.sentiment === 'positive' ? 'positive' : (args.sentiment === 'negative' ? 'negative' : 'neutral');
        const frequency = typeof args.intensity === 'number' ? INTENSITY_MAP.TO_STRING(args.intensity) : args.intensity;
        const content = args.content || args.label;
        const hasX = typeof args.x === 'number' && Number.isFinite(args.x);
        const hasY = typeof args.y === 'number' && Number.isFinite(args.y);

        liveblocksService.updateStickyNote({
          id: args.id,
          content,
          sentiment,
          frequency,
          ...(hasX ? { x: args.x } : {}),
          ...(hasY ? { y: args.y } : {}),
          ...(args.layer ? { layer: args.layer } : {}),
          ...(args.type ? { type: args.type } : {}),
        });

        setNodes((nds) => {
          const updated = nds.map((node) => {
            if (node.id === args.id) {
              const nextPosition = hasX || hasY
                ? {
                    x: hasX ? args.x : node.position.x,
                    y: hasY ? args.y : node.position.y,
                  }
                : node.position;
              return {
                ...node,
                position: nextPosition,
                data: {
                  ...node.data,
                  ...(content ? { content } : {}),
                  ...(sentiment ? { sentiment } : {}),
                  ...(frequency ? { frequency } : {}),
                  ...(args.type ? { type: args.type } : {}),
                  ...(args.layer ? { layer: args.layer } : {}),
                },
              };
            }
            return node;
          });
          nodesRef.current = updated;
          return updated;
        });
        console.log('✅ [Action Bridge] Node updated in UI:', args.id);
        break;
      }

      case 'delete_node':
        if (args.id) {
          liveblocksService.deleteStickyNote(args.id);
          setNodes((nds) => {
            const updated = nds.filter((node) => node.id !== args.id);
            nodesRef.current = updated;
            return updated;
          });
          setEdges((eds) => {
            const updated = eds.filter((edge) => edge.source !== args.id && edge.target !== args.id);
            edgesRef.current = updated;
            return updated;
          });
          console.log('✅ [Action Bridge] Node deleted from UI:', args.id);
        }
        break;

      case 'delete_connection':
        if (args.id) {
          liveblocksService.deleteConnection(args.id);
          setEdges((eds) => {
            const updated = eds.filter((edge) => edge.id !== args.id);
            edgesRef.current = updated;
            return updated;
          });
          const { connections: updatedConnections } = convertFromFlowData(nodesRef.current, edgesRef.current);
          onConnectionsChange(updatedConnections);
          console.log('✅ [Action Bridge] Connection deleted from UI:', args.id);
        }
        break;

      case 'create_connection':
        {
          const sourceId = args.sourceId || args.source;
          const targetId = args.targetId || args.target;
          if (!sourceId || !targetId) break;

          const edgeId = `edge-${sourceId}-${targetId}`;
          const newEdge: Edge = {
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: 'default',
            animated: false,
            style: {
              strokeWidth: 2,
              stroke: '#10b981',
            },
            markerEnd: {
              type: 'arrowclosed',
              width: 20,
              height: 20,
              color: '#10b981',
            },
            data: {
              relationType: 'direct',
              isPositive: true,
            },
          };

          setEdges((eds) => {
            const updated = addEdge(newEdge, eds);
            edgesRef.current = updated;
            return updated;
          });

          const { connections: updatedConnections } = convertFromFlowData(nodesRef.current, [...edgesRef.current, newEdge]);
          onConnectionsChange(updatedConnections);

          liveblocksService.updateConnection({
            id: edgeId,
            sourceId,
            targetId,
            relationType: 'direct',
            isPositive: true,
          });
        }
        break;

      case 'adjust_layer_height': {
        if (args.layer && args.height) {
          const layerIndex = args.layer - 1;
          const newHeights = [...layerHeights];
          newHeights[layerIndex] = Math.min(800, Math.max(100, args.height));
          setLayerHeights(newHeights);

          setTimeout(() => safeAutoLayout(false), 100);
        }
        break;
      }

      case 'auto_layout':
        break;

      default:
        console.warn('⚠️ 알 수 없는 AI 액션:', name);
    }
  }, [ensureLiveblocksConnected, layerHeights, onConnectionsChange, setEdges, setNodes, safeAutoLayout]);

  const handleAiAction = useCallback((action: AiAction) => {
    pendingActionsRef.current.push(action);

    if (flushScheduledRef.current) {
      return;
    }

    flushScheduledRef.current = true;

    setTimeout(() => {
      flushScheduledRef.current = false;
      const actions = [...pendingActionsRef.current];
      pendingActionsRef.current = [];

      let requestedLayout = false;
      let layoutNeeded = false;
      let suppressAutoLayout = false;

      actions.forEach((queuedAction) => {
        const name = queuedAction?.name;
        if (queuedAction?.__suppressAutoLayout) {
          suppressAutoLayout = true;
        }

        if (name === 'auto_layout') {
          requestedLayout = true;
          const spacing = queuedAction?.args?.spacing;
          if (spacing === 'compact' || spacing === 'normal' || spacing === 'wide') {
            layoutSpacingRef.current = spacing;
          }
          return;
        }

        if (name === 'add_node' || name === 'add_nodes_with_connections' || name === 'update_node' || name === 'delete_node' || name === 'delete_connection' || name === 'create_connection') {
          layoutNeeded = true;
        }

        try {
          executeAiAction(queuedAction);
        } catch (err) {
          console.error('❌ AI 액션 실행 실패:', err);
        }
      });

      if (!suppressAutoLayout && (requestedLayout || layoutNeeded)) {
        requestAnimationFrame(() => safeAutoLayout(false));
      }
    }, 0);
  }, [executeAiAction, safeAutoLayout]);

  useEffect(() => {
    collaborationLocksRef.current = collaborationLocks;
  }, [collaborationLocks]);

  const getCurrentUserId = useCallback(() => liveblocksService.getCurrentUserId() ?? 'local-user', []);

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

      onNodeUpdate(nodeId, newContent);
    },
    [ensureLiveblocksConnected, onNodeUpdate, setNodes]
  );

  const aiContext = useMemo(() => convertFromFlowData(nodes, edges), [nodes, edges]);

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
          currentUserId: getCurrentUserId(),
          includeFrequency: isConsultingMode,
        }
      );

      setNodes(() => {
        nodesRef.current = flowNodes;
        return flowNodes;
      });
      setEdges(() => {
        edgesRef.current = flowEdges;
        return flowEdges;
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

  useEffect(() => {
    type EventHandler = (...args: unknown[]) => void;

    const handleSyncComplete: EventHandler = () => {
      hydrateFromLiveblocks('sync-complete');
    };

    liveblocksService.on('sync-complete', handleSyncComplete);

    let retryCount = 0;
    const maxRetries = 10;
    let intervalId: number | undefined;

    const tryInitialHydrate = (reason: string) => {
      if (!liveblocksService.isConnected()) {
        return false;
      }
      hydrateFromLiveblocks(reason);
      return true;
    };

    if (!tryInitialHydrate('initial')) {
      intervalId = window.setInterval(() => {
        retryCount += 1;
        if (tryInitialHydrate('polling') || retryCount >= maxRetries) {
          if (intervalId) {
            window.clearInterval(intervalId);
          }
        }
      }, 500);
    }

    return () => {
      liveblocksService.off('sync-complete', handleSyncComplete);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [hydrateFromLiveblocks]);

  useEffect(() => {
    const handleLayerSettingsChanged = (settings: LayerSettings) => {
      applyLayerSettings(settings, 'layer-settings-changed');
    };

    const handleSyncComplete = () => {
      const settings = liveblocksService.getLayerSettings();
      if (settings) {
        applyLayerSettings(settings, 'sync-complete');
      }
    };

    liveblocksService.on('layer-settings-changed', handleLayerSettingsChanged);
    liveblocksService.on('sync-complete', handleSyncComplete);

    if (liveblocksService.isConnected()) {
      const settings = liveblocksService.getLayerSettings();
      if (settings) {
        applyLayerSettings(settings, 'initial');
      }
    }

    return () => {
      liveblocksService.off('layer-settings-changed', handleLayerSettingsChanged);
      liveblocksService.off('sync-complete', handleSyncComplete);
    };
  }, [applyLayerSettings]);

  useEffect(() => {
    if (applyingLayerSettingsRef.current) return;
    if (isHydratingRef.current) return;
    if (!liveblocksService.isConnected()) return;

    liveblocksService.updateLayerSettings({
      layerHeights,
      layerOpacities,
    });
  }, [layerHeights, layerOpacities]);

  useEffect(() => {
    if (isHydratingRef.current || applyingLayerSettingsRef.current) {
      return;
    }
    if (!nodes.length) return;

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

    const maxBottomByLayer = [0, 0, 0, 0];
    nodes.forEach((node) => {
      const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
      const nodeHeight = getNodeHeight(node);
      const bottom = node.position.y + nodeHeight;
      if (bottom > maxBottomByLayer[layerIndex]) {
        maxBottomByLayer[layerIndex] = bottom;
      }
    });

    const layerPaddingY = 20;
    const minHeight = 100;
    const maxHeight = 800;
    const nextHeights: number[] = [];
    let cumulativeY = 0;

    displayLayerOrder.forEach((layerKey) => {
      const index = layerIndexMap[layerKey];
      const maxBottom = maxBottomByLayer[index];
      const currentHeight = layerHeights[index] ?? minHeight;
      const required = maxBottom
        ? Math.max(minHeight, maxBottom - cumulativeY + layerPaddingY)
        : Math.max(minHeight, currentHeight);

      const clamped = Math.min(maxHeight, required);
      nextHeights[index] = clamped;
      cumulativeY += clamped;
    });

    const shouldUpdate = nextHeights.some((height, index) => height !== layerHeights[index]);
    if (shouldUpdate) {
      setLayerHeights(nextHeights);
    }
  }, [nodes, layerHeights]);

  useEffect(() => {
    if (isHydratingRef.current || applyingLayerSettingsRef.current) {
      previousLayerStartsRef.current = null;
      return;
    }

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

    const nextStarts: number[] = [];
    let cumulativeY = 0;
    displayLayerOrder.forEach((layerKey) => {
      const index = layerIndexMap[layerKey];
      nextStarts[index] = cumulativeY;
      cumulativeY += layerHeights[index] ?? 0;
    });

    const previousStarts = previousLayerStartsRef.current ?? nextStarts;
    previousLayerStartsRef.current = nextStarts;

    const deltas = nextStarts.map((start, index) => start - (previousStarts[index] ?? start));
    const hasShift = deltas.some((delta) => delta !== 0);
    if (!hasShift) return;

    let shifted = false;
    const shiftedNodes = nodes.map((node) => {
      const layerIndex = layerIndexMap[node.type || 'result'] ?? 0;
      const delta = deltas[layerIndex] ?? 0;
      if (!delta) return node;
      shifted = true;
      return {
        ...node,
        position: {
          ...node.position,
          y: node.position.y + delta,
        },
      };
    });

    if (!shifted) return;

    setNodes(shiftedNodes);

    if (liveblocksService.isConnected()) {
      shiftedNodes.forEach((node) => {
        liveblocksService.updateStickyNote({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
        });
      });
    }

    const updatedData = convertFromFlowData(shiftedNodes, edgesRef.current);
    onNotesChange(updatedData.notes);
  }, [layerHeights, nodes, onNotesChange, setNodes]);

  // ============================================================================
  // Liveblocks 실시간 리스너 등록
  // ============================================================================
  useEffect(() => {
    console.log('✅ [React Flow] Liveblocks 리스너 등록 시작');

    // 타입 정의
    type StickyNoteUpdateEvent = {
      id: string;
      authorId?: string;
      content?: string;
      text?: string;
      x: number;
      y: number;
      layer: number;
      layerIndex?: number;
      color: string;
      width?: number;
      height?: number;
    };

    type StickyNoteDeleteEvent = {
      noteId: string;
    };

    type ConnectionUpdateEvent = {
      id: string;
      sourceId: string;
      targetId: string;
      relationType: 'direct' | 'indirect';
      isPositive: boolean;
    };

    type ConnectionDeleteEvent = {
      connectionId: string;
    };

    // 다른 사용자의 노드 업데이트 수신
    const handleStickyNoteUpdated = (note: StickyNoteUpdateEvent) => {
      console.log('📥 [React Flow] Liveblocks 노드 수신:', note.id);

      // 자신이 보낸 업데이트는 무시
      const isOwnUpdate = note.authorId === liveblocksService.getCurrentUserId();
      if (isOwnUpdate) return;

      setNodes((currentNodes) => {
        const existingIndex = currentNodes.findIndex((n) => n.id === note.id);
        const existingNode = existingIndex >= 0 ? currentNodes[existingIndex] : undefined;
        const existingData = (existingNode?.data as Record<string, unknown>) ?? {};

        // 노드 타입 결정 (층위에서 역계산)
        const typeMap: { [key: number]: string } = {
          1: 'result',
          2: 'behavior',
          3: 'tangible_lever',
          4: 'intangible_lever',
        };

        const nodeType = typeMap[note.layer] || 'result';

        const activeLock = collaborationLocksRef.current[note.id];
        const currentUserId = getCurrentUserId();
        const isLockedByOther = Boolean(
          activeLock &&
          activeLock.itemType === 'note' &&
          activeLock.userId !== currentUserId
        );

        const previousContent = (existingData as { content?: string }).content ?? '';
        const previousSentiment = (existingData as { sentiment?: string }).sentiment ?? 'neutral';

        const updatedData: Record<string, unknown> = {
          ...existingData,
          content: note.content ?? previousContent,
          sentiment: note.color ?? previousSentiment,
          onUpdate: handleNodeContentUpdate,
          onEditStart: handleStartNodeEditing,
          onEditEnd: handleStopNodeEditing,
          isLocked: isLockedByOther,
          lockedBy: activeLock?.displayName ?? activeLock?.userId,
        };

        const updatedNode: Node = {
          id: note.id,
          type: nodeType,
          position: { x: note.x, y: note.y },
          data: updatedData,
          width: note.width || (existingNode?.width as number) || 200,
          height: note.height || (existingNode?.height as number) || 120,
          selected: existingNode?.selected ?? false,
        };

        if (existingIndex >= 0) {
          // 기존 노드 업데이트
          return currentNodes.map((n, idx) => (idx === existingIndex ? updatedNode : n));
        }

        // 새 노드 추가
        return [...currentNodes, updatedNode];
      });
    };

    // 다른 사용자의 노드 삭제 수신
    const handleStickyNoteDeleted = (data: StickyNoteDeleteEvent) => {
      console.log('🗑️ [React Flow] Liveblocks 노드 삭제 수신:', data.noteId);
      setNodes((currentNodes) => currentNodes.filter((n) => n.id !== data.noteId));
      setEdges((currentEdges) =>
        currentEdges.filter((e) => e.source !== data.noteId && e.target !== data.noteId)
      );
    };

    // 다른 사용자의 연결선 업데이트 수신
    const handleConnectionUpdated = (connection: ConnectionUpdateEvent) => {
      console.log('🔗 [React Flow] Liveblocks 연결선 수신:', connection.id);

      setEdges((currentEdges) => {
        const existingIndex = currentEdges.findIndex((e) => e.id === connection.id);

        // 연결선 스타일 결정
        const edgeStyle =
          connection.relationType === 'direct'
            ? { strokeWidth: 2 }
            : { strokeWidth: 2, strokeDasharray: '5 5' };

        const edgeColor = connection.isPositive ? '#10b981' : '#ef4444';

        const updatedEdge: Edge = {
          id: connection.id,
          source: connection.sourceId,
          target: connection.targetId,
          type: 'default',
          animated: false, // 애니메이션은 사용하지 않음
          style: {
            ...edgeStyle,
            stroke: edgeColor,
          },
          markerEnd: {
            type: 'arrowclosed',
            width: 20,
            height: 20,
            color: edgeColor,
          },
          data: {
            relationType: connection.relationType,
            isPositive: connection.isPositive,
          },
        };

        if (existingIndex >= 0) {
          // 기존 연결선 업데이트
          return currentEdges.map((e, idx) => (idx === existingIndex ? updatedEdge : e));
        } else {
          // 새 연결선 추가
          return [...currentEdges, updatedEdge];
        }
      });
    };

    // 다른 사용자의 연결선 삭제 수신
    const handleConnectionDeleted = (data: ConnectionDeleteEvent) => {
      console.log('🗑️ [React Flow] Liveblocks 연결선 삭제 수신:', data.connectionId);
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== data.connectionId));
    };

    // Liveblocks 이벤트 리스너 등록
    type EventHandler = (...args: unknown[]) => void;
    const handleNotesChanged: EventHandler = () => {
      hydrateFromLiveblocks('notes-changed');
    };
    const handleConnectionsChanged: EventHandler = () => {
      hydrateFromLiveblocks('connections-changed');
    };

    liveblocksService.on('sticky-note-updated', handleStickyNoteUpdated as EventHandler);
    liveblocksService.on('sticky-note-deleted', handleStickyNoteDeleted as EventHandler);
    liveblocksService.on('connection-updated', handleConnectionUpdated as EventHandler);
    liveblocksService.on('connection-deleted', handleConnectionDeleted as EventHandler);
    liveblocksService.on('notes-changed', handleNotesChanged);
    liveblocksService.on('connections-changed', handleConnectionsChanged);

    console.log('✅ [React Flow] Liveblocks 리스너 등록 완료');

    // Cleanup: 컴포넌트 언마운트 시 리스너 제거
    return () => {
      liveblocksService.off('sticky-note-updated', handleStickyNoteUpdated as EventHandler);
      liveblocksService.off('sticky-note-deleted', handleStickyNoteDeleted as EventHandler);
      liveblocksService.off('connection-updated', handleConnectionUpdated as EventHandler);
      liveblocksService.off('connection-deleted', handleConnectionDeleted as EventHandler);
      liveblocksService.off('notes-changed', handleNotesChanged);
      liveblocksService.off('connections-changed', handleConnectionsChanged);
      console.log('🔌 [React Flow] Liveblocks 리스너 제거 완료');
    };
  }, [
    getCurrentUserId,
    handleNodeContentUpdate,
    handleStartNodeEditing,
    handleStopNodeEditing,
    hydrateFromLiveblocks,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    type EditingEventPayload = {
      itemId: string;
      itemType: 'note' | 'connection';
      userId: string;
      displayName?: string;
    };

    const handleEditingStarted = (payload: unknown) => {
      const data = payload as EditingEventPayload | undefined;
      if (!data?.itemId) {
        return;
      }

      setCollaborationLocks(prev => {
        const prevLock = prev[data.itemId];
        if (
          prevLock &&
          prevLock.userId === data.userId &&
          prevLock.itemType === data.itemType
        ) {
          return prev;
        }

        return {
          ...prev,
          [data.itemId]: {
            itemId: data.itemId,
            itemType: data.itemType,
            userId: data.userId,
            displayName: data.displayName,
          },
        };
      });
    };

    const handleEditingStopped = (payload: unknown) => {
      const data = payload as EditingEventPayload | undefined;
      if (!data?.itemId) {
        return;
      }

      setCollaborationLocks(prev => {
        const prevLock = prev[data.itemId];
        if (!prevLock || prevLock.userId !== data.userId) {
          return prev;
        }

        const updated = { ...prev };
        delete updated[data.itemId];
        return updated;
      });
    };

    type EventHandler = (...args: unknown[]) => void;

    liveblocksService.on('editing-started', handleEditingStarted as EventHandler);
    liveblocksService.on('editing-stopped', handleEditingStopped as EventHandler);

    return () => {
      liveblocksService.off('editing-started', handleEditingStarted as EventHandler);
      liveblocksService.off('editing-stopped', handleEditingStopped as EventHandler);
    };
  }, []);

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

        if (
          existingIsLocked === Boolean(isLockedByOther) &&
          existingLockedBy === lockLabel
        ) {
          return node;
        }

        return {
          ...node,
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
    onConnectionsChange
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

      const draftNodes = applyNodeChanges(changes, nodesRef.current);
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
      const maxHeight = 800;
      const nextHeights: number[] = [];
      let cumulativeForHeights = 0;

      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        const maxBottom = maxBottomByLayer[index];
        const currentHeight = layerHeights[index] ?? minHeight;
        const required = maxBottom
          ? Math.max(minHeight, maxBottom - cumulativeForHeights + layerPaddingY)
          : Math.max(minHeight, currentHeight);
        const clamped = Math.min(maxHeight, required);
        nextHeights[index] = clamped;
        cumulativeForHeights += clamped;
      });

      const hasDraggingChange = changes.some(
        (change) => change.type === 'position' && change.dragging
      );
      const shouldExpand = nextHeights.some((height, index) => height > layerHeights[index]);
      const effectiveLayerHeights = hasDraggingChange && shouldExpand ? nextHeights : layerHeights;

      if (hasDraggingChange && shouldExpand) {
        setLayerHeights(nextHeights);
      }

      const layerStartByIndex = new Map<number, number>();
      let cumulativeY = 0;
      displayLayerOrder.forEach((layerKey) => {
        const index = layerIndexMap[layerKey];
        layerStartByIndex.set(index, cumulativeY);
        cumulativeY += effectiveLayerHeights[index] ?? 0;
      });

      const clampedChanges = changes.map((change) => {
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

      onNodesChange(clampedChanges);

      // 위치 변경 완료 시 Firebase 동기화
      clampedChanges.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.position) {
          const node = nodes.find((n) => n.id === change.id);
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
      });

      // 로컬 상태 업데이트
      const updatedData = convertFromFlowData(nodes, edges);
      onNotesChange(updatedData.notes);
    },
    [getCurrentUserId, layerHeights, nodes, edges, isConsultingMode, onNodesChange, onNotesChange]
  );

  // ============================================================================
  // 엣지 변경 핸들러 + Firebase 동기화
  // ============================================================================
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      // 엣지 삭제 시 Firebase 동기화
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const edge = edges.find((e) => e.id === change.id);
          if (edge) {
            liveblocksService.deleteConnection(edge.id);
            console.log('🗑️ [React Flow] Firebase 연결선 삭제:', edge.id);
          }
        }
      });

      // 로컬 상태 업데이트
      const updatedData = convertFromFlowData(nodes, edges);
      onConnectionsChange(updatedData.connections);
    },
    [nodes, edges, onEdgesChange, onConnectionsChange]
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
      // 부정↔부정: 주황색
      else if (sourceSentiment === 'negative' && targetSentiment === 'negative') {
        edgeColor = '#f97316';
        isPositive = false;
      }
      // 중립 포함: 회색
      else {
        edgeColor = '#6b7280';
        isPositive = true;
      }

      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        type: 'default',
        animated: false, // 기본값은 애니메이션 없음
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

      // Firebase 실시간 동기화
      liveblocksService.updateConnection({
        id: newEdge.id,
        sourceId: params.source!,
        targetId: params.target!,
        relationType: 'direct',
        isPositive: isPositive,
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

  const lastPresenceUpdateRef = useRef(0);
  const [otherCursors, setOtherCursors] = useState<Array<{
    id: string;
    x: number;
    y: number;
    userName?: string;
    userColor?: string;
  }>>([]);

  useEffect(() => {
    let unsubscribe = () => { };

    const handleSync = () => {
      if (!liveblocksService.isConnected()) return;

      unsubscribe();
      unsubscribe = liveblocksService.onOthersPresence((others) => {
        const cursors = others
          .map(({ id, presence }) => ({
            id,
            cursor: presence?.cursor,
            userName: presence?.userName,
            userColor: presence?.userColor,
          }))
          .filter((entry) => Boolean(entry.cursor))
          .map((entry) => ({
            id: entry.id,
            x: entry.cursor!.x,
            y: entry.cursor!.y,
            userName: entry.userName,
            userColor: entry.userColor,
          }));

        setOtherCursors(cursors);
      });
    };

    handleSync();
    liveblocksService.on('sync-complete', handleSync);

    return () => {
      liveblocksService.off('sync-complete', handleSync);
      unsubscribe();
    };
  }, []);

  const handlePaneMouseMove = useCallback((event: React.MouseEvent) => {
    if (!reactFlowInstance || !liveblocksService.isConnected()) return;

    const now = performance.now();
    if (now - lastPresenceUpdateRef.current < 50) return;
    lastPresenceUpdateRef.current = now;

    const projector = reactFlowInstance as ReactFlowInstance & {
      screenToFlowPosition?: (position: { x: number; y: number }) => {
        x: number;
        y: number;
      };
      project?: (position: { x: number; y: number }) => { x: number; y: number };
    };

    const cursor =
      projector.screenToFlowPosition?.({ x: event.clientX, y: event.clientY }) ??
      projector.project?.({ x: event.clientX, y: event.clientY }) ??
      { x: event.clientX, y: event.clientY };

    liveblocksService.updatePresence({ cursor });
  }, [reactFlowInstance]);

  const handlePaneMouseLeave = useCallback(() => {
    if (!liveblocksService.isConnected()) return;
    liveblocksService.updatePresence({ cursor: null });
  }, []);

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

  const handleNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node: Node) => {
    event.preventDefault();
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
              edgeColor = '#f97316';
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

          const { connections: updatedConnections } = convertFromFlowData(nodes, updatedEdges);
          onConnectionsChange(updatedConnections);

          liveblocksService.updateConnection({
            id: edge.id,
            sourceId: edge.source,
            targetId: edge.target,
            relationType: action,
            isPositive: (edge.data as { isPositive?: boolean })?.isPositive !== false,
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
      handleNodeContentUpdate,
      handleStartNodeEditing,
      handleStopNodeEditing,
      onConnectionsChange,
      onNotesChange,
      isConsultingMode,
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
      overflow: 'hidden' // 자식 요소가 부모를 넘치지 못하게
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
            onClick={() => {
              const helpText = isMobile
                ? '🗺️ 모바일 사용법\n\n' +
                '➕ 포스트잇 생성: 우측 하단 + 버튼\n' +
                '✏️ 포스트잇 편집: 더블탭\n' +
                '🎯 포스트잇 이동: 드래그\n' +
                '🔗 연결선 생성: 핸들 드래그\n' +
                '🌐 캔버스 이동: 빈 공간 드래그\n' +
                '🤏 확대/축소: 두 손가락 핀치\n' +
                '☰ 메뉴: 좌측 상단 햄버거 버튼'
                : '🗺️ 데스크톱 사용법\n\n' +
                '📌 포스트잇 생성: 빈 캔버스 우클릭 → 레이어 선택\n' +
                '✏️ 포스트잇 편집: 더블클릭\n' +
                '🔗 연결선 생성: 핸들 드래그\n' +
                '🎨 속성 변경: 포스트잇/연결선 우클릭 메뉴\n' +
                '🌐 캔버스 이동: 중간/우클릭 드래그\n' +
                '🔍 확대/축소: 마우스 휠\n' +
                '🧾 내보내기: 상단 PNG/JSON/Excel\n' +
                '🤖 AI 생성: 좌측 패널 "AI 일괄 생성" 버튼';

              alert(helpText);
            }}
          >
            ?
          </button>
        </div>

        <div className="top-bar-right">
          {/* 컬쳐맵 내보내기 메뉴 */}
          <ExportMenu
            reactFlowInstance={reactFlowInstance}
            nodes={nodes}
            edges={edges}
          />

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
                onPaneMouseMove={handlePaneMouseMove}
                onPaneMouseLeave={handlePaneMouseLeave}
                onPaneContextMenu={handlePaneContextMenu}
                onNodeContextMenu={handleNodeContextMenu}
                onEdgeContextMenu={handleEdgeContextMenu}
                nodeTypes={nodeTypes}
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
                onInit={setReactFlowInstance}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

                {otherCursors.length > 0 && (
                  <ViewportPortal>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        pointerEvents: 'none',
                        zIndex: 5,
                      }}
                    >
                      {otherCursors.map((cursor) => (
                        <div
                          key={cursor.id}
                          style={{
                            position: 'absolute',
                            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
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
                      ))}
                    </div>
                  </ViewportPortal>
                )}

                {/* 층위 배경 레이어 (ViewportPortal 사용 - transform 적용됨) */}
                {showLayerBackground && (
                  <ViewportPortal>
                    <div
                      data-layer-background-root="true"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '10000px', // 충분히 큰 크기
                        height: '10000px',
                        pointerEvents: 'none',
                        zIndex: -1, // 포스트잇 뒤로
                      }}
                    >
                      {/* 배경층들 - 개별 높이 적용 */}
                      {[
                        { name: '결과', color: 'rgba(255, 107, 107, OPACITY)', index: 0 },
                        { name: '행동', color: 'rgba(78, 205, 196, OPACITY)', index: 1 },
                        { name: '유형 레버', color: 'rgba(149, 225, 211, OPACITY)', index: 2 },
                        { name: '무형 레버', color: 'rgba(255, 230, 109, OPACITY)', index: 3 },
                      ].map((layer, displayIndex, layers) => {
                        // 각 층위의 Y 좌표 계산 (표시 순서 기준 누적)
                        let y = 0;
                        for (let i = 0; i < displayIndex; i++) {
                          const previousLayer = layers[i];
                          y += layerHeights[previousLayer.index] ?? 0;
                        }

                        const getLayerColor = (opacity: number) => layer.color.replace('OPACITY', String(opacity));
                        const bgColor = getLayerColor(layerOpacities[layer.index]);

                        return (
                          <div
                            data-layer-capture="segment"
                            key={layer.name}
                            style={{
                              position: 'absolute',
                              transform: `translate(0px, ${y}px)`, // ViewportPortal에서는 transform 사용
                              left: 0,
                              width: '100%',
                              height: `${layerHeights[layer.index]}px`,
                              backgroundColor: bgColor,
                              borderBottom: layer.index < 3 ? `2px dashed ${getLayerColor(0.3)}` : 'none',
                            }}
                          >
                            <div
                              data-layer-capture="label"
                              onClick={() => {
                                // 이미 선택된 라벨을 다시 클릭하면 선택 해제 및 패널 닫기
                                if (selectedLayerIndex === layer.index) {
                                  setSelectedLayerIndex(null); // 선택 해제
                                  setShowLayerControlPanel(false); // 패널 닫기
                                } else {
                                  // 다른 라벨 클릭 시 선택 변경 및 패널 열기
                                  setSelectedLayerIndex(layer.index);
                                  setShowLayerControlPanel(true);
                                }
                              }}
                              style={{
                                position: 'absolute',
                                top: '10px',
                                left: '32px',
                                padding: '6px 16px',
                                backgroundColor: selectedLayerIndex === layer.index ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.9)',
                                border: `2px solid ${selectedLayerIndex === layer.index ? getLayerColor(0.8) : getLayerColor(0.5)}`,
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: layer.color.replace('0.05', '0.8'),
                                boxShadow: selectedLayerIndex === layer.index ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '0 2px 6px rgba(0, 0, 0, 0.12)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                pointerEvents: 'auto', // 라벨만 클릭 가능
                              }}
                              className="nopan nodrag"
                              title={selectedLayerIndex === layer.index ? "다시 클릭하여 선택 해제 및 패널 닫기" : "클릭하여 이 층위 선택 및 높이 조절"}
                            >
                              {selectedLayerIndex === layer.index ? '📌 ' : ''}{layer.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ViewportPortal>
                )}

                {/* 층위 관리 패널 토글 버튼 */}
                {!showLayerControlPanel && (
                  <Panel position="top-center" style={{
                    backgroundColor: 'transparent',
                    padding: 0,
                    boxShadow: 'none',
                    border: 'none',
                  }}>
                    <button
                      onClick={() => setShowLayerControlPanel(true)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        color: '#666',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
                      }}
                      title="층위 관리 패널 열기"
                    >
                      📐 층위 관리
                    </button>
                  </Panel>
                )}

                {/* 상단 층위 관리 컨트롤 Panel - 반응형 */}
                {showLayerControlPanel && (
                  <Panel
                    position="top-center"
                    className="layer-control-panel"
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: isMobile ? '8px' : '16px',
                      alignItems: isMobile ? 'stretch' : 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      padding: isMobile ? '10px' : '12px 20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      maxWidth: isMobile ? '90vw' : 'auto',
                      maxHeight: isMobile ? '80vh' : 'auto',
                      overflowY: isMobile ? 'auto' : 'visible',
                    }}
                  >
                    {/* 닫기 버튼 */}
                    <button
                      onClick={() => setShowLayerControlPanel(false)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        color: '#999',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        lineHeight: 1,
                        alignSelf: isMobile ? 'flex-end' : 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                        e.currentTarget.style.color = '#666';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#999';
                      }}
                      title="층위 관리 패널 닫기"
                    >
                      ✕
                    </button>

                    {/* 구분선 (데스크톱만) */}
                    {!isMobile && <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />}

                    {/* 층위 배경 표시 토글 */}
                    <button
                      onClick={() => setShowLayerBackground(!showLayerBackground)}
                      style={{
                        padding: isMobile ? '10px 14px' : '6px 12px',
                        backgroundColor: showLayerBackground ? '#4CAF50' : '#f5f5f5',
                        color: showLayerBackground ? 'white' : '#666',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: isMobile ? '13px' : '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        width: isMobile ? '100%' : 'auto',
                      }}
                      title="층위 배경 표시/숨김"
                    >
                      {showLayerBackground ? '🎨 층위 표시' : '🚫 층위 숨김'}
                    </button>

                    {/* 구분선 (데스크톱만) */}
                    {!isMobile && <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />}

                    {/* 층위 선택 드롭다운 */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                      <label htmlFor="layer-select" style={{ fontSize: '12px', fontWeight: '500', color: '#666', whiteSpace: 'nowrap' }}>
                        조절할 층위:
                      </label>
                      <select
                        id="layer-select"
                        value={selectedLayerIndex ?? 0}
                        onChange={(e) => setSelectedLayerIndex(Number(e.target.value))}
                        style={{
                          padding: isMobile ? '10px 12px' : '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          fontSize: isMobile ? '13px' : '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          width: isMobile ? '100%' : 'auto',
                        }}
                      >
                        <option value={0}>📊 결과</option>
                        <option value={1}>🎬 행동</option>
                        <option value={2}>🔧 유형 레버</option>
                        <option value={3}>💡 무형 레버</option>
                      </select>
                    </div>

                    {/* 구분선 (데스크톱만) */}
                    {!isMobile && <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />}

                    {/* 선택된 층위 높이 조절 */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '10px', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 'auto' : '220px' }}>
                      <label htmlFor="layer-height-input" style={{ fontSize: '12px', fontWeight: '500', color: '#666', whiteSpace: 'nowrap' }}>
                        높이:
                      </label>
                      <input
                        type="range"
                        id="layer-height-input"
                        min="100"
                        max="800"
                        step="20"
                        value={layerHeights[selectedLayerIndex ?? 0]}
                        onChange={(e) => {
                          if (selectedLayerIndex === null) return;
                          const newHeights = [...layerHeights];
                          newHeights[selectedLayerIndex] = Number(e.target.value);
                          setLayerHeights(newHeights);
                        }}
                        style={{ flex: 1, minWidth: isMobile ? 'auto' : '100px', width: isMobile ? '100%' : 'auto' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          min="100"
                          max="800"
                          step="20"
                          value={layerHeights[selectedLayerIndex ?? 0]}
                          onChange={(e) => {
                            if (selectedLayerIndex === null) return;
                            const value = Math.min(800, Math.max(100, Number(e.target.value)));
                            const newHeights = [...layerHeights];
                            newHeights[selectedLayerIndex] = value;
                            setLayerHeights(newHeights);
                          }}
                          style={{
                            width: '60px',
                            padding: isMobile ? '8px' : '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '12px',
                            textAlign: 'right',
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#999' }}>px</span>
                      </div>
                    </div>

                    {/* 구분선 (데스크톱만) */}
                    {!isMobile && <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />}

                    {/* 전체 투명도 슬라이더 */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '10px', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 'auto' : '180px' }}>
                      <label htmlFor="global-opacity" style={{ fontSize: '12px', fontWeight: '500', color: '#666', whiteSpace: 'nowrap' }}>
                        투명도:
                      </label>
                      <input
                        type="range"
                        id="global-opacity"
                        min="0"
                        max="1"
                        step="0.01"
                        value={layerOpacities[selectedLayerIndex ?? 0]}
                        onChange={(e) => {
                          if (selectedLayerIndex === null) return;
                          const newOpacities = [...layerOpacities];
                          newOpacities[selectedLayerIndex] = Number(e.target.value);
                          setLayerOpacities(newOpacities);
                        }}
                        style={{ flex: 1, minWidth: isMobile ? 'auto' : '80px', width: isMobile ? '100%' : 'auto' }}
                      />
                      <span style={{ fontSize: '11px', color: '#999', minWidth: '35px', textAlign: 'right' }}>
                        {Math.round(layerOpacities[selectedLayerIndex ?? 0] * 100)}%
                      </span>
                    </div>
                  </Panel>
                )}

                {/* Controls의 top 제거 - 기본 위치(top: 10px) 사용 */}
                <Controls style={{ left: 16, bottom: 'auto' }} />
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
              </ReactFlow>
            </div> {/* 메인 React Flow 영역 닫기 */}
          </>
        )} {/* 컬쳐맵 탭 닫기 */}

        {/* 보고서 탭 */}
        {activeTab === 'report' && (
          <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '24px' }}>
            <ReportEditor
              initialContent={reportContent}
              onSave={handleReportChange}
              onGenerateReport={handleGenerateReport}
              isGenerating={isGeneratingReport}
            />
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
              <div className="context-menu-title">📌 새 노트 생성</div>
              <button
                onClick={() => {
                  handleContextMenuAction('create_result');
                }}
              >
                🔴 결과 (가시적 요소)
              </button>
              <button
                onClick={() => {
                  handleContextMenuAction('create_behavior');
                }}
              >
                🟡 행동 (관찰 행동)
              </button>
              <button
                onClick={() => {
                  handleContextMenuAction('create_tangible_lever');
                }}
              >
                🔵 유형 레버 (규범/가치)
              </button>
              <button
                onClick={() => {
                  handleContextMenuAction('create_intangible_lever');
                }}
              >
                🟣 무형 레버 (기본 가정)
              </button>
              <div className="context-menu-divider" />
              <button
                onClick={() => {
                  handleAutoLayout();
                  closeContextMenu();
                }}
              >
                🔄 자동 정렬
              </button>
            </>
          )}
          {contextMenu.type === 'node' && (
            <>
              <div className="context-menu-title">🎨 속성 변경</div>
              <button onClick={() => handleContextMenuAction('positive')}>
                ✅ 긍정으로 변경
              </button>
              <button onClick={() => handleContextMenuAction('neutral')}>
                ➖ 중립으로 변경
              </button>
              <button onClick={() => handleContextMenuAction('negative')}>
                ❌ 부정으로 변경
              </button>

              {/* 컨설팅 모드일 때만 빈도 설정 표시 */}
              {isConsultingMode && (
                <>
                  <hr />
                  <div className="context-menu-title">📊 빈도 설정</div>
                  <button onClick={() => handleContextMenuAction('frequency_high')}>
                    🔴 빈도多
                  </button>
                  <button onClick={() => handleContextMenuAction('frequency_medium')}>
                    🟡 빈도中
                  </button>
                  <button onClick={() => handleContextMenuAction('frequency_low')}>
                    🟢 빈도少
                  </button>
                  <button onClick={() => handleContextMenuAction('frequency_remove')}>
                    ⚪ 빈도 제거
                  </button>
                </>
              )}

              <hr />
              <button onClick={() => handleContextMenuAction('delete')}>🗑️ 삭제</button>
            </>
          )}
          {contextMenu.type === 'edge' && (
            <>
              <div className="context-menu-title">🔗 연결선 설정</div>
              <button onClick={() => handleContextMenuAction('direct')}>
                ━ 실선 (직접)
              </button>
              <button onClick={() => handleContextMenuAction('indirect')}>
                ┄ 점선 (간접)
              </button>
              <hr />
              <button onClick={() => handleContextMenuAction('delete')}>🗑️ 삭제</button>
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
