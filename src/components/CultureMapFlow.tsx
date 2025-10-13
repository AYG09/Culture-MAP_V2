// src/components/CultureMapFlow.tsx - 완전히 재작성된 버전
import { useCallback, useEffect, useState } from 'react';
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
  type OnSelectionChangeParams,
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
import { getLayoutedElements } from '../utils/flowAutoLayout';
import { parseAIOutput } from '../utils/parser';

// Firebase 서비스
import FirebaseMultiUserService from '../services/FirebaseMultiUserService';

import './CultureMapFlow.css';

interface CultureMapFlowProps {
  notes?: NoteData[]; // 초기 데이터 (optional)
  connections?: ConnectionData[]; // 초기 데이터 (optional)
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
  notes: _notes, // props에서는 받되 사용하지 않음 (Firebase가 소스)
  connections: _connections,
  onNotesChange,
  onConnectionsChange,
  onNodeUpdate,
}: CultureMapFlowProps) => {
  // React Flow 노드/엣지 상태
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // AI 일괄 생성 입력 상태
  const [aiInput, setAiInput] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);

  // 선택된 노드/엣지 상태 (추후 활용 가능)
  const [_selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [_selectedEdges, setSelectedEdges] = useState<Edge[]>([]);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'pane' | 'node' | 'edge';
    targetId?: string;
  } | null>(null);

  // ============================================================================
  // Firebase 실시간 리스너 등록
  // ============================================================================
  useEffect(() => {
    console.log('✅ [React Flow] Firebase 리스너 등록 시작');

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
    const handleStickyNoteDeleted = (data: StickyNoteDeleteEvent) => {
      console.log('🗑️ [React Flow] Firebase 노드 삭제 수신:', data.noteId);
      setNodes((currentNodes) => currentNodes.filter((n) => n.id !== data.noteId));
      setEdges((currentEdges) =>
        currentEdges.filter((e) => e.source !== data.noteId && e.target !== data.noteId)
      );
    };

    // 다른 사용자의 연결선 업데이트 수신
    const handleConnectionUpdated = (connection: ConnectionUpdateEvent) => {
      console.log('🔗 [React Flow] Firebase 연결선 수신:', connection.id);

      setEdges((currentEdges) => {
        const existingIndex = currentEdges.findIndex((e) => e.id === connection.id);

        // 연결선 스타일 결정
        const edgeStyle =
          connection.relationType === 'direct'
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
    const handleConnectionDeleted = (data: ConnectionDeleteEvent) => {
      console.log('🗑️ [React Flow] Firebase 연결선 삭제 수신:', data.connectionId);
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== data.connectionId));
    };

    // Firebase 이벤트 리스너 등록 (타입 안전성을 위해 캐스팅)
    type EventHandler = (...args: unknown[]) => void;
    FirebaseMultiUserService.on('sticky-note-updated', handleStickyNoteUpdated as EventHandler);
    FirebaseMultiUserService.on('sticky-note-deleted', handleStickyNoteDeleted as EventHandler);
    FirebaseMultiUserService.on('connection-updated', handleConnectionUpdated as EventHandler);
    FirebaseMultiUserService.on('connection-deleted', handleConnectionDeleted as EventHandler);

    console.log('✅ [React Flow] Firebase 리스너 등록 완료');

    // Cleanup: 컴포넌트 언마운트 시 리스너 제거
    return () => {
      FirebaseMultiUserService.off('sticky-note-updated', handleStickyNoteUpdated as EventHandler);
      FirebaseMultiUserService.off('sticky-note-deleted', handleStickyNoteDeleted as EventHandler);
      FirebaseMultiUserService.off('connection-updated', handleConnectionUpdated as EventHandler);
      FirebaseMultiUserService.off('connection-deleted', handleConnectionDeleted as EventHandler);
      console.log('🔌 [React Flow] Firebase 리스너 제거 완료');
    };
  }, [onNodeUpdate, setNodes, setEdges]);

  // ============================================================================
  // AI 일괄 생성 기능
  // ============================================================================
  const handleGenerateFromAI = useCallback(() => {
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
        onNodeUpdate
      );

      // 자동 레이아웃 적용
      const layouted = getLayoutedElements(flowNodes, flowEdges);

      // 상태 업데이트
      setNodes(layouted.nodes);
      setEdges(layouted.edges);

      // 로컬 notes/connections 상태도 업데이트
      onNotesChange(parsedNotes);
      onConnectionsChange(parsedConnections);

      // ⚡ Firebase 멀티유저 동기화
      console.log(`📤 [React Flow] Firebase 동기화 시작: ${parsedNotes.length}개 노드`);

      parsedNotes.forEach((note, index) => {
        setTimeout(() => {
          FirebaseMultiUserService.updateStickyNote({
            id: note.id,
            content: note.text || '',
            x: note.position.x,
            y: note.position.y,
            layer: note.layer || 1,
            color: note.sentiment || 'neutral',
            type: note.type || 'sticky_note',
            width: note.width || 200,
            height: note.height || 120,
          });
        }, index * 100); // 100ms 간격
      });

      parsedConnections.forEach((connection, index) => {
        setTimeout(
          () => {
            FirebaseMultiUserService.updateConnection(connection);
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
  }, [aiInput, onNodeUpdate, onNotesChange, onConnectionsChange, setNodes, setEdges]);

  // ============================================================================
  // 노드 변경 핸들러 + Firebase 동기화
  // ============================================================================
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
              result: 1,
              behavior: 2,
              tangible_lever: 3,
              intangible_lever: 4,
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

  // ============================================================================
  // 자동 레이아웃
  // ============================================================================
  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [nodes, edges, setNodes, setEdges]);

  // ============================================================================
  // 선택 변경 핸들러
  // ============================================================================
  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);
    setSelectedEdges(params.edges);
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
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'pane',
    });
  }, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      targetId: node.id,
    });
  }, []);

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
    setContextMenu(null);
  }, []);

  // 컨텍스트 메뉴 액션
  const handleContextMenuAction = useCallback(
    (action: string, position?: { x: number; y: number }) => {
      if (!contextMenu) return;

      // 빈 캔버스 우클릭 → 노드 생성
      if (contextMenu.type === 'pane' && position && action.startsWith('create_')) {
        const nodeType = action.replace('create_', '');
        const newNodeId = `node-${Date.now()}`;

        const newNode: Node = {
          id: newNodeId,
          type: nodeType,
          position: position,
          data: {
            content: '새 노트',
            sentiment: 'neutral',
            onUpdate: onNodeUpdate,
          },
        };

        setNodes((nds) => [...nds, newNode]);

        // Firebase 동기화
        const layerMap: { [key: string]: number } = {
          result: 1,
          behavior: 2,
          tangible_lever: 3,
          intangible_lever: 4,
        };

        FirebaseMultiUserService.updateStickyNote({
          id: newNodeId,
          content: '새 노트',
          x: position.x,
          y: position.y,
          layer: layerMap[nodeType] || 1,
          color: 'neutral',
          type: nodeType,
          width: 200,
          height: 120,
        });

        console.log('📌 [React Flow] 새 노드 생성:', newNodeId, nodeType);
        closeContextMenu();
        return;
      }

      if (contextMenu.type === 'node' && contextMenu.targetId) {
        const node = nodes.find((n) => n.id === contextMenu.targetId);
        if (!node) return;

        if (action === 'delete') {
          // 노드 삭제
          setNodes((nds) => nds.filter((n) => n.id !== contextMenu.targetId));
          setEdges((eds) =>
            eds.filter(
              (e) => e.source !== contextMenu.targetId && e.target !== contextMenu.targetId
            )
          );
          FirebaseMultiUserService.deleteStickyNote(contextMenu.targetId!);
        } else if (action === 'positive' || action === 'negative' || action === 'neutral') {
          // 색상 변경 + Firebase 동기화 + 연결선 색상 재계산
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === contextMenu.targetId) {
                const updatedNode = { ...n, data: { ...n.data, sentiment: action } };
                
                // Firebase 동기화
                const layerMap: { [key: string]: number } = {
                  result: 1,
                  behavior: 2,
                  tangible_lever: 3,
                  intangible_lever: 4,
                };
                
                FirebaseMultiUserService.updateStickyNote({
                  id: n.id,
                  content: (n.data as { content?: string }).content || '',
                  x: n.position.x,
                  y: n.position.y,
                  layer: layerMap[n.type || 'result'] || 1,
                  color: action,
                  type: n.type || 'sticky_note',
                  width: (n.width as number) || 200,
                  height: (n.height as number) || 120,
                });
                
                return updatedNode;
              }
              return n;
            })
          );
          
          // 연결선 색상 재계산
          setEdges((eds) =>
            eds.map((e) => {
              if (e.source === contextMenu.targetId || e.target === contextMenu.targetId) {
                const sourceNode = nodes.find((n) => n.id === e.source);
                const targetNode = nodes.find((n) => n.id === e.target);
                
                const sourceSentiment =
                  e.source === contextMenu.targetId
                    ? action
                    : (sourceNode?.data as { sentiment?: string })?.sentiment || 'neutral';
                const targetSentiment =
                  e.target === contextMenu.targetId
                    ? action
                    : (targetNode?.data as { sentiment?: string })?.sentiment || 'neutral';
                
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
                
                // Firebase 동기화
                FirebaseMultiUserService.updateConnection({
                  id: e.id,
                  sourceId: e.source,
                  targetId: e.target,
                  relationType: (e.data as { relationType?: string })?.relationType === 'indirect' ? 'indirect' : 'direct',
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
              }
              return e;
            })
          );
        }
      } else if (contextMenu.type === 'edge' && contextMenu.targetId) {
        const edge = edges.find((e) => e.id === contextMenu.targetId);
        if (!edge) return;

        if (action === 'delete') {
          // 엣지 삭제
          setEdges((eds) => eds.filter((e) => e.id !== contextMenu.targetId));
          FirebaseMultiUserService.deleteConnection(contextMenu.targetId!);
        } else if (action === 'direct' || action === 'indirect') {
          // 점선/실선 전환 + Firebase 동기화
          setEdges((eds) =>
            eds.map((e) => {
              if (e.id === contextMenu.targetId) {
                const updatedEdge = {
                  ...e,
                  animated: action === 'direct',
                  style: {
                    ...e.style,
                    strokeDasharray: action === 'indirect' ? '5,5' : undefined,
                  },
                  data: { ...e.data, relationType: action },
                };
                
                // Firebase 동기화
                FirebaseMultiUserService.updateConnection({
                  id: e.id,
                  sourceId: e.source,
                  targetId: e.target,
                  relationType: action,
                  isPositive: (e.data as { isPositive?: boolean })?.isPositive !== false,
                });
                
                return updatedEdge;
              }
              return e;
            })
          );
        }
      }

      closeContextMenu();
    },
    [contextMenu, nodes, edges, setNodes, setEdges, closeContextMenu, onNodeUpdate]
  );

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
        onNodeDoubleClick={handleNodeDoubleClick}
        onSelectionChange={handleSelectionChange}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
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
        
        {/* 층위 배경 구분선 */}
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {/* 결과 층 (Y=0~200) */}
          <rect x="-10000" y="0" width="20000" height="200" fill="rgba(255, 107, 107, 0.05)" />
          <line x1="-10000" y1="200" x2="10000" y2="200" stroke="rgba(255, 107, 107, 0.3)" strokeWidth="2" strokeDasharray="5,5" />
          <text x="10" y="20" fill="rgba(255, 107, 107, 0.6)" fontSize="14" fontWeight="bold">결과 (가시적 요소)</text>
          
          {/* 행동 층 (Y=200~400) */}
          <rect x="-10000" y="200" width="20000" height="200" fill="rgba(78, 205, 196, 0.05)" />
          <line x1="-10000" y1="400" x2="10000" y2="400" stroke="rgba(78, 205, 196, 0.3)" strokeWidth="2" strokeDasharray="5,5" />
          <text x="10" y="220" fill="rgba(78, 205, 196, 0.6)" fontSize="14" fontWeight="bold">행동 (관찰 행동)</text>
          
          {/* 유형 레버 층 (Y=400~600) */}
          <rect x="-10000" y="400" width="20000" height="200" fill="rgba(149, 225, 211, 0.05)" />
          <line x1="-10000" y1="600" x2="10000" y2="600" stroke="rgba(149, 225, 211, 0.3)" strokeWidth="2" strokeDasharray="5,5" />
          <text x="10" y="420" fill="rgba(149, 225, 211, 0.6)" fontSize="14" fontWeight="bold">유형 레버 (규범/가치)</text>
          
          {/* 무형 레버 층 (Y=600~800) */}
          <rect x="-10000" y="600" width="20000" height="200" fill="rgba(255, 230, 109, 0.05)" />
          <text x="10" y="620" fill="rgba(255, 230, 109, 0.6)" fontSize="14" fontWeight="bold">무형 레버 (기본 가정)</text>
        </svg>

        <Controls />
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
        <Panel position="top-left" className="layer-legend">
          <div className="legend-title">📊 4층위 모델</div>
          <button
            className="auto-layout-button"
            onClick={handleAutoLayout}
            title="자동 레이아웃 적용"
          >
            🔄 자동 정렬
          </button>
          <button
            className="ai-generate-button"
            onClick={() => setShowAiInput(!showAiInput)}
            title="AI 일괄 생성"
          >
            🤖 AI 일괄 생성
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
                  const position = {
                    x: contextMenu.x - 100,
                    y: contextMenu.y - 60,
                  };
                  handleContextMenuAction('create_result', position);
                }}
              >
                🔴 결과 (가시적 요소)
              </button>
              <button
                onClick={() => {
                  const position = {
                    x: contextMenu.x - 100,
                    y: contextMenu.y - 60,
                  };
                  handleContextMenuAction('create_behavior', position);
                }}
              >
                🟡 행동 (관찰 행동)
              </button>
              <button
                onClick={() => {
                  const position = {
                    x: contextMenu.x - 100,
                    y: contextMenu.y - 60,
                  };
                  handleContextMenuAction('create_tangible_lever', position);
                }}
              >
                🔵 유형 레버 (규범/가치)
              </button>
              <button
                onClick={() => {
                  const position = {
                    x: contextMenu.x - 100,
                    y: contextMenu.y - 60,
                  };
                  handleContextMenuAction('create_intangible_lever', position);
                }}
              >
                🟣 무형 레버 (기본 가정)
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
    </div>
  );
};

export default CultureMapFlow;
