/**
 * AI Action Bridge Types
 * AI가 컬쳐맵을 직접 제어하기 위해 호출하는 도구(Function Calling)의 타입 정의
 */

import type { NoteType, PerceptionIntensity } from './culture';

export type ActionType =
    | 'ADD_NODE'
    | 'UPDATE_NODE'
    | 'DELETE_NODE'
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
        description: '컬쳐맵에 새로운 포스트잇(노드)을 추가합니다.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                label: { type: 'string', description: '포스트잇 제목 (짧고 명확하게)' },
                type: { type: 'string', enum: ['결과', '행동', '유형_레버', '무형_레버'], description: '데이브 그레이 모델의 층위 유형' },
                layer: { type: 'number', enum: [1, 2, 3, 4], description: '층위 인덱스 (1:결과, 2:행동, 3:유형, 4:무형)' },
                content: { type: 'string', description: '상세 설명/내용' },
                sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'], description: '긍정/부정/중립 감성' },
                intensity: { type: 'number', enum: [1, 2, 3, 4, 5], description: '인식 강도 (1=낮음, 5=높음)' }
            },
            required: ['label', 'type', 'layer']
        }
    },
    {
        name: 'update_node',
        description: '기존 포스트잇의 내용을 수정합니다.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: '수정할 노드 ID' },
                label: { type: 'string', description: '새로운 제목' },
                content: { type: 'string', description: '새로운 상세 내용' },
                sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] }
            },
            required: ['id']
        }
    },
    {
        name: 'delete_node',
        description: '컬쳐맵에서 특정 포스트잇을 삭제합니다.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: '삭제할 노드 ID' }
            },
            required: ['id']
        }
    },
    {
        name: 'create_connection',
        description: '두 포스트잇 사이에 인과관계 또는 영향력 연결선(엣지)을 생성합니다.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                sourceId: { type: 'string', description: '시작 노드 ID (예: 동인 노드)' },
                targetId: { type: 'string', description: '끝 노드 ID (예: 행동 노드)' },
                label: { type: 'string', description: '연결선의 의미 (예: 강화함, 유발함, 방해함)' }
            },
            required: ['sourceId', 'targetId']
        }
    },
    {
        name: 'auto_layout',
        description: '컬쳐맵의 모든 포스트잇 배치를 현재 설정된 레이어 높이에 맞춰 자동으로 정렬합니다.',
        parametersJsonSchema: { type: 'object', properties: {} }
    },
    {
        name: 'adjust_layer_height',
        description: '특정 층위(Layer)의 높이를 조절합니다. 공간이 부족할 때 레이어를 넓히는 용도로 사용합니다.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                layer: { type: 'number', enum: [1, 2, 3, 4], description: '조절할 층위 인데스 (1:결과, 2:행동, 3:유형, 4:무형)' },
                height: { type: 'number', description: '새로운 높이 (단위: px, 최소 100, 최대 600)' }
            },
            required: ['layer', 'height']
        }
    },
    {
        name: 'search_academic_theory',
        description: '조직문화 전문가(Edgar Schein, Stephen Robbins, Cummings 등)의 학술적 이론 및 모델 근거를 검색합니다.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: '검색할 주제어나 저자명 (예: 샤인, 조직문화 3층위, 로빈스 효과성)' }
            },
            required: ['topic']
        }
    }
];
