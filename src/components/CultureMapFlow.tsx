// src/components/CultureMapFlow.tsx
import { useCallback, useEffect } from 'react';
import ReactFlow, {
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

  // 초기 데이터 변환 및 동기화
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 레이아웃 재계산 함수
  const handleAutoLayout = useCallback(() => {
    const layouted = centerLayout(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [nodes, edges, setNodes, setEdges]);

  // 노드 변경 핸들러 (드래그, 선택 등)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // 위치 변경 완료 시 Firebase 동기화
      changes.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            // Firebase 업데이트
            FirebaseMultiUserService.updateStickyNote({
              id: node.id,
              content: (node.data as { content?: string }).content || '',
              x: change.position.x,
              y: change.position.y,
              layer: 1, // 나중에 노드 타입에 따라 계산
              color: 'neutral',
              type: 'sticky_note',
              width: 200,
              height: 120,
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

  // 엣지 변경 핸들러
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      // 로컬 상태 업데이트
      const updatedData = convertFromFlowData(nodes, edges);
      onConnectionsChange(updatedData.connections);
    },
    [nodes, edges, onEdgesChange, onConnectionsChange]
  );

  // 새 연결 생성
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        type: 'default',
        animated: true,
        style: {
          strokeWidth: 2,
          stroke: '#10b981',
        },
        markerEnd: {
          type: 'arrowclosed',
          width: 20,
          height: 20,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));

      // Firebase 동기화
      FirebaseMultiUserService.updateConnection({
        id: newEdge.id,
        sourceId: params.source!,
        targetId: params.target!,
        relationType: 'direct',
        isPositive: true,
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
