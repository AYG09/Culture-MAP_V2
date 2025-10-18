// src/utils/flowDataConverter.ts
import type { Node, Edge } from '@xyflow/react';
import type { NoteData, ConnectionData, PerceptionIntensity } from '../types/culture';
import type {
  ResultNodeData,
  BehaviorNodeData,
  TangibleLeverNodeData,
  IntangibleLeverNodeData,
} from '../components/flow-nodes';

/**
 * 기존 NoteData를 React Flow Node로 변환
 */
export const convertNoteToFlowNode = (
  note: NoteData,
  onUpdate: (id: string, content: string) => void
): Node => {
  // 층위에 따른 노드 타입 결정
  let nodeType: string;
  let nodeData: ResultNodeData | BehaviorNodeData | TangibleLeverNodeData | IntangibleLeverNodeData;

  const handleUpdate = (id: string, content: string) => {
    const targetId = id || note.id;
    onUpdate(targetId, content);
  };

  // basis 문자열에서 정보 추출
  let author: string | undefined;
  let theory: string | undefined;
  let year: string | undefined;
  
  if (note.basis) {
    // 새로운 형식: "(학자명, 이론명, 연도)" 파싱
    const newFormatMatch = note.basis.match(/^\(?([^,]+),\s*([^,]+),\s*(\d{4})\)?$/);
    if (newFormatMatch) {
      author = newFormatMatch[1].trim();
      theory = newFormatMatch[2].trim();
      year = newFormatMatch[3].trim();
    } else {
      // 레거시 형식: "저자: XXX, 이론: YYY, 연도: ZZZZ"
      const authorMatch = note.basis.match(/저자:\s*([^,]+)/);
      const theoryMatch = note.basis.match(/이론:\s*([^,]+)/);
      const yearMatch = note.basis.match(/연도:\s*([^,)]+)/);
      
      if (authorMatch) author = authorMatch[1].trim();
      if (theoryMatch) theory = theoryMatch[1].trim();
      if (yearMatch) year = yearMatch[1].trim();
    }
  }

  const baseData = {
    content: note.text || '',
    sentiment: note.sentiment || 'neutral',
    frequency: note.perceptionIntensity, // ✅ 수정: perceptionIntensity를 frequency로 매핑
    source: author && year ? `${author} (${year})` : undefined, // 저자 (연도)
    category: undefined, // NoteData에는 없음
    onUpdate: handleUpdate,
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
        basis: theory // 이론명
      } as TangibleLeverNodeData;
      break;
    case '무형_레버':
      nodeType = 'intangible_lever';
      nodeData = { 
        ...baseData, 
        basis: theory // 이론명
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
  let basisString: string | undefined;
  if ('basis' in data && data.basis) {
    // theory만 있음
    basisString = data.basis; // 이미 "이론명" 형태
  }
  if (data.source) {
    // source에서 author, year 추출
    const sourceMatch = data.source.match(/^(.+?)\s*\((\d{4})\)$/);
    if (sourceMatch) {
      const [, author, year] = sourceMatch;
      if (basisString) {
        // 새 형식: "학자명, 이론명, 연도"
        basisString = `${author}, ${basisString}, ${year}`;
      } else {
        basisString = `${author}, ${year}`;
      }
    }
  }

  return {
    id: node.id,
    text: data.content,
    type: noteType,
    layer: layerIndex,
    sentiment: data.sentiment,
    perceptionIntensity: data.frequency as PerceptionIntensity, // ✅ 수정: frequency를 perceptionIntensity로 복원
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
  onNodeUpdate: (id: string, content: string) => void
): { nodes: Node[]; edges: Edge[] } => {
  const nodes = notes.map((note) => convertNoteToFlowNode(note, onNodeUpdate));
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
