import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';

/**
 * dagre를 사용한 4층위 시스템 자동 레이아웃
 * 
 * 층위 구조:
 * - Layer 1 (결과): 최상단
 * - Layer 2 (행동): 상단
 * - Layer 3 (유형 레버): 하단
 * - Layer 4 (무형 레버): 최하단
 */

// 층위별 레이아웃 설정
// 🔧 FIX: rankdir='BT'에서 높은 rank가 위에 배치됨
const LAYER_CONFIG = {
  result: { rank: 3, color: '#FF6B6B' },           // rank 3 (최상위)
  behavior: { rank: 2, color: '#4ECDC4' },         // rank 2
  tangible_lever: { rank: 1, color: '#95E1D3' },   // rank 1
  intangible_lever: { rank: 0, color: '#FFE66D' }  // rank 0 (최하위)
};

// 레이아웃 옵션
const LAYOUT_OPTIONS = {
  rankdir: 'BT', // Bottom to Top (아래에서 위로) - 결과가 위에
  align: 'UL', // Upper Left 정렬
  nodesep: 100, // 노드 간 수평 간격
  ranksep: 150, // 층위 간 수직 간격
  marginx: 50, // X축 여백
  marginy: 50 // Y축 여백
};

// 노드 크기 (dagre 계산용)
const NODE_WIDTH = 250;
const NODE_HEIGHT = 120;

/**
 * 4층위 계층 구조로 노드 자동 배치
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options = LAYOUT_OPTIONS
): { nodes: Node[]; edges: Edge[] } {
  // dagre 그래프 생성
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph(options);

  // 노드를 층위별로 그룹화
  const nodesByLayer = new Map<string, Node[]>();
  nodes.forEach((node) => {
    const layer = node.type || 'result';
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, []);
    }
    nodesByLayer.get(layer)!.push(node);
  });

  // 각 노드를 dagre 그래프에 추가
  nodes.forEach((node) => {
    const layer = node.type || 'result';
    const rank = LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.rank ?? 0;

    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rank // 층위 순서 지정
    });
  });

  // 엣지 추가
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 레이아웃 계산
  dagre.layout(dagreGraph);

  // 계산된 위치를 노드에 적용
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2
      },
      // Handle 위치 설정
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom
    };
  });

  return {
    nodes: layoutedNodes,
    edges
  };
}

/**
 * 특정 층위의 노드만 수평으로 재배치
 */
export function relayoutLayer(
  nodes: Node[],
  layer: string,
  startX = 100,
  startY = 100,
  spacing = 300
): Node[] {
  return nodes.map((node) => {
    if (node.type === layer) {
      // 같은 층위의 노드들을 수평으로 나열
      const layerNodes = nodes.filter((n) => n.type === layer);
      const nodeIndex = layerNodes.findIndex((n) => n.id === node.id);
      
      return {
        ...node,
        position: {
          x: startX + nodeIndex * spacing,
          y: startY
        }
      };
    }
    return node;
  });
}

/**
 * 선택된 노드들을 중심으로 재배치
 */
export function centerLayout(
  nodes: Node[],
  edges: Edge[],
  viewportWidth = 1200,
  viewportHeight = 800
): { nodes: Node[]; edges: Edge[] } {
  const layouted = getLayoutedElements(nodes, edges);
  
  // 모든 노드의 경계 박스 계산
  const bounds = layouted.nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position.x),
      minY: Math.min(acc.minY, node.position.y),
      maxX: Math.max(acc.maxX, node.position.x + NODE_WIDTH),
      maxY: Math.max(acc.maxY, node.position.y + NODE_HEIGHT)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  // 중앙 정렬 오프셋 계산
  const offsetX = (viewportWidth - width) / 2 - bounds.minX;
  const offsetY = (viewportHeight - height) / 2 - bounds.minY;

  // 노드 위치 조정
  const centeredNodes = layouted.nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY
    }
  }));

  return {
    nodes: centeredNodes,
    edges: layouted.edges
  };
}

/**
 * 층위별 Y 좌표 계산
 */
export function getLayerY(layer: string): number {
  const rank = LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.rank ?? 0;
  return 100 + rank * (NODE_HEIGHT + LAYOUT_OPTIONS.ranksep);
}

/**
 * 층위별 색상 가져오기
 */
export function getLayerColor(layer: string): string {
  return LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.color ?? '#888888';
}
