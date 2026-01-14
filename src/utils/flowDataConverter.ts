// src/utils/flowDataConverter.ts
import type { Node, Edge } from '@xyflow/react';
import type { NoteData, ConnectionData, PerceptionIntensity } from '../types/culture';
import type {
  ResultNodeData,
  BehaviorNodeData,
  TangibleLeverNodeData,
  IntangibleLeverNodeData,
} from '../components/flow-nodes';

const extractBasisDisplay = (basis?: string): string | undefined => {
  if (!basis) {
    return undefined;
  }

  const inner = basis.trim().replace(/^\(/, '').replace(/\)$/, '').trim();
  if (!inner) {
    return undefined;
  }

  const legacyAuthor = inner.match(/저자:\s*([^,]+)/i);
  const legacyTheory = inner.match(/이론:\s*([^,]+)/i);
  const legacyYear = inner.match(/연도:\s*([^,)]+)/i);

  if (legacyAuthor && legacyTheory && legacyYear) {
    const author = legacyAuthor[1].trim();
    const theory = legacyTheory[1].trim();
    const year = legacyYear[1].trim();
    if (author && theory && year) {
      return `${author}, ${theory}, ${year}`;
    }
  }

  const parts = inner
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);

  if (parts.length === 3) {
    return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
  }

  return inner;
};

/**
 * 기존 NoteData를 React Flow Node로 변환
 */
type ActiveLock = {
  userId: string;
  itemType: 'note' | 'connection';
  displayName?: string;
};

interface ConversionOptions {
  currentUserId?: string | null;
  activeLock?: ActiveLock;
  onEditStart?: (id: string) => boolean | void;
  onEditEnd?: (id: string) => void;
  includeFrequency?: boolean;
}

export const convertNoteToFlowNode = (
  note: NoteData,
  onUpdate: (id: string, content: string) => void,
  options?: ConversionOptions
): Node => {
  // 층위에 따른 노드 타입 결정
  let nodeType: string;
  let nodeData: ResultNodeData | BehaviorNodeData | TangibleLeverNodeData | IntangibleLeverNodeData;

  const handleUpdate = (id: string, content: string) => {
    const targetId = id || note.id;
    onUpdate(targetId, content);
  };

  const handleEditStart = (id: string) => {
    const targetId = id || note.id;
    if (!options?.onEditStart) {
      return undefined;
    }
    return options.onEditStart(targetId);
  };

  const handleEditEnd = (id: string) => {
    const targetId = id || note.id;
    options?.onEditEnd?.(targetId);
  };

  const basisDisplay = extractBasisDisplay(note.basis);
  const includeFrequency = options?.includeFrequency ?? true;
  const frequencyValue = includeFrequency ? note.perceptionIntensity ?? null : undefined;

  const isLockedByOther = Boolean(
    options?.activeLock &&
    options.activeLock.itemType === 'note' &&
    options.activeLock.userId !== (options.currentUserId ?? undefined)
  );

  const lockLabel = options?.activeLock?.displayName ?? options?.activeLock?.userId;

  const baseData = {
    content: note.content || '', // text -> content
    sentiment: note.sentiment || 'neutral',
    frequency: frequencyValue,
    category: undefined,
    onUpdate: handleUpdate,
    onEditStart: options?.onEditStart ? handleEditStart : undefined,
    onEditEnd: options?.onEditEnd ? handleEditEnd : undefined,
    isLocked: isLockedByOther,
    lockedBy: lockLabel,
  };

  switch (note.type) {
    case '결과':
      nodeType = 'result';
      nodeData = baseData as ResultNodeData;
      break;
    case '행동':
      nodeType = 'behavior';
      nodeData = baseData as BehaviorNodeData;
      break;
    case '유형_레버':
      nodeType = 'tangible_lever';
      nodeData = {
        ...baseData,
        basis: basisDisplay
      } as TangibleLeverNodeData;
      break;
    case '무형_레버':
      nodeType = 'intangible_lever';
      nodeData = {
        ...baseData,
        basis: basisDisplay
      } as IntangibleLeverNodeData;
      break;
    default:
      nodeType = 'behavior'; // 기본값
      nodeData = baseData as BehaviorNodeData;
  }

  return {
    id: note.id,
    type: nodeType,
    position: { x: note.position.x, y: note.position.y },
    data: nodeData as unknown as Record<string, unknown>,
    selected: false,
  };
};

/**
 * React Flow Node를 NoteData로 변환
 */
export const convertFlowNodeToNote = (node: Node): NoteData => {
  const data = node.data as unknown as
    | ResultNodeData
    | BehaviorNodeData
    | TangibleLeverNodeData
    | IntangibleLeverNodeData;

  // 노드 타입에 따른 층위 결정
  let noteType: NoteData['type'];
  let layerIndex: 1 | 2 | 3 | 4;

  switch (node.type) {
    case 'result':
      noteType = '결과';
      layerIndex = 1;
      break;
    case 'behavior':
      noteType = '행동';
      layerIndex = 2;
      break;
    case 'tangible_lever':
      noteType = '유형_레버';
      layerIndex = 3;
      break;
    case 'intangible_lever':
      noteType = '무형_레버';
      layerIndex = 4;
      break;
    default:
      noteType = '행동';
      layerIndex = 2;
  }

  // basis 문자열 재구성
  const typedData = data as Partial<{ basis?: string; source?: string }>;
  const rawBasis = typeof typedData.basis === 'string' ? typedData.basis.trim() : undefined;

  let basisString = rawBasis ? extractBasisDisplay(rawBasis) ?? rawBasis : undefined;

  if (!basisString && typeof typedData.source === 'string') {
    const sourceMatch = typedData.source.match(/^(.+?)\s*\(([^)]+)\)$/);

    if (sourceMatch) {
      const [, author, year] = sourceMatch;
      if (author && year) {
        basisString = `${author.trim()}, ${year.trim()}`;
      }
    } else {
      basisString = typedData.source.trim();
    }
  }

  return {
    id: node.id,
    content: data.content, // text -> content
    type: noteType,
    layer: layerIndex,
    sentiment: data.sentiment,
    perceptionIntensity: data.frequency as PerceptionIntensity,
    position: { x: node.position.x, y: node.position.y },
    basis: basisString,
    width: 200,
    height: 120,
  };
};

/**
 * 기존 ConnectionData를 React Flow Edge로 변환
 */
export const convertConnectionToFlowEdge = (connection: ConnectionData): Edge => {
  const edgeColor = connection.isPositive !== false ? '#10b981' : '#ef4444';

  return {
    id: connection.id,
    source: connection.sourceId,
    target: connection.targetId,
    type: 'default',
    animated: connection.relationType === 'direct',
    style: {
      strokeWidth: 2,
      stroke: edgeColor,
      strokeDasharray: connection.relationType === 'indirect' ? '5 5' : undefined,
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
};

/**
 * React Flow Edge를 ConnectionData로 변환
 */
export const convertFlowEdgeToConnection = (edge: Edge): ConnectionData => {
  const relationTypeFromData = (edge.data as { relationType?: 'direct' | 'indirect' } | undefined)?.relationType;
  const relationTypeFromStyle = edge.style && 'strokeDasharray' in edge.style && edge.style.strokeDasharray ? 'indirect' : 'direct';
  const relationType = relationTypeFromData ?? relationTypeFromStyle;

  const isPositiveFromData = (edge.data as { isPositive?: boolean } | undefined)?.isPositive;
  const isPositive = isPositiveFromData !== undefined ? isPositiveFromData : true;

  return {
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    relationType,
    isPositive,
  };
};

/**
 * 배치: 기존 데이터 → React Flow 형식
 */
export const convertToFlowData = (
  notes: NoteData[],
  connections: ConnectionData[],
  onNodeUpdate: (id: string, content: string) => void,
  options?: {
    activeLocks?: Record<string, ActiveLock>;
    onNodeEditStart?: (id: string) => boolean | void;
    onNodeEditEnd?: (id: string) => void;
    currentUserId?: string | null;
    includeFrequency?: boolean;
  }
): { nodes: Node[]; edges: Edge[] } => {
  const nodes = notes.map((note) =>
    convertNoteToFlowNode(note, onNodeUpdate, {
      currentUserId: options?.currentUserId,
      activeLock: options?.activeLocks?.[note.id],
      onEditStart: options?.onNodeEditStart,
      onEditEnd: options?.onNodeEditEnd,
      includeFrequency: options?.includeFrequency,
    })
  );
  const edges = connections.map(convertConnectionToFlowEdge);

  return { nodes, edges };
};

/**
 * 배치: React Flow 형식 → 기존 데이터
 */
export const convertFromFlowData = (
  nodes: Node[],
  edges: Edge[]
): { notes: NoteData[]; connections: ConnectionData[] } => {
  const notes = nodes.map(convertFlowNodeToNote);
  const connections = edges.map(convertFlowEdgeToConnection);

  return { notes, connections };
};
