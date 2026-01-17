/**
 * AI Action Bridge Types
 * AI가 컬쳐맵을 직접 제어하기 위해 호출하는 도구(Function Calling)의 타입 정의
 */

import type { NoteType, PerceptionIntensity } from './culture';

export type ActionType =
    | 'ADD_NODE'
    | 'UPDATE_NODE'
    | 'DELETE_NODE'
    | 'ADD_NODES_WITH_CONNECTIONS'
    | 'CREATE_CONNECTION'
    | 'DELETE_CONNECTION'
    | 'AUTO_LAYOUT'
    | 'ADJUST_LAYER_HEIGHT'
    | 'SEARCH_ACADEMIC_THEORY';

export interface MapAction {
    type: ActionType;
    payload: any;
}

/**
 * 노드 추가 액션 페이로드
 */
export interface AddNodePayload {
    label: string;
    type: NoteType;
    layer: 1 | 2 | 3 | 4;
    content?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    intensity?: PerceptionIntensity;
    x?: number;
    y?: number;
}

/**
 * 노드 업데이트 액션 페이로드
 */
export interface UpdateNodePayload {
    id: string;
    label?: string;
    content?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    intensity?: PerceptionIntensity;
    x?: number;
    y?: number;
}

/**
 * 배치 노드 생성 입력
 */
export interface BatchNodeInput {
    tempId?: string;
    label: string;
    type: NoteType;
    layer: 1 | 2 | 3 | 4;
    content?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    intensity?: PerceptionIntensity;
    x?: number;
    y?: number;
}

/**
 * 배치 연결 생성 입력
 */
export interface BatchConnectionInput {
    sourceId: string;
    targetId: string;
    relationType?: 'direct' | 'indirect';
    isPositive?: boolean;
}

/**
 * 배치 노드+연결 생성 액션 페이로드
 */
export interface AddNodesWithConnectionsPayload {
    nodes: BatchNodeInput[];
    connections?: BatchConnectionInput[];
}

/**
 * 엣지 생성 액션 페이로드
 */
export interface CreateConnectionPayload {
    sourceId: string;
    targetId: string;
    label?: string;
    style?: 'solid' | 'dashed';
}

/**
 * Gemini SDK용 도구 선언(Function Declaration) 스키마
 */
export const MAP_TOOL_DECLARATIONS = [
    {
        name: 'add_node',
        description: 'MUST call this function when user asks to add, create, or make new sticky notes or nodes on the culture map. Trigger words: 추가, 생성, 만들어, 노드, 포스트잇, 결과, 행동, 동인. Examples: "결과 노드 추가해줘", "행동 2개 만들어", "새로운 포스트잇 생성"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                label: { type: 'string', description: 'Title of the sticky note (short and clear, in Korean)' },
                type: { type: 'string', enum: ['결과', '행동', '유형_레버', '무형_레버'], description: 'Layer type: 결과=Outcomes, 행동=Behaviors, 유형_레버=Tangible, 무형_레버=Intangible' },
                layer: { type: 'number', enum: [1, 2, 3, 4], description: 'Layer index (1:결과, 2:행동, 3:유형, 4:무형)' },
                content: { type: 'string', description: 'Detailed description (optional)' },
                sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'], description: 'Sentiment of the node' },
                intensity: { type: 'number', enum: [1, 2, 3, 4, 5], description: 'Perception intensity (1=low, 5=high)' }
            },
            required: ['label', 'type', 'layer'],
            propertyOrdering: ['label', 'type', 'layer', 'content', 'sentiment', 'intensity']
        }
    },
    {
        name: 'add_nodes_with_connections',
        description: 'MUST call when the user asks to create multiple nodes and their relationships in one request. Use tempId to reference newly created nodes inside connections. Examples: "A,B,C 노드 만들고 A-B, B-C 연결해줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                nodes: {
                    type: 'array',
                    description: 'Nodes to create in batch',
                    items: {
                        type: 'object',
                        properties: {
                            tempId: { type: 'string', description: 'Temporary ID to reference this node in connections (optional)' },
                            label: { type: 'string', description: 'Title of the sticky note (short and clear, in Korean)' },
                            type: { type: 'string', enum: ['결과', '행동', '유형_레버', '무형_레버'], description: 'Layer type: 결과=Outcomes, 행동=Behaviors, 유형_레버=Tangible, 무형_레버=Intangible' },
                            layer: { type: 'number', enum: [1, 2, 3, 4], description: 'Layer index (1:결과, 2:행동, 3:유형, 4:무형)' },
                            content: { type: 'string', description: 'Detailed description (optional)' },
                            sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'], description: 'Sentiment of the node' },
                            intensity: { type: 'number', enum: [1, 2, 3, 4, 5], description: 'Perception intensity (1=low, 5=high)' },
                            x: { type: 'number', description: 'X position (canvas coordinate, optional)' },
                            y: { type: 'number', description: 'Y position (canvas coordinate, optional)' }
                        },
                        required: ['label', 'type', 'layer'],
                        propertyOrdering: ['tempId', 'label', 'type', 'layer', 'content', 'sentiment', 'intensity', 'x', 'y']
                    }
                },
                connections: {
                    type: 'array',
                    description: 'Connections to create after nodes are added',
                    items: {
                        type: 'object',
                        properties: {
                            sourceId: { type: 'string', description: 'Source node ID or tempId (cause)' },
                            targetId: { type: 'string', description: 'Target node ID or tempId (effect)' },
                            relationType: { type: 'string', enum: ['direct', 'indirect'], description: 'Connection type (direct or indirect)' },
                            isPositive: { type: 'boolean', description: 'Whether the relation is positive (default: true)' }
                        },
                        required: ['sourceId', 'targetId'],
                        propertyOrdering: ['sourceId', 'targetId', 'relationType', 'isPositive']
                    }
                }
            },
            required: ['nodes'],
            propertyOrdering: ['nodes', 'connections']
        }
    },
    {
        name: 'update_node',
        description: 'MUST call when user wants to modify, edit, change, or update existing sticky notes. Trigger words: 수정, 변경, 고쳐, 바꿔, 업데이트. Examples: "노드 내용 수정해줘", "제목 변경"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the node to modify' },
                label: { type: 'string', description: 'New title' },
                content: { type: 'string', description: 'New detailed content' },
                sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                x: { type: 'number', description: 'New x position (canvas coordinate)' },
                y: { type: 'number', description: 'New y position (canvas coordinate)' }
            },
            required: ['id'],
            propertyOrdering: ['id', 'label', 'content', 'sentiment', 'x', 'y']
        }
    },
    {
        name: 'delete_node',
        description: 'MUST call when user wants to delete, remove, or clear sticky notes from the map. Trigger words: 삭제, 지워, 제거, 없애. Examples: "노드 삭제해줘", "포스트잇 지워"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the node to delete' }
            },
            required: ['id'],
            propertyOrdering: ['id']
        }
    },
    {
        name: 'create_connection',
        description: 'MUST call when user wants to connect, link, or draw lines between nodes. Trigger words: 연결, 선, 화살표, 관계, 인과. Examples: "두 노드 연결해줘", "관계 만들어"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                sourceId: { type: 'string', description: 'Source node ID (e.g., driver node)' },
                targetId: { type: 'string', description: 'Target node ID (e.g., behavior node)' },
                label: { type: 'string', description: 'Connection meaning (e.g., 강화함, 유발함, 방해함)' }
            },
            required: ['sourceId', 'targetId'],
            propertyOrdering: ['sourceId', 'targetId', 'label']
        }
    },
    {
        name: 'auto_layout',
        description: 'Call when user wants to organize, arrange, or tidy up the map layout. Trigger words: 정렬, 정리, 배치. Examples: "맵 정렬해줘", "레이아웃 정리"',
        parametersJsonSchema: { type: 'object', properties: {} }
    },
    {
        name: 'adjust_layer_height',
        description: 'Call when user wants to resize or adjust layer heights. Trigger words: 높이, 크기, 넓히기, 레이어. Examples: "레이어 높이 조절해줘", "공간 넓혀"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                layer: { type: 'number', enum: [1, 2, 3, 4], description: 'Layer index (1:결과, 2:행동, 3:유형, 4:무형)' },
                height: { type: 'number', description: 'New height in pixels (min: 100, max: 600)' }
            },
            required: ['layer', 'height'],
            propertyOrdering: ['layer', 'height']
        }
    },
    {
        name: 'load_academic_knowledge',
        description: `Call this tool ONLY when deep academic/theoretical knowledge is truly needed.
        
When to call:
- User asks about theories, frameworks, or academic concepts (샤인, 로빈스, 조직문화 이론 등)
- User requests analysis from academic perspective (학술적 관점, 이론적 분석)
- User asks about research, studies, or scholarly interpretations

When NOT to call:
- Simple greetings (안녕, 반가워)
- Node creation/editing requests (노드 추가해줘, 수정해줘)
- General conversation or questions about the program itself
- Layout or UI related requests

This loads relevant PDF documents which costs tokens, so use sparingly.`,
        parametersJsonSchema: {
            type: 'object',
            properties: {
                topic: { 
                    type: 'string', 
                    description: 'The academic topic to search for. Examples: "에드가 샤인 3계층 모델", "조직문화 변화관리", "로빈스 조직행동론"'
                }
            },
            required: ['topic'],
            propertyOrdering: ['topic']
        }
    }];