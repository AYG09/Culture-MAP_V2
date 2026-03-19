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

const resolveLayerKey = (value?: string): keyof typeof LAYER_CONFIG => {
  if (value && value in LAYER_CONFIG) {
    return value as keyof typeof LAYER_CONFIG;
  }
  return 'behavior';
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
const LAYER_PADDING_Y = 40;
export const LAYER_MAX_HEIGHT = 1000; // 레이어 최대 높이 (복잡한 선-후 관계 대응)
const INTRA_LAYER_ROW_OFFSET = 150; // 동일 레이어 내 선-후 관계 Y 오프셋
const NODE_MIN_PADDING = 30; // 노드 간 최소 간격 (겨침 방지)

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
  pinnedNodes?: Node[];  // 고정된 노드 목록 (위치 anchor 계산용)
  allEdges?: Edge[];     // 고정 노드 포함 전체 엣지 (연결 관계 파악용)
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

let elkEnginePromise: Promise<ElkLayoutEngine> | null = null;

async function getElkEngine(): Promise<ElkLayoutEngine> {
  if (!elkEnginePromise) {
    elkEnginePromise = import('elkjs/lib/elk.bundled.js').then((module) => {
      const ELKConstructor = module.default;
      return new ELKConstructor() as unknown as ElkLayoutEngine;
    });
  }

  return elkEnginePromise;
}

const DEFAULT_ELK_OPTIONS: ElkLayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '110',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '60',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP'
};

export function buildElkLayoutOptions(
  spacingPreset: LayoutSpacingPreset = 'normal'
): ElkLayoutOptions {
  if (spacingPreset === 'compact') {
    return {
      ...DEFAULT_ELK_OPTIONS,
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.edgeNodeBetweenLayers': '50',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '12'
    };
  }

  if (spacingPreset === 'wide') {
    return {
      ...DEFAULT_ELK_OPTIONS,
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '110',
      'elk.layered.spacing.edgeNodeBetweenLayers': '80',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '24'
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
    const layer = resolveLayerKey(node.type);
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, []);
    }
    nodesByLayer.get(layer)!.push(node);
  });

  // 2단계: 각 층위별로 Y 좌표 고정, X 좌표만 수평 배치
  const layoutedNodes: Node[] = [];

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const layoutPositionById = new Map<string, { x: number; y: number }>();

  // 고정 노드 정보 추출 (anchor 계산용)
  const pinnedNodes = options?.pinnedNodes ?? [];
  const allEdges = options?.allEdges ?? edges;
  const pinnedNodeById = new Map(pinnedNodes.map((node) => [node.id, node]));

  // 고정 노드의 위치를 layoutPositionById에 미리 등록 (anchor 계산에 사용)
  pinnedNodes.forEach((node) => {
    layoutPositionById.set(node.id, { x: node.position.x, y: node.position.y });
  });

  // 고정 노드와의 연결 관계 맵 구축 (떠다니는 노드 → 연결된 고정 노드들)
  const pinnedConnectionsByFloatingId = new Map<string, string[]>();
  allEdges.forEach((edge) => {
    const sourceIsPinned = pinnedNodeById.has(edge.source);
    const targetIsPinned = pinnedNodeById.has(edge.target);
    const sourceIsFloating = nodeById.has(edge.source);
    const targetIsFloating = nodeById.has(edge.target);

    if (sourceIsPinned && targetIsFloating) {
      const connections = pinnedConnectionsByFloatingId.get(edge.target) ?? [];
      connections.push(edge.source);
      pinnedConnectionsByFloatingId.set(edge.target, connections);
    }
    if (targetIsPinned && sourceIsFloating) {
      const connections = pinnedConnectionsByFloatingId.get(edge.source) ?? [];
      connections.push(edge.target);
      pinnedConnectionsByFloatingId.set(edge.source, connections);
    }
  });

  // 레이어별 고정 노드 점유 영역 계산 (겹침 방지용)
  const pinnedRangesByLayer = new Map<string, Array<{ start: number; end: number }>>();
  pinnedNodes.forEach((node) => {
    const layer = resolveLayerKey(node.type);
    const ranges = pinnedRangesByLayer.get(layer) ?? [];
    const width = getNodeWidth(node);
    ranges.push({ start: node.position.x, end: node.position.x + width });
    pinnedRangesByLayer.set(layer, ranges);
  });

  // 층위 순서 (위에서 아래로)
  const layerOrder = DISPLAY_LAYER_ORDER;

  const resolvedLayerHeights = layerOrder.map((layerKey) => {
    const layerNodes = nodesByLayer.get(layerKey) || [];
    const maxHeight = layerNodes.length
      ? Math.max(...layerNodes.map((node) => getNodeHeight(node)))
      : NODE_HEIGHT;
    const heightIndex = LAYER_HEIGHT_INDEX[layerKey] ?? 0;
    return Math.min(LAYER_MAX_HEIGHT, Math.max(layerHeights[heightIndex] ?? NODE_HEIGHT, maxHeight + LAYER_PADDING_Y));
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

    const sameLayerIds = new Set(layerNodes.map((node) => node.id));
    const sameLayerEdges = edges.filter(
      (edge) => sameLayerIds.has(edge.source) && sameLayerIds.has(edge.target)
    );
    const edgeDensity = sameLayerEdges.length / Math.max(1, layerNodes.length);
    const densityMultiplier = edgeDensity >= 1.5 ? 1.5 : edgeDensity >= 1 ? 1.3 : edgeDensity >= 0.6 ? 1.15 : 1;

    // 수평 간격 설정 (노드가 많거나 동일 레이어 연결이 많을수록 간격 확대)
    const spacingPreset: LayoutSpacingPreset = options?.spacingPreset ?? 'normal';
    const baseSpacing = spacingPreset === 'compact' ? 260 : spacingPreset === 'wide' ? 360 : 300;
    const expandedSpacing = spacingPreset === 'compact' ? 320 : spacingPreset === 'wide' ? 440 : 360;
    const horizontalSpacing = typeof options?.horizontalSpacing === 'number'
      ? options.horizontalSpacing
      : (layerNodes.length > 4 ? expandedSpacing : baseSpacing);
    const effectiveHorizontalSpacing = Math.round(horizontalSpacing * densityMultiplier);
    const minGap = Math.max(60, Math.round(effectiveHorizontalSpacing * 0.4));

    const scoredNodes = layerNodes.map((node, nodeIndex) => {
      const targetXValues: number[] = [];
      const sourceXValues: number[] = [];
      const pinnedXValues: number[] = [];  // 연결된 고정 노드들의 X 좌표

      if (previousLayerKey) {
        const sources = edgeSourcesByTarget.get(node.id) || [];
        sources.forEach((sourceId) => {
          if (!previousLayerIdSet.has(sourceId)) return;
          const positionX = layoutPositionById.get(sourceId)?.x ?? getNodeX(nodeById.get(sourceId));
          if (typeof positionX === 'number') {
            sourceXValues.push(positionX);
          }
        });
      }

      if (nextLayerKey) {
        const targets = edgeTargetsBySource.get(node.id) || [];
        targets.forEach((targetId) => {
          if (!nextLayerIdSet.has(targetId)) return;
          const positionX = layoutPositionById.get(targetId)?.x ?? getNodeX(nodeById.get(targetId));
          if (typeof positionX === 'number') {
            targetXValues.push(positionX);
          }
        });
      }

      // 연결된 고정 노드들의 X 좌표 수집 (핵심 수정)
      const connectedPinnedIds = pinnedConnectionsByFloatingId.get(node.id) ?? [];
      connectedPinnedIds.forEach((pinnedId) => {
        const pinnedNode = pinnedNodeById.get(pinnedId);
        if (pinnedNode) {
          const pinnedCenterX = pinnedNode.position.x + getNodeWidth(pinnedNode) / 2;
          pinnedXValues.push(pinnedCenterX);
        }
      });

      // 우선순위: 고정 노드 연결 > 다른 레이어 연결 > 기존 위치
      let preferredXValues = targetXValues.length > 0 ? targetXValues : sourceXValues;
      if (pinnedXValues.length > 0) {
        // 고정 노드 연결이 있으면 해당 X 값들을 preferredXValues에 병합 (가중치 2배)
        preferredXValues = [...preferredXValues, ...pinnedXValues, ...pinnedXValues];
      }

      const averageX = preferredXValues.length > 0
        ? preferredXValues.reduce((sum, value) => sum + value, 0) / preferredXValues.length
        : (getNodeX(node) ?? (nodeIndex * effectiveHorizontalSpacing + 120));

      return {
        node,
        score: averageX,
        fallbackIndex: nodeIndex,
        anchorX: averageX,
        hasPinnedConnection: pinnedXValues.length > 0,
      };
    });

    const scoredNodeById = new Map(scoredNodes.map((item) => [item.node.id, item]));

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

    const anchorXs = scoredNodes
      .map((item) => item.anchorX)
      .filter((value) => Number.isFinite(value));
    const sortedAnchors = [...anchorXs].sort((a, b) => a - b);
    const medianAnchorX = sortedAnchors.length
      ? sortedAnchors[Math.floor(sortedAnchors.length / 2)]
      : 120;
    const estimatedSpan = Math.max(0, layerNodes.length - 1) * minGap;
    const derivedStartX = Math.round(medianAnchorX - estimatedSpan / 2);
    const startX = options?.startX ?? Math.max(80, derivedStartX);

    // 동일 레이어 내 선-후 관계에 따른 depth 계산
    const depthById = new Map<string, number>();

    // 위상정렬 순서대로 depth 할당
    orderedNodes.forEach((node) => {
      let maxParentDepth = -1;

      // 같은 레이어 내에서 이 노드를 가리키는 source 노드들 확인
      edges.forEach((edge) => {
        if (edge.target === node.id && sameLayerIds.has(edge.source)) {
          const parentDepth = depthById.get(edge.source) ?? 0;
          maxParentDepth = Math.max(maxParentDepth, parentDepth);
        }
      });

      // 부모가 있으면 부모 depth + 1, 없으면 0
      depthById.set(node.id, maxParentDepth + 1);
    });

    // 최대 depth 확인
    const maxDepth = Math.max(0, ...Array.from(depthById.values()));
    const rowOffsetMultiplier = Math.min(2, 1 + maxDepth * 0.15 + Math.min(1, edgeDensity * 0.3));
    const rowOffset = Math.round(INTRA_LAYER_ROW_OFFSET * rowOffsetMultiplier);

    // X 좌표 배치를 위한 depth별 그룹화
    const nodesByDepth = new Map<number, Node[]>();
    orderedNodes.forEach((node) => {
      const depth = depthById.get(node.id) ?? 0;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(node);
    });

    // 각 depth별로 X 좌표 배치
    for (let depth = 0; depth <= maxDepth; depth++) {
      const depthNodes = nodesByDepth.get(depth) || [];

      // 이 depth의 Y 오프셋
      const yOffset = depth * rowOffset;

      // X 좌표 배치
      let cursorXForDepth = startX + depth * 50; // depth마다 약간씩 오른쪽으로 시작

      // 현재 레이어의 고정 노드 점유 영역
      const pinnedRanges = pinnedRangesByLayer.get(layerKey) ?? [];

      depthNodes.forEach((node) => {
        const scored = scoredNodes.find((item) => item.node.id === node.id);
        const anchorX = scored?.anchorX ?? cursorXForDepth;
        const width = getNodeWidth(node);
        let nextX = Math.max(anchorX, cursorXForDepth);

        // 고정 노드와 겹치는지 확인하고, 겹치면 오른쪽으로 밀어냄
        let attempts = 0;
        const maxAttempts = pinnedRanges.length + 1;
        while (attempts < maxAttempts) {
          const overlappingRange = pinnedRanges.find(
            (range) => !(nextX + width + NODE_MIN_PADDING <= range.start || nextX >= range.end + NODE_MIN_PADDING)
          );
          if (!overlappingRange) break;
          // 겹치는 고정 노드의 오른쪽으로 이동
          nextX = overlappingRange.end + NODE_MIN_PADDING;
          attempts++;
        }

        const position = {
          x: nextX,
          y: fixedY + yOffset,
        };

        layoutedNodes.push({
          ...node,
          position,
          // Handle 위치 설정
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom,
        });

        layoutPositionById.set(node.id, position);
        cursorXForDepth = nextX + width + minGap;
      });
    }
  });

  // 겨침 해결 후처리: 동일 레이어 내 노드간 겨침 방지
  const resolvedNodes = resolveAllNodeOverlaps(layoutedNodes);

  return {
    nodes: resolvedNodes,
    edges
  };
}

/**
 * 노드 겨침 해결 함수
 * 동일 레이어 내에서 겨치는 노드를 X축으로 밀어냄
 */
function resolveAllNodeOverlaps(nodes: Node[]): Node[] {
  // 레이어별 그룹화
  const nodesByLayer = new Map<string, Node[]>();
  nodes.forEach(node => {
    const layer = node.type || 'behavior';
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, []);
    }
    nodesByLayer.get(layer)!.push(node);
  });

  const resolvedNodes: Node[] = [];

  nodesByLayer.forEach((layerNodes) => {
    if (layerNodes.length <= 1) {
      resolvedNodes.push(...layerNodes);
      return;
    }

    // X 좌표로 정렬
    const sorted = [...layerNodes].sort((a, b) => a.position.x - b.position.x);

    // 순차적으로 겨침 해결
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevRight = prev.position.x + getNodeWidth(prev);
      const minX = prevRight + NODE_MIN_PADDING;

      if (curr.position.x < minX) {
        sorted[i] = {
          ...curr,
          position: { ...curr.position, x: minX }
        };
      }
    }

    resolvedNodes.push(...sorted);
  });

  return resolvedNodes;
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
  const elk = await getElkEngine();

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

    const children = layoutedGraph.children ?? [];
    if (children.length !== nodes.length) {
      console.warn('⚠️ [Layout] ELK 결과 노드 수 불일치, 기본 레이아웃으로 대체합니다.', {
        expected: nodes.length,
        actual: children.length,
      });
      return getBasicLayoutedElements(nodes, edges);
    }

    const layoutedById = new Map(
      children.map((node) => [node.id, node])
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

/**
 * 노드 핸들의 절대 좌표 계산
 */
function getHandlePosition(node: Node, handle: 'top' | 'bottom' | 'left' | 'right'): { x: number; y: number } {
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);
  const centerX = node.position.x + width / 2;
  const centerY = node.position.y + height / 2;

  switch (handle) {
    case 'top': return { x: centerX, y: node.position.y };
    case 'bottom': return { x: centerX, y: node.position.y + height };
    case 'left': return { x: node.position.x, y: centerY };
    case 'right': return { x: node.position.x + width, y: centerY };
  }
}

/**
 * 두 노드의 위치를 비교하여 최적의 sourceHandle/targetHandle 조합을 반환
 * - 소스/타겟으로 인과관계 결정 (핸들 위치는 인과와 무관)
 * - 거리상 가장 가까운 핸들끼리 연결
 */
export function getOptimalHandles(
  sourceNode: Node,
  targetNode: Node
): { sourceHandle: string; targetHandle: string } {
  const sourceCenter = getHandlePosition(sourceNode, 'bottom');
  const targetCenter = getHandlePosition(targetNode, 'top');

  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;

  const isVerticalDominant = Math.abs(deltaY) >= Math.abs(deltaX);

  if (isVerticalDominant) {
    const sourceHandle = deltaY >= 0 ? 'bottom' : 'top';
    const targetHandle = deltaY >= 0 ? 'top' : 'bottom';
    return { sourceHandle, targetHandle };
  }

  const sourceHandle = deltaX >= 0 ? 'right' : 'left';
  const targetHandle = deltaX >= 0 ? 'left' : 'right';
  return { sourceHandle, targetHandle };
}

/**
 * Edge에 최적의 Handle 정보를 적용
 */
export function applyOptimalHandlesToEdges(
  nodes: Node[],
  edges: Edge[],
  options?: {
    force?: boolean;
    pinnedNodeIds?: Set<string>;
  }
): Edge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const force = options?.force === true;
  const pinnedNodeIds = options?.pinnedNodeIds;

  return edges.map((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (!sourceNode || !targetNode) {
      return edge;
    }

    const hasPinnedHandleNode = pinnedNodeIds
      ? pinnedNodeIds.has(edge.source) || pinnedNodeIds.has(edge.target)
      : false;

    // 핸들 고정 노드는 항상 유지
    if (hasPinnedHandleNode) {
      return edge;
    }

    // 이미 sourceHandle/targetHandle이 있으면 유지 (force=false)
    if (!force && edge.sourceHandle && edge.targetHandle) {
      return edge;
    }

    const { sourceHandle, targetHandle } = getOptimalHandles(sourceNode, targetNode);

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });
}
