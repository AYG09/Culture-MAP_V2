// src/components/CultureMapFlow.tsx
import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// 커스텀 노드 컴포넌트
import {
  ResultNode,
  BehaviorNode,
  TangibleLeverNode,
  IntangibleLeverNode,
} from './flow-nodes';
import MobileGestureGuide from './MobileGestureGuide';

// 타입
import type { NoteData, ConnectionData } from '../types/culture';

// 유틸리티
import { convertToFlowData, convertFromFlowData } from '../utils/flowDataConverter';
import { getLayoutedElements, centerLayout } from '../utils/flowAutoLayout';

// Firebase 서비스
import FirebaseMultiUserService from '../services/FirebaseMultiUserService';

import './CultureMapFlow.css';

interface CultureMapFlowProps {
  notes: NoteData[];
  connections: ConnectionData[];
  onNotesChange: (notes: NoteData[]) => void;
  onConnectionsChange: (connections: ConnectionData[]) => void;
  onNodeUpdate: (id: string, content: string) => void;
}

// 커스텀 노드 타입 정의
const nodeTypes = {
  result: ResultNode,
  behavior: BehaviorNode,
  tangible_lever: TangibleLeverNode,
  intangible_lever: IntangibleLeverNode,
};

const CultureMapFlow = ({
  notes,
  connections,
  onNotesChange,
  onConnectionsChange,
  onNodeUpdate,
}: CultureMapFlowProps) => {
  // React Flow 노드/엣지 상태
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'pane' | 'node' | 'edge';
    targetId?: string;
  } | null>(null);

  // 초기 데이터 변환 및 동기화 + Firebase 실시간 리스너
  useEffect(() => {
    const { nodes: flowNodes, edges: flowEdges } = convertToFlowData(
      notes,
      connections,
      onNodeUpdate
    );
    
    // 자동 레이아웃 적용
    const layouted = getLayoutedElements(flowNodes, flowEdges);
    
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    
    // ============ Firebase 실시간 리스너 등록 ============
    
    // 다른 사용자의 노드 업데이트 수신
    const handleStickyNoteUpdated = (note: {
      id: string;
      content: string;
      x: number;
      y: number;
      layer: number;
      color: string;
      type: string;
      width?: number;
      height?: number;
      authorId?: string;
    }) => {
      console.log('📥 [React Flow] Firebase 노드 수신:', note.id);
      
      // 자신이 보낸 업데이트는 무시
      const isOwnUpdate = note.authorId === FirebaseMultiUserService.getCurrentUserId();
      if (isOwnUpdate) return;
      
      setNodes((currentNodes) => {
        const existingIndex = currentNodes.findIndex((n) => n.id === note.id);
        
        // 노드 타입 결정 (층위에서 역계산)
        const typeMap: { [key: number]: string } = {
          1: 'result',
          2: 'behavior',
          3: 'tangible_lever',
          4: 'intangible_lever',
        };
        
        const nodeType = typeMap[note.layer] || 'result';
        
        const updatedNode: Node = {
          id: note.id,
          type: nodeType,
          position: { x: note.x, y: note.y },
          data: {
            content: note.content,
            sentiment: note.color,
            onUpdate: onNodeUpdate,
          },
          width: note.width || 200,
          height: note.height || 120,
        };
        
        if (existingIndex >= 0) {
          // 기존 노드 업데이트
          return currentNodes.map((n, idx) => (idx === existingIndex ? updatedNode : n));
        } else {
          // 새 노드 추가
          return [...currentNodes, updatedNode];
        }
      });
    };
    
    // 다른 사용자의 노드 삭제 수신
    const handleStickyNoteDeleted = (data: { noteId: string }) => {
      console.log('🗑️ [React Flow] Firebase 노드 삭제 수신:', data.noteId);
      setNodes((currentNodes) => currentNodes.filter((n) => n.id !== data.noteId));
      setEdges((currentEdges) => 
        currentEdges.filter((e) => e.source !== data.noteId && e.target !== data.noteId)
      );
    };
    
    // 다른 사용자의 연결선 업데이트 수신
    const handleConnectionUpdated = (connection: {
      id: string;
      sourceId: string;
      targetId: string;
      relationType: 'direct' | 'indirect';
      isPositive: boolean;
    }) => {
      console.log('🔗 [React Flow] Firebase 연결선 수신:', connection.id);
      
      setEdges((currentEdges) => {
        const existingIndex = currentEdges.findIndex((e) => e.id === connection.id);
        
        // 연결선 스타일 결정
        const edgeStyle = connection.relationType === 'direct' 
          ? { strokeWidth: 2 } 
          : { strokeWidth: 2, strokeDasharray: '5,5' };
        
        const edgeColor = connection.isPositive ? '#10b981' : '#ef4444';
        
        const updatedEdge: Edge = {
          id: connection.id,
          source: connection.sourceId,
          target: connection.targetId,
          type: 'default',
          animated: connection.relationType === 'direct',
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
    const handleConnectionDeleted = (data: { connectionId: string }) => {
      console.log('🗑️ [React Flow] Firebase 연결선 삭제 수신:', data.connectionId);
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== data.connectionId));
    };
    
    // Firebase 이벤트 리스너 등록 (TypeScript 타입 우회)
    FirebaseMultiUserService.on('sticky-note-updated', handleStickyNoteUpdated as any);
    FirebaseMultiUserService.on('sticky-note-deleted', handleStickyNoteDeleted as any);
    FirebaseMultiUserService.on('connection-updated', handleConnectionUpdated as any);
    FirebaseMultiUserService.on('connection-deleted', handleConnectionDeleted as any);
    
    console.log('✅ [React Flow] Firebase 리스너 등록 완료');
    
    // Cleanup: 컴포넌트 언마운트 시 리스너 제거
    return () => {
      FirebaseMultiUserService.off('sticky-note-updated', handleStickyNoteUpdated as any);
      FirebaseMultiUserService.off('sticky-note-deleted', handleStickyNoteDeleted as any);
      FirebaseMultiUserService.off('connection-updated', handleConnectionUpdated as any);
      FirebaseMultiUserService.off('connection-deleted', handleConnectionDeleted as any);
      console.log('🔌 [React Flow] Firebase 리스너 제거 완료');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 레이아웃 재계산 함수
  const handleAutoLayout = useCallback(() => {
    const layouted = centerLayout(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [nodes, edges, setNodes, setEdges]);

  // 노드 변경 핸들러 (드래그, 선택 등) + Firebase 실시간 동기화
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // 위치 변경 완료 시 Firebase 동기화
      changes.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            // 노드 타입에 따른 층위 계산
            const layerMap: { [key: string]: number } = {
              'result': 1,
              'behavior': 2,
              'tangible_lever': 3,
              'intangible_lever': 4,
            };
            
            const layer = layerMap[node.type || 'result'] || 1;
            
            // Firebase 실시간 동기화
            FirebaseMultiUserService.updateStickyNote({
              id: node.id,
              content: (node.data as { content?: string }).content || '',
              x: change.position.x,
              y: change.position.y,
              layer: layer,
              color: (node.data as { sentiment?: string }).sentiment || 'neutral',
              type: node.type || 'sticky_note',
              width: (node.width as number) || 200,
              height: (node.height as number) || 120,
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
    [nodes, edges, onNodesChange, onNotesChange]
  );

  // 엣지 변경 핸들러 + Firebase 실시간 동기화
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      // 엣지 삭제 시 Firebase 동기화
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const edge = edges.find((e) => e.id === change.id);
          if (edge) {
            FirebaseMultiUserService.deleteConnection(edge.id);
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

  // 새 연결 생성 + Firebase 실시간 동기화
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      
      // 노드 속성에 따른 연결선 색상 자동 계산
      const sourceSentiment = (sourceNode?.data as { sentiment?: string })?.sentiment || 'neutral';
      const targetSentiment = (targetNode?.data as { sentiment?: string })?.sentiment || 'neutral';
      
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
        animated: true,
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
      FirebaseMultiUserService.updateConnection({
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
    [edges, nodes, setEdges, onConnectionsChange]
  );

  // 노드 클릭 이벤트
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('Clicked node:', node.id);
  }, []);

  return (
    <div className="culture-map-flow-container">
      {/* 모바일 제스처 가이드 */}
      <MobileGestureGuide />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
        // 모바일 터치 최적화
        panOnDrag={true}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        preventScrolling={true}
        // 모바일 제스처
        selectionOnDrag={false}
        panActivationKeyCode={null}
        // 성능 최적화
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{
            backgroundColor: '#f8f9fa',
          }}
        />
        <Panel position="top-left" className="layer-legend">
          <div className="legend-title">📊 4층위 모델</div>
          <button 
            className="auto-layout-button"
            onClick={handleAutoLayout}
            title="자동 레이아웃 적용"
          >
            🔄 자동 정렬
          </button>
          <div className="legend-item result">
            <span className="legend-badge">결과</span>
            <span>가시적 요소</span>
          </div>
          <div className="legend-item behavior">
            <span className="legend-badge">행동</span>
            <span>관찰 행동</span>
          </div>
          <div className="legend-item tangible">
            <span className="legend-badge">유형 레버</span>
            <span>규범/가치</span>
          </div>
          <div className="legend-item intangible">
            <span className="legend-badge">무형 레버</span>
            <span>기본 가정</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default CultureMapFlow;
