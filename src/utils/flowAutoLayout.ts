import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';

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
const LAYER_CONFIG = {
  result: { rank: 3, color: '#FF6B6B' },
  behavior: { rank: 2, color: '#4ECDC4' },
  tangible_lever: { rank: 1, color: '#95E1D3' },
  intangible_lever: { rank: 0, color: '#FFE66D' }
};

const LAYER_HEIGHT_INDEX: Record<keyof typeof LAYER_CONFIG, number> = {
  result: 0,
  behavior: 1,
  tangible_lever: 2,
  intangible_lever: 3
};

const DISPLAY_LAYER_ORDER: Array<keyof typeof LAYER_CONFIG> = [
  'result',
  'behavior',
  'tangible_lever',
  'intangible_lever'
];

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
const LAYER_PADDING_Y = 40;

/**
 * 4층위 계층 구조로 노드 자동 배치
 * ⚡ 개선: 층위별 Y 좌표 강제 고정 (순환 연결 대응)
 * ⚡ 개선2: 층위별 개별 높이 지원 (레거시 모드와 동일)
 */
type LayoutSpacingPreset = 'compact' | 'normal' | 'wide';

type LayoutOptions = {
  layerHeights?: number[];
  spacingPreset?: LayoutSpacingPreset;
  horizontalSpacing?: number;
  startX?: number;
};

type ElkLayoutOptions = Record<string, string>;

type ElkNode = {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  layoutOptions?: ElkLayoutOptions;
};

type ElkEdge = {
  id: string;
  sources: string[];
  targets: string[];
};

type ElkGraph = {
  id: string;
  layoutOptions?: ElkLayoutOptions;
  children: ElkNode[];
  edges: ElkEdge[];
};

type ElkLayoutEngine = {
  layout: (graph: ElkGraph, options?: { layoutOptions?: ElkLayoutOptions }) => Promise<ElkGraph>;
};

const elk = new ELK() as unknown as ElkLayoutEngine;

const DEFAULT_ELK_OPTIONS: ElkLayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '110',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '60',
  'elk.edgeRouting': 'ORTHOGONAL'
};

export function buildElkLayoutOptions(
  spacingPreset: LayoutSpacingPreset = 'normal'
): ElkLayoutOptions {
  if (spacingPreset === 'compact') {
    return {
      ...DEFAULT_ELK_OPTIONS,
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.edgeNodeBetweenLayers': '50'
    };
  }

  if (spacingPreset === 'wide') {
    return {
      ...DEFAULT_ELK_OPTIONS,
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '110',
      'elk.layered.spacing.edgeNodeBetweenLayers': '80'
    };
  }

  return { ...DEFAULT_ELK_OPTIONS };
}

const getNodeWidth = (node: Node): number => {
  if (typeof node.measured?.width === 'number') return node.measured.width;
  if (typeof node.width === 'number') return node.width;
  return NODE_WIDTH;
};

const getNodeHeight = (node: Node): number => {
  if (typeof node.measured?.height === 'number') return node.measured.height;
  if (typeof node.height === 'number') return node.height;
  return NODE_HEIGHT;
};

const getNodeX = (node?: Node): number | undefined => {
  if (!node) return undefined;
  const currentX = node.position?.x;
  return typeof currentX === 'number' ? currentX : undefined;
};

function getBasicLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  layerHeightsOrSpacing: number[] | number | LayoutOptions = 200 // 층위별 높이 배열 또는 일괄 간격
): { nodes: Node[]; edges: Edge[] } {
  const options =
    typeof layerHeightsOrSpacing === 'object' && !Array.isArray(layerHeightsOrSpacing)
      ? layerHeightsOrSpacing
      : undefined;

  const defaultHeight = typeof layerHeightsOrSpacing === 'number' ? layerHeightsOrSpacing : 200;

  // layerHeightsOrSpacing이 배열이면 개별 높이, 숫자면 일괄 간격
  const layerHeights = Array.isArray(layerHeightsOrSpacing)
    ? layerHeightsOrSpacing
    : (options?.layerHeights ?? [defaultHeight, defaultHeight, defaultHeight, defaultHeight]);

  // 1단계: 노드를 층위별로 그룹화
  const nodesByLayer = new Map<string, Node[]>();
  nodes.forEach((node) => {
    const layer = node.type || 'result';
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, []);
    }
    nodesByLayer.get(layer)!.push(node);
  });

  // 2단계: 각 층위별로 Y 좌표 고정, X 좌표만 수평 배치
  const layoutedNodes: Node[] = [];

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const layoutPositionById = new Map<string, { x: number; y: number }>();

  // 층위 순서 (위에서 아래로)
  const layerOrder = DISPLAY_LAYER_ORDER;

  const resolvedLayerHeights = layerOrder.map((layerKey) => {
    const layerNodes = nodesByLayer.get(layerKey) || [];
    const maxHeight = layerNodes.length
      ? Math.max(...layerNodes.map((node) => getNodeHeight(node)))
      : NODE_HEIGHT;
    const heightIndex = LAYER_HEIGHT_INDEX[layerKey] ?? 0;
    return Math.min(800, Math.max(layerHeights[heightIndex] ?? NODE_HEIGHT, maxHeight + LAYER_PADDING_Y));
  });

  layerOrder.forEach((layerKey, layerIndex) => {
    const layerNodes = nodesByLayer.get(layerKey) || [];
    if (layerNodes.length === 0) return;

    const previousLayerKey = layerIndex > 0 ? layerOrder[layerIndex - 1] : null;
    const nextLayerKey = layerIndex < layerOrder.length - 1 ? layerOrder[layerIndex + 1] : null;
    const previousLayerNodes = previousLayerKey ? (nodesByLayer.get(previousLayerKey) || []) : [];
    const nextLayerNodes = nextLayerKey ? (nodesByLayer.get(nextLayerKey) || []) : [];

    const previousLayerIdSet = new Set(previousLayerNodes.map((node) => node.id));
    const nextLayerIdSet = new Set(nextLayerNodes.map((node) => node.id));

    const edgeTargetsBySource = new Map<string, string[]>();
    const edgeSourcesByTarget = new Map<string, string[]>();

    edges.forEach((edge) => {
      if (!edgeTargetsBySource.has(edge.source)) {
        edgeTargetsBySource.set(edge.source, []);
      }
      edgeTargetsBySource.get(edge.source)!.push(edge.target);

      if (!edgeSourcesByTarget.has(edge.target)) {
        edgeSourcesByTarget.set(edge.target, []);
      }
      edgeSourcesByTarget.get(edge.target)!.push(edge.source);
    });

    // 각 층위의 Y 좌표를 개별 높이에 따라 계산
    let fixedY = 0;
    for (let i = 0; i < layerIndex; i++) {
      fixedY += resolvedLayerHeights[i] ?? 0;
    }

    // 수평 간격 설정 (노드가 많을수록 간격 확대)
    const spacingPreset: LayoutSpacingPreset = options?.spacingPreset ?? 'normal';
    const baseSpacing = spacingPreset === 'compact' ? 260 : spacingPreset === 'wide' ? 360 : 300;
    const expandedSpacing = spacingPreset === 'compact' ? 320 : spacingPreset === 'wide' ? 440 : 360;
    const horizontalSpacing = typeof options?.horizontalSpacing === 'number'
      ? options.horizontalSpacing
      : (layerNodes.length > 4 ? expandedSpacing : baseSpacing);
    const minGap = Math.max(60, Math.round(horizontalSpacing * 0.4));

    const scoredNodes = layerNodes.map((node, nodeIndex) => {
      const neighborX: number[] = [];

      if (previousLayerKey) {
        const sources = edgeSourcesByTarget.get(node.id) || [];
        sources.forEach((sourceId) => {
          if (!previousLayerIdSet.has(sourceId)) return;
          const positionX = layoutPositionById.get(sourceId)?.x ?? getNodeX(nodeById.get(sourceId));
          if (typeof positionX === 'number') {
            neighborX.push(positionX);
          }
        });
      }

      if (nextLayerKey) {
        const targets = edgeTargetsBySource.get(node.id) || [];
        targets.forEach((targetId) => {
          if (!nextLayerIdSet.has(targetId)) return;
          const positionX = layoutPositionById.get(targetId)?.x ?? getNodeX(nodeById.get(targetId));
          if (typeof positionX === 'number') {
            neighborX.push(positionX);
          }
        });
      }

      const averageX = neighborX.length > 0
        ? neighborX.reduce((sum, value) => sum + value, 0) / neighborX.length
        : getNodeX(node) ?? (nodeIndex * horizontalSpacing + 120);

      return {
        node,
        score: averageX,
        fallbackIndex: nodeIndex,
        anchorX: averageX,
      };
    });

    const scoredNodeById = new Map(scoredNodes.map((item) => [item.node.id, item]));
    const sameLayerIds = new Set(layerNodes.map((node) => node.id));

    const nextById = new Map<string, Set<string>>();
    const indegreeById = new Map<string, number>();
    layerNodes.forEach((node) => {
      nextById.set(node.id, new Set());
      indegreeById.set(node.id, 0);
    });

    edges.forEach((edge) => {
      if (!sameLayerIds.has(edge.source) || !sameLayerIds.has(edge.target)) {
        return;
      }
      const nextSet = nextById.get(edge.source);
      if (!nextSet || nextSet.has(edge.target)) {
        return;
      }
      nextSet.add(edge.target);
      indegreeById.set(edge.target, (indegreeById.get(edge.target) ?? 0) + 1);
    });

    const queue = layerNodes
      .filter((node) => (indegreeById.get(node.id) ?? 0) === 0)
      .sort((a, b) => {
        const scoreA = scoredNodeById.get(a.id)?.score ?? 0;
        const scoreB = scoredNodeById.get(b.id)?.score ?? 0;
        if (scoreA === scoreB) {
          return (scoredNodeById.get(a.id)?.fallbackIndex ?? 0) - (scoredNodeById.get(b.id)?.fallbackIndex ?? 0);
        }
        return scoreA - scoreB;
      });

    const orderedNodes: Node[] = [];

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      orderedNodes.push(current);

      const nextNodes = nextById.get(current.id);
      if (!nextNodes) continue;
      nextNodes.forEach((nextId) => {
        const nextIndegree = (indegreeById.get(nextId) ?? 0) - 1;
        indegreeById.set(nextId, nextIndegree);
        if (nextIndegree === 0) {
          const nextNode = nodeById.get(nextId);
          if (nextNode) {
            queue.push(nextNode);
            queue.sort((a, b) => {
              const scoreA = scoredNodeById.get(a.id)?.score ?? 0;
              const scoreB = scoredNodeById.get(b.id)?.score ?? 0;
              if (scoreA === scoreB) {
                return (scoredNodeById.get(a.id)?.fallbackIndex ?? 0) - (scoredNodeById.get(b.id)?.fallbackIndex ?? 0);
              }
              return scoreA - scoreB;
            });
          }
        }
      });
    }

    if (orderedNodes.length < layerNodes.length) {
      const remainingNodes = layerNodes
        .filter((node) => !orderedNodes.find((item) => item.id === node.id))
        .sort((a, b) => {
          const scoreA = scoredNodeById.get(a.id)?.score ?? 0;
          const scoreB = scoredNodeById.get(b.id)?.score ?? 0;
          if (scoreA === scoreB) {
            return (scoredNodeById.get(a.id)?.fallbackIndex ?? 0) - (scoredNodeById.get(b.id)?.fallbackIndex ?? 0);
          }
          return scoreA - scoreB;
        });
      orderedNodes.push(...remainingNodes);
    }

    const anchorXs = scoredNodes.map((item) => item.anchorX);
    const minAnchorX = anchorXs.length ? Math.min(...anchorXs) : 120;
    const startX = options?.startX ?? Math.max(80, Math.floor(minAnchorX));

    let cursorX = startX;

    // 같은 층위의 노드들을 수평으로 나열 (앵커 보존 + 충돌 최소화)
    orderedNodes.forEach((node) => {
      const scored = scoredNodes.find((item) => item.node.id === node.id);
      const anchorX = scored?.anchorX ?? cursorX;
      const width = getNodeWidth(node);
      const nextX = Math.max(anchorX, cursorX);

      const position = {
        x: nextX,
        y: fixedY,
      };

      layoutedNodes.push({
        ...node,
        position,
        // Handle 위치 설정
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
      });

      layoutPositionById.set(node.id, position);
      cursorX = nextX + width + minGap;
    });
  });

  return {
    nodes: layoutedNodes,
    edges
  };
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  layerHeightsOrSpacing: number[] | number | LayoutOptions = 200
): { nodes: Node[]; edges: Edge[] } {
  return getBasicLayoutedElements(nodes, edges, layerHeightsOrSpacing);
}

export async function getElkLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  layoutOptions: ElkLayoutOptions = DEFAULT_ELK_OPTIONS
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: getNodeWidth(node),
    height: getNodeHeight(node)
  }));

  const elkEdges: ElkEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target]
  }));

  const graph: ElkGraph = {
    id: 'root',
    layoutOptions: { ...DEFAULT_ELK_OPTIONS, ...layoutOptions },
    children: elkNodes,
    edges: elkEdges
  };

  try {
    const layoutedGraph = await elk.layout(graph, {
      layoutOptions: graph.layoutOptions
    });

    const layoutedById = new Map(
      (layoutedGraph.children ?? []).map((node) => [node.id, node])
    );

    const layoutedNodes = nodes.map((node) => {
      const layouted = layoutedById.get(node.id);
      if (!layouted || typeof layouted.x !== 'number' || typeof layouted.y !== 'number') {
        return node;
      }

      return {
        ...node,
        position: { x: layouted.x, y: layouted.y },
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom
      };
    });

    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.warn('⚠️ [Layout] ELK 레이아웃 실패, 기본 레이아웃으로 대체합니다.', error);
    return getBasicLayoutedElements(nodes, edges);
  }
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
  const layerKey = layer as keyof typeof LAYER_CONFIG;
  const orderIndex = DISPLAY_LAYER_ORDER.indexOf(layerKey);
  const resolvedIndex = orderIndex >= 0 ? orderIndex : 0;
  return 100 + resolvedIndex * (NODE_HEIGHT + LAYOUT_OPTIONS.ranksep);
}

/**
 * 층위별 색상 가져오기
 */
export function getLayerColor(layer: string): string {
  return LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.color ?? '#888888';
}
