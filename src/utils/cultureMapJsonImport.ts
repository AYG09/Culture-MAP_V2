import type { Edge, Node, Viewport } from '@xyflow/react';

type ImportNodeData = Record<string, unknown> & {
  content?: string;
  sentiment?: string;
  pinned?: boolean;
  pinnedHandles?: boolean;
};

type ParsedCultureMapJson = {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
  layerHeights?: number[];
  layerOpacities?: number[];
};

const FLOW_NODE_TYPES = new Set(['result', 'behavior', 'tangible_lever', 'intangible_lever']);
const SENTIMENTS = new Set(['positive', 'negative', 'neutral']);

const toRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
};

const toNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const normalizeNodeType = (rawType: unknown, rawLayer: unknown): string => {
  if (typeof rawType === 'string') {
    if (FLOW_NODE_TYPES.has(rawType)) return rawType;
    if (rawType === '결과') return 'result';
    if (rawType === '행동') return 'behavior';
    if (rawType === '유형_레버') return 'tangible_lever';
    if (rawType === '무형_레버') return 'intangible_lever';
  }

  const layer = toNumber(rawLayer, 2);
  if (layer === 1) return 'result';
  if (layer === 3) return 'tangible_lever';
  if (layer === 4) return 'intangible_lever';
  return 'behavior';
};

const layerFromType = (type: string): number => {
  if (type === 'result') return 1;
  if (type === 'tangible_lever') return 3;
  if (type === 'intangible_lever') return 4;
  return 2;
};

const normalizeLayerArray = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const result = value.map((item) => toNumber(item, NaN));
  return result.every(Number.isFinite) ? result : undefined;
};

const normalizeViewport = (value: unknown): Viewport | undefined => {
  const record = toRecord(value);
  if (!record) return undefined;
  const x = toNumber(record.x, NaN);
  const y = toNumber(record.y, NaN);
  const zoom = toNumber(record.zoom, NaN);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) ? { x, y, zoom } : undefined;
};

const extractNodes = (root: Record<string, unknown>): Node[] => {
  const rawNodes = Array.isArray(root.nodes) ? root.nodes : [];
  const nodesById = new Map<string, Node>();

  rawNodes.forEach((item, index) => {
    const raw = toRecord(item);
    if (!raw) return;

    const data = toRecord(raw.data) ?? {};
    const position = toRecord(raw.position) ?? {};
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `node-import-${index}`;
    const type = normalizeNodeType(raw.type ?? data.type, raw.layer ?? data.layer);
    const layer = toNumber(raw.layer ?? data.layer, layerFromType(type));
    const content = typeof data.content === 'string'
      ? data.content
      : typeof raw.content === 'string'
        ? raw.content
        : typeof raw.label === 'string'
          ? raw.label
          : '';
    const rawSentiment = typeof data.sentiment === 'string' ? data.sentiment : raw.sentiment;
    const sentiment = typeof rawSentiment === 'string' && SENTIMENTS.has(rawSentiment) ? rawSentiment : 'neutral';

    const nodeData: ImportNodeData = {
      ...data,
      content,
      sentiment,
      type,
      layer,
      pinned: data.pinned === true || raw.pinned === true,
      pinnedHandles: data.pinnedHandles === true || raw.pinnedHandles === true,
    };

    nodesById.set(id, {
      ...raw,
      id,
      type,
      position: {
        x: toNumber(position.x ?? raw.x, 100 + index * 40),
        y: toNumber(position.y ?? raw.y, 100 + index * 30),
      },
      data: nodeData,
      selected: false,
      draggable: nodeData.pinned !== true,
    } as Node);
  });

  return Array.from(nodesById.values());
};

const extractEdges = (root: Record<string, unknown>, nodeIds: Set<string>): Edge[] => {
  const rawEdges = Array.isArray(root.edges)
    ? root.edges
    : Array.isArray(root.connections)
      ? root.connections
      : [];
  const edgesById = new Map<string, Edge>();

  rawEdges.forEach((item, index) => {
    const raw = toRecord(item);
    if (!raw) return;

    const data = toRecord(raw.data) ?? {};
    const source = typeof raw.source === 'string'
      ? raw.source
      : typeof raw.sourceId === 'string'
        ? raw.sourceId
        : '';
    const target = typeof raw.target === 'string'
      ? raw.target
      : typeof raw.targetId === 'string'
        ? raw.targetId
        : '';

    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return;

    const relationType = data.relationType === 'indirect' || raw.relationType === 'indirect' ? 'indirect' : 'direct';
    const isPositive = typeof data.isPositive === 'boolean'
      ? data.isPositive
      : typeof raw.isPositive === 'boolean'
        ? raw.isPositive
        : true;
    const edgeColor = isPositive ? '#10b981' : '#ef4444';
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `edge-${source}-${target}-${index}`;

    edgesById.set(id, {
      ...raw,
      id,
      source,
      target,
      sourceHandle: typeof raw.sourceHandle === 'string' ? raw.sourceHandle : undefined,
      targetHandle: typeof raw.targetHandle === 'string' ? raw.targetHandle : undefined,
      type: 'animatedFlow',
      style: {
        ...(toRecord(raw.style) ?? {}),
        strokeWidth: toNumber(toRecord(raw.style)?.strokeWidth, 2),
        stroke: typeof toRecord(raw.style)?.stroke === 'string' ? toRecord(raw.style)?.stroke : edgeColor,
        strokeDasharray: relationType === 'indirect' ? '5 5' : undefined,
      },
      markerEnd: toRecord(raw.markerEnd) ?? { type: 'arrowclosed', width: 20, height: 20, color: edgeColor },
      data: {
        ...data,
        relationType,
        isPositive,
      },
    } as Edge);
  });

  return Array.from(edgesById.values());
};

export const parseCultureMapJson = (text: string): ParsedCultureMapJson => {
  const parsed = JSON.parse(text) as unknown;
  const root = toRecord(parsed);
  if (!root) {
    throw new Error('JSON 최상위 구조가 객체가 아닙니다.');
  }

  const nodes = extractNodes(root);
  if (nodes.length === 0) {
    throw new Error('복원할 노드가 없습니다. nodes 배열이 포함된 컬쳐맵 JSON인지 확인해주세요.');
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = extractEdges(root, nodeIds);

  return {
    nodes,
    edges,
    viewport: normalizeViewport(root.viewport),
    layerHeights: normalizeLayerArray(root.layerHeights),
    layerOpacities: normalizeLayerArray(root.layerOpacities),
  };
};
