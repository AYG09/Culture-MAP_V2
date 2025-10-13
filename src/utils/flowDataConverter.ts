// src/utils/flowDataConverter.ts
import type { Node, Edge } from '@xyflow/react';
import type { NoteData, ConnectionData } from '../types/culture';
import type {
  ResultNodeData,
  BehaviorNodeData,
  TangibleLeverNodeData,
  IntangibleLeverNodeData,
} from '../components/flow-nodes';

/**
 * 기존 NoteData를 React Flow Node로 변환
 */
export const convertNoteToFlowNode = (note: NoteData, onUpdate: (id: string, content: string) => void): Node => {
  // 층위에 따른 노드 타입 결정
  let nodeType: string;
  let nodeData: ResultNodeData | BehaviorNodeData | TangibleLeverNodeData | IntangibleLeverNodeData;

  const handleUpdate = (content: string) => onUpdate(note.id, content);

  // basis 문자열에서 정보 추출
  let author: string | undefined;
  let theory: string | undefined;
  let year: string | undefined;
  
  if (note.basis) {
    const authorMatch = note.basis.match(/저자:\s*([^,]+)/);
    const theoryMatch = note.basis.match(/이론:\s*([^,]+)/);
    const yearMatch = note.basis.match(/연도:\s*([^,)]+)/);
    
    if (authorMatch) author = authorMatch[1].trim();
    if (theoryMatch) theory = theoryMatch[1].trim();
    if (yearMatch) year = yearMatch[1].trim();
  }

  const baseData = {
    content: note.text || '',
    sentiment: note.sentiment || 'neutral',
    concept: note.perceptionIntensity, // 집중/관심/언급
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
  const data = node.data as
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
    basisString = `이론: ${data.basis}`;
  }
  if (data.source) {
    // source에서 author, year 추출
    const sourceMatch = data.source.match(/^(.+?)\s*\((\d{4})\)$/);
    if (sourceMatch && basisString) {
      const [, author, year] = sourceMatch;
      basisString = `저자: ${author}, ${basisString}, 연도: ${year}`;
    }
  }

  return {
    id: node.id,
    text: data.content,
    type: noteType,
    layer: layerIndex,
    sentiment: data.sentiment,
    perceptionIntensity: data.concept as '집중' | '관심' | '언급' | undefined, // 집중/관심/언급
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
      // 간접 연결일 때 점선 스타일 추가
      strokeDasharray: connection.relationType === 'indirect' ? '5,5' : undefined,
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
  return {
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    relationType: edge.type === 'step' ? 'indirect' : 'direct',
    isPositive: true, // 기본값
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
