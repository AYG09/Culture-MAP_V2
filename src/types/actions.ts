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
    | 'REROUTE_EDGES'
    | 'ADJUST_LAYER_HEIGHT'
    | 'SEARCH_ACADEMIC_THEORY';

export interface MapAction {
    type: ActionType;
    payload: MapActionPayload;
}

export type AiFunctionCallArgs = Record<string, unknown>;

export interface AiFunctionCall {
    name: string;
    args?: AiFunctionCallArgs;
}

export type AiAction = AiFunctionCall & {
    __suppressAutoLayout?: boolean;
};

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
    /** 사용자가 명시적으로 수정 요청 시 true - AI가 사용자 생성 항목도 수정 가능 */
    force?: boolean;
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
    relationType?: 'direct' | 'indirect';
    isPositive?: boolean;
}

/**
 * 엣지 삭제 액션 페이로드
 */
export interface DeleteConnectionPayload {
    id: string;
    /** 사용자가 명시적으로 삭제 요청 시 true - AI가 사용자 생성 항목도 삭제 가능 */
    force?: boolean;
}

/**
 * 노드 삭제 액션 페이로드
 */
export interface DeleteNodePayload {
    id: string;
    /** 사용자가 명시적으로 삭제 요청 시 true - AI가 사용자 생성 항목도 삭제 가능 */
    force?: boolean;
}

/**
 * 노드 고정 액션 페이로드
 */
export interface PinNodePayload {
    id: string;
    pinHandles?: boolean;
}

/**
 * 노드 고정 해제 액션 페이로드
 */
export interface UnpinNodePayload {
    id: string;
}

/**
 * 자동 레이아웃 액션 페이로드
 */
export interface AutoLayoutPayload {
    spacing?: 'compact' | 'normal' | 'wide';
}

/**
 * 연결선 재정렬 액션 페이로드
 */
export type RerouteEdgesPayload = Record<string, never>;

/**
 * 레이어 높이 조절 액션 페이로드
 */
export interface AdjustLayerHeightPayload {
    layer: 1 | 2 | 3 | 4;
    height: number;
}

/**
 * 뷰포트 설정 액션 페이로드
 */
export interface SetViewportPayload {
    x?: number;
    y?: number;
    zoom?: number;
    duration?: number;
}

/**
 * 뷰포트 패닝 액션 페이로드
 */
export interface PanViewportPayload {
    dx: number;
    dy: number;
    duration?: number;
}

/**
 * 뷰포트 줌 액션 페이로드
 */
export interface ZoomViewportPayload {
    zoom?: number;
    delta?: number;
    duration?: number;
}

/**
 * 전체 맞춤(Fit View) 액션 페이로드
 */
export interface FitViewPayload {
    padding?: number;
    duration?: number;
}

/**
 * 특정 노드에 포커스 액션 페이로드
 */
export interface FocusNodePayload {
    id: string;
    zoom?: number;
    duration?: number;
}

/**
 * 레이어 투명도 설정 액션 페이로드
 */
export interface SetLayerOpacityPayload {
    layer: 1 | 2 | 3 | 4;
    opacity: number;
}

/**
 * 레이어 배경 표시 토글 액션 페이로드
 */
export interface ToggleLayerBackgroundPayload {
    visible: boolean;
}

/**
 * UI 표시 설정 액션 페이로드
 */
export interface SetUiVisibilityPayload {
    controls?: boolean;
    minimap?: boolean;
    layerPanel?: boolean;
    layerBackground?: boolean;
    exportMenu?: boolean;
}

/**
 * 스타일 변수 설정 액션 페이로드
 */
export interface SetStyleVariablesPayload {
    nodeBackground?: string;
    nodeBorderColor?: string;
    nodeTextColor?: string;
    nodeBorderRadius?: number;
    nodeShadow?: string;
    nodeFontFamily?: string;
    nodeFontSize?: number;
    edgeColor?: string;
    edgeWidth?: number;
}

/**
 * 로컬 스냅샷 저장 액션 페이로드
 */
export interface SaveSnapshotPayload {
    name?: string;
    snapshot_id?: string;
}

/**
 * 로컬 스냅샷 복원 액션 페이로드
 */
export interface RestoreSnapshotPayload {
    name?: string;
    snapshot_id?: string;
}

/**
 * 자동 정렬 원복 액션 페이로드
 */
export type UndoLayoutPayload = Record<string, never>;

/**
 * 학술 검색 액션 페이로드
 */
export interface SearchAcademicTheoryPayload {
    topic: string;
}

export type MapActionPayload =
    | AddNodePayload
    | UpdateNodePayload
    | DeleteNodePayload
    | PinNodePayload
    | UnpinNodePayload
    | AddNodesWithConnectionsPayload
    | CreateConnectionPayload
    | DeleteConnectionPayload
    | AutoLayoutPayload
    | RerouteEdgesPayload
    | AdjustLayerHeightPayload
    | SetViewportPayload
    | PanViewportPayload
    | ZoomViewportPayload
    | FitViewPayload
    | FocusNodePayload
    | SetLayerOpacityPayload
    | ToggleLayerBackgroundPayload
    | SetUiVisibilityPayload
    | SetStyleVariablesPayload
    | SaveSnapshotPayload
    | RestoreSnapshotPayload
    | UndoLayoutPayload
    | SearchAcademicTheoryPayload;

export interface ToolDeclaration {
    name: string;
    description: string;
    parametersJsonSchema: Record<string, unknown>;
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
        description: 'MUST call when user wants to modify, edit, change, or update existing sticky notes. Includes sentiment/감성 변경 and intensity(빈도/강도, consulting mode only). Trigger words: 수정, 변경, 고쳐, 바꿔, 업데이트, 감성, 긍정, 부정, 중립, 빈도, 강도. Examples: "노드 내용 수정해줘", "감성 긍정으로 바꿔"',
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
        name: 'pin_node',
        description: 'Call when user wants to pin a node so its position stays during auto_layout. Trigger words: 고정, 핀, 잠금. Examples: "이 노드 고정해줘", "위치 잠가줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the node to pin' },
                pinHandles: { type: 'boolean', description: 'Also keep connection handles fixed' }
            },
            required: ['id'],
            propertyOrdering: ['id', 'pinHandles']
        }
    },
    {
        name: 'unpin_node',
        description: 'Call when user wants to unpin a node. Trigger words: 고정 해제, 핀 해제, 잠금 해제. Examples: "고정 풀어줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the node to unpin' }
            },
            required: ['id'],
            propertyOrdering: ['id']
        }
    },
    {
        name: 'delete_node',
        description: 'MUST call ONLY when user explicitly requests deleting a specific node ID. Do NOT infer deletion based on missing connections. Trigger words: 삭제, 지워, 제거, 없애. Examples: "노드 삭제해줘", "포스트잇 지워"',
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
                label: { type: 'string', description: 'Connection meaning (e.g., 강화함, 유발함, 방해함)' },
                relationType: { type: 'string', enum: ['direct', 'indirect'], description: 'Connection type (direct or indirect)' },
                isPositive: { type: 'boolean', description: 'Whether the relation is positive (default: true)' }
            },
            required: ['sourceId', 'targetId'],
            propertyOrdering: ['sourceId', 'targetId', 'label', 'relationType', 'isPositive']
        }
    },
    {
        name: 'delete_connection',
        description: 'MUST call ONLY when user explicitly requests deleting a specific connection/edge ID. Trigger words: 연결선 삭제, 선 지워, 엣지 제거. Examples: "연결선 삭제해줘", "엣지 지워"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the connection/edge to delete' }
            },
            required: ['id'],
            propertyOrdering: ['id']
        }
    },
    {
        name: 'auto_layout',
        description: 'Call when user wants to organize, arrange, or tidy up node positions on the map layout. Trigger words: 정렬, 배치, 레이아웃. Do NOT call for content summary/review requests such as "현재 맵 내용 정리/요약/분석". Examples: "맵 정렬해줘", "레이아웃 정리". (노드 위치만 정렬하며 연결선 재정렬은 별도 도구 사용)',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                spacing: { type: 'string', enum: ['compact', 'normal', 'wide'], description: 'Node spacing preset (compact=좁게, normal=보통, wide=넓게)' }
            },
            propertyOrdering: ['spacing']
        }
    },
    {
        name: 'reroute_edges',
        description: 'Call ONLY when user explicitly mentions connections/lines/edges to re-route or re-align edge handles. Do NOT call for general auto_layout or content analysis. Trigger words: 연결선, 선 다시, 연결선 정렬, 엣지 정리. Examples: "연결선 다시 조정해", "연결선도 다시 정렬해"',
        parametersJsonSchema: {
            type: 'object',
            properties: {},
            propertyOrdering: []
        }
    },
    {
        name: 'adjust_layer_height',
        description: 'Call when user wants to resize or adjust layer heights. Trigger words: 높이, 크기, 넓히기, 레이어. Examples: "레이어 높이 조절해줘", "공간 넓혀"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                layer: { type: 'number', enum: [1, 2, 3, 4], description: 'Layer index (1:결과, 2:행동, 3:유형, 4:무형)' },
                height: { type: 'number', description: 'New height in pixels (min: 100, max: 1000)' }
            },
            required: ['layer', 'height'],
            propertyOrdering: ['layer', 'height']
        }
    },
    {
        name: 'set_viewport',
        description: 'Call when user wants to move or zoom the canvas view. Trigger words: 줌, 확대, 축소, 화면 이동, 캔버스 이동, 뷰포트. Examples: "줌 80%로", "화면 오른쪽으로 옮겨줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                x: { type: 'number', description: 'Viewport x position' },
                y: { type: 'number', description: 'Viewport y position' },
                zoom: { type: 'number', description: 'Viewport zoom level' },
                duration: { type: 'number', description: 'Animation duration in ms' }
            },
            propertyOrdering: ['x', 'y', 'zoom', 'duration']
        }
    },
    {
        name: 'pan_viewport',
        description: 'Call when user wants to pan the canvas by a relative offset. Trigger words: 조금 이동, 살짝 이동, 패닝. Examples: "오른쪽으로 200 이동"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                dx: { type: 'number', description: 'Delta x to pan' },
                dy: { type: 'number', description: 'Delta y to pan' },
                duration: { type: 'number', description: 'Animation duration in ms' }
            },
            required: ['dx', 'dy'],
            propertyOrdering: ['dx', 'dy', 'duration']
        }
    },
    {
        name: 'zoom_viewport',
        description: 'Call when user wants to zoom the canvas in or out. Trigger words: 확대, 축소, 줌. Examples: "줌 1.2로", "10% 확대"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                zoom: { type: 'number', description: 'Absolute zoom level' },
                delta: { type: 'number', description: 'Relative zoom delta (e.g., 0.1 or -0.1)' },
                duration: { type: 'number', description: 'Animation duration in ms' }
            },
            propertyOrdering: ['zoom', 'delta', 'duration']
        }
    },
    {
        name: 'fit_view',
        description: 'Call when user wants to fit all nodes into view. Trigger words: 전체 보기, 맞춰줘, fit view. Examples: "전체 화면에 맞춰줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                padding: { type: 'number', description: 'Padding ratio (0~2 recommended)' },
                duration: { type: 'number', description: 'Animation duration in ms' }
            },
            propertyOrdering: ['padding', 'duration']
        }
    },
    {
        name: 'focus_node',
        description: 'Call when user wants to focus the viewport on a specific node. Trigger words: 해당 노드 보기, 노드로 이동, 중심 이동. Examples: "노드 A로 이동"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID to focus' },
                zoom: { type: 'number', description: 'Zoom level when focusing' },
                duration: { type: 'number', description: 'Animation duration in ms' }
            },
            required: ['id'],
            propertyOrdering: ['id', 'zoom', 'duration']
        }
    },
    {
        name: 'set_layer_opacity',
        description: 'Call when user wants to change layer opacity. Trigger words: 투명도, 레이어 투명도, 불투명도. Examples: "행동 레이어 60%", "2번 레이어 투명도 50%"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                layer: { type: 'number', enum: [1, 2, 3, 4], description: 'Layer number as INTEGER (MUST be 1, 2, 3, or 4). 1=결과, 2=행동, 3=유형레버, 4=무형레버. NEVER use strings like "Layer 2".' },
                opacity: { type: 'number', description: 'Opacity value from 0 to 1. CSS standard: 1=fully opaque, 0=fully transparent. Example: 0.5 means 50% opacity.' }
            },
            required: ['layer', 'opacity'],
            propertyOrdering: ['layer', 'opacity']
        }
    },
    {
        name: 'toggle_layer_background',
        description: 'Call when user wants to show or hide layer background. Trigger words: 레이어 배경, 배경 표시, 배경 숨기기. Examples: "레이어 배경 숨겨줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                visible: { type: 'boolean', description: 'Whether layer background is visible' }
            },
            required: ['visible'],
            propertyOrdering: ['visible']
        }
    },
    {
        name: 'set_ui_visibility',
        description: 'Call when user wants to enable or disable UI elements. Trigger words: UI 숨기기, UI 보이기, 미니맵, 컨트롤, 패널. Examples: "미니맵 숨겨줘"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                controls: { type: 'boolean', description: 'Show or hide Controls' },
                minimap: { type: 'boolean', description: 'Show or hide MiniMap' },
                layerPanel: { type: 'boolean', description: 'Show or hide layer control panel' },
                layerBackground: { type: 'boolean', description: 'Show or hide layer background' },
                exportMenu: { type: 'boolean', description: 'Show or hide Export menu' }
            },
            propertyOrdering: ['controls', 'minimap', 'layerPanel', 'layerBackground', 'exportMenu']
        }
    },
    {
        name: 'set_style_variables',
        description: 'Call when user wants to change node/edge styles such as colors or fonts. Trigger words: 색상, 폰트, 스타일, 테두리, 선 색. Examples: "노드 배경색 변경"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                nodeBackground: { type: 'string', description: 'Node background color (CSS color)' },
                nodeBorderColor: { type: 'string', description: 'Node border color (CSS color)' },
                nodeTextColor: { type: 'string', description: 'Node text color (CSS color)' },
                nodeBorderRadius: { type: 'number', description: 'Node border radius (px)' },
                nodeShadow: { type: 'string', description: 'Node box-shadow CSS value' },
                nodeFontFamily: { type: 'string', description: 'Node font-family CSS value' },
                nodeFontSize: { type: 'number', description: 'Node base font size (px)' },
                edgeColor: { type: 'string', description: 'Edge color (CSS color)' },
                edgeWidth: { type: 'number', description: 'Edge stroke width (px)' }
            },
            propertyOrdering: ['nodeBackground', 'nodeBorderColor', 'nodeTextColor', 'nodeBorderRadius', 'nodeShadow', 'nodeFontFamily', 'nodeFontSize', 'edgeColor', 'edgeWidth']
        }
    },
    {
        name: 'save_snapshot',
        description: 'Call when user wants to save the current map state for backup. Trigger words: 백업, 스냅샷 저장, 저장해줘. Examples: "현재 상태 백업"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Snapshot name (optional)' },
                snapshot_id: { type: 'string', description: 'Snapshot id (optional, alias of name)' }
            },
            propertyOrdering: ['name', 'snapshot_id']
        }
    },
    {
        name: 'restore_snapshot',
        description: 'Call when user wants to restore an explicitly saved snapshot/backup. Trigger words: 스냅샷 복원, 백업 복원, 저장한 상태 불러오기. Examples: "저장한 스냅샷 복원"',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Snapshot name (optional)' },
                snapshot_id: { type: 'string', description: 'Snapshot id (optional, alias of name)' }
            },
            propertyOrdering: ['name', 'snapshot_id']
        }
    },
    {
        name: 'undo_layout',
        description: 'Call when user wants to undo the last auto layout (restore pre-layout state). Trigger words: 되돌려, 원복, 취소, 이전 상태로, undo. Examples: "정렬 취소해줘", "이전 상태로 되돌려"',
        parametersJsonSchema: {
            type: 'object',
            properties: {},
            propertyOrdering: []
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

// ============================================
// TYPE GUARDS
// ============================================

export function isAddNodePayload(args: unknown): args is AddNodePayload {
    if (typeof args !== 'object' || args === null) return false;
    const obj = args as Record<string, unknown>;
    return (
        typeof obj.label === 'string'
        && typeof obj.type === 'string'
        && typeof obj.layer === 'number'
        && [1, 2, 3, 4].includes(obj.layer)
    );
}

export function isAddNodesWithConnectionsPayload(args: unknown): args is AddNodesWithConnectionsPayload {
    if (typeof args !== 'object' || args === null) return false;
    const obj = args as Record<string, unknown>;
    if (!Array.isArray(obj.nodes)) return false;
    return obj.nodes.every((node) => {
        if (typeof node !== 'object' || node === null) return false;
        const data = node as Record<string, unknown>;
        const nestedData = data.data && typeof data.data === 'object'
            ? data.data as Record<string, unknown>
            : {};
        const hasLabel =
            typeof data.label === 'string'
            || typeof data.content === 'string'
            || typeof nestedData.content === 'string';
        const hasLayer =
            typeof data.layer === 'number'
            || typeof nestedData.layer === 'number'
            || ['result', 'behavior', 'tangible_lever', 'intangible_lever', '결과', '행동', '유형_레버', '무형_레버'].includes(String(data.type ?? nestedData.type ?? ''));
        return hasLabel && hasLayer;
    });
}

export function isUpdateNodePayload(args: unknown): args is UpdateNodePayload {
    if (typeof args !== 'object' || args === null) return false;
    const obj = args as Record<string, unknown>;
    return typeof obj.id === 'string' && obj.id.length > 0;
}

export function isDeleteNodePayload(args: unknown): args is DeleteNodePayload {
    if (typeof args !== 'object' || args === null) return false;
    const obj = args as Record<string, unknown>;
    return typeof obj.id === 'string' && obj.id.length > 0;
}

export function isCreateConnectionPayload(args: unknown): args is CreateConnectionPayload {
    if (typeof args !== 'object' || args === null) return false;
    const obj = args as Record<string, unknown>;
    return (
        typeof obj.sourceId === 'string'
        && typeof obj.targetId === 'string'
        && obj.sourceId.length > 0
        && obj.targetId.length > 0
    );
}

export function isDeleteConnectionPayload(args: unknown): args is DeleteConnectionPayload {
    if (typeof args !== 'object' || args === null) return false;
    const obj = args as Record<string, unknown>;
    return typeof obj.id === 'string' && obj.id.length > 0;
}
