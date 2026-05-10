import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, X, Sparkles, Loader2, FileText, Settings, Copy, Check, Users, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiService } from '../services/AIService';
import AIConfigModal from './AIConfigModal';
import ConsultingToolsPanel from './ConsultingToolsPanel';
import liveblocksService from '../services/LiveblocksService';
import type { ChatMessage, EvidenceLevel, MessageEvidence } from '../types/liveblocks';
import type { AiAction } from '../types/actions';
import type { NoteData, ConnectionData } from '../types/culture';
import type { PasswordType } from '../services/GatewayAdminService';
import './AIChatSidebar.css';

const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
    academic: '문헌 근거',
    web: '웹 검토',
    hybrid: '문헌 + 웹',
    general: '일반 설명',
    system: '시스템 안내'
};

const LAYER_LABELS: Record<number, string> = {
    1: '결과 레이어',
    2: '행동 레이어',
    3: '유형 레버 레이어',
    4: '무형 레버 레이어'
};

const ACTION_GROUP_META: Record<string, { label: string; tone: string }> = {
    structure: { label: '구조', tone: 'structure' },
    connection: { label: '연결', tone: 'connection' },
    layout: { label: '배치', tone: 'layout' },
    focus: { label: '탐색', tone: 'focus' },
    style: { label: '표현', tone: 'style' },
    system: { label: '시스템', tone: 'system' }
};

const getActionGroup = (actionName: string) => {
    if (actionName === 'add_node' || actionName === 'add_nodes_with_connections' || actionName === 'update_node' || actionName === 'delete_node') {
        return 'structure';
    }
    if (actionName === 'create_connection' || actionName === 'delete_connection' || actionName === 'reroute_edges') {
        return 'connection';
    }
    if (actionName === 'auto_layout' || actionName === 'adjust_layer_height') {
        return 'layout';
    }
    if (actionName === 'focus_node' || actionName === 'set_viewport' || actionName === 'pan_viewport' || actionName === 'zoom_viewport' || actionName === 'fit_view') {
        return 'focus';
    }
    if (actionName === 'set_layer_opacity' || actionName === 'toggle_layer_background' || actionName === 'set_ui_visibility' || actionName === 'set_style_variables') {
        return 'style';
    }
    return 'system';
};

const getActionExecutionKey = (messageId: string, action: AiAction, index: number) => {
    return `${messageId}:${index}:${action.name}:${JSON.stringify(action.args ?? {})}`;
};

const compactCultureMapJson = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    const root = value as Record<string, unknown>;
    if (!Array.isArray(root.nodes) && !Array.isArray(root.edges)) return null;

    const toRecord = (item: unknown) => item && typeof item === 'object' ? item as Record<string, unknown> : null;
    const compactNodes = new Map<string, Record<string, unknown>>();
    const compactEdges = new Map<string, Record<string, unknown>>();

    if (Array.isArray(root.nodes)) {
        root.nodes.forEach((item, index) => {
            const node = toRecord(item);
            const data = toRecord(node?.data);
            const position = toRecord(node?.position);
            const id = typeof node?.id === 'string' && node.id.trim() ? node.id : `node-${index}`;
            compactNodes.set(id, {
                id,
                type: typeof node?.type === 'string' ? node.type : data?.type,
                position: {
                    x: typeof position?.x === 'number' ? position.x : undefined,
                    y: typeof position?.y === 'number' ? position.y : undefined
                },
                data: {
                    content: typeof data?.content === 'string' ? data.content : undefined,
                    sentiment: typeof data?.sentiment === 'string' ? data.sentiment : undefined,
                    isLocked: typeof data?.isLocked === 'boolean' ? data.isLocked : undefined
                }
            });
        });
    }

    if (Array.isArray(root.edges)) {
        root.edges.forEach((item, index) => {
            const edge = toRecord(item);
            const data = toRecord(edge?.data);
            const style = toRecord(edge?.style);
            const markerEnd = toRecord(edge?.markerEnd);
            const source = typeof edge?.source === 'string' ? edge.source : edge?.sourceId;
            const target = typeof edge?.target === 'string' ? edge.target : edge?.targetId;
            const id = typeof edge?.id === 'string' && edge.id.trim() ? edge.id : `edge-${source}-${target}-${index}`;
            compactEdges.set(id, {
                id,
                source,
                target,
                type: edge?.type,
                animated: edge?.animated,
                style: {
                    stroke: style?.stroke,
                    strokeWidth: style?.strokeWidth,
                    strokeDasharray: style?.strokeDasharray
                },
                markerEnd: markerEnd && Object.keys(markerEnd).length > 0 ? markerEnd : undefined,
                data: {
                    relationType: data?.relationType,
                    isPositive: data?.isPositive
                }
            });
        });
    }

    return JSON.stringify({
        nodes: Array.from(compactNodes.values()),
        edges: Array.from(compactEdges.values())
    }, null, 2);
};

const getActionTitle = (action: AiAction) => {
    const args = (action.args ?? {}) as Record<string, unknown>;

    switch (action.name) {
        case 'add_node':
            return `${String(args.label ?? args.content ?? '새 노드')} 추가`;
        case 'add_nodes_with_connections':
            return `${Array.isArray(args.nodes) ? args.nodes.length : 0}개 노드 묶음 생성`;
        case 'update_node':
            return `${String(args.label ?? args.content ?? args.id ?? '선택 노드')} 수정`;
        case 'delete_node':
            return `${String(args.id ?? '선택 노드')} 제거`;
        case 'create_connection':
            return `${String(args.sourceId ?? args.source ?? '출발 노드')} -> ${String(args.targetId ?? args.target ?? '도착 노드')} 연결`;
        case 'delete_connection':
            return `${String(args.id ?? '연결선')} 제거`;
        case 'auto_layout':
            return '자동 레이아웃 재정렬';
        case 'reroute_edges':
            return '연결선 경로 재정리';
        case 'adjust_layer_height':
            return `${LAYER_LABELS[Number(args.layer)] ?? '레이어'} 높이 조정`;
        case 'pin_node':
            return `${String(args.id ?? '노드')} 고정`;
        case 'unpin_node':
            return `${String(args.id ?? '노드')} 고정 해제`;
        case 'focus_node':
            return `${String(args.id ?? '노드')}로 포커스 이동`;
        case 'fit_view':
            return '전체 맵 보기로 맞춤';
        case 'set_viewport':
            return '뷰포트 위치 조정';
        case 'pan_viewport':
            return '화면 이동';
        case 'zoom_viewport':
            return '확대 수준 조정';
        case 'set_layer_opacity':
            return `${LAYER_LABELS[Number(args.layer)] ?? '레이어'} 투명도 조정`;
        case 'toggle_layer_background':
            return `레이어 배경 ${args.visible ? '표시' : '숨김'}`;
        case 'set_ui_visibility':
            return '작업 UI 표시 상태 조정';
        case 'set_style_variables':
            return '스타일 변수 업데이트';
        case 'save_snapshot':
            return `${String(args.name ?? args.snapshot_id ?? '현재 상태')} 스냅샷 저장`;
        case 'restore_snapshot':
            return `${String(args.name ?? args.snapshot_id ?? '저장 상태')} 스냅샷 복원`;
        default:
            return action.name.replaceAll('_', ' ');
    }
};

const getActionDescription = (action: AiAction) => {
    const args = (action.args ?? {}) as Record<string, unknown>;

    switch (action.name) {
        case 'add_node':
            return `${LAYER_LABELS[Number(args.layer)] ?? '적절한 레이어'}에 ${String(args.type ?? '노드')} 항목을 추가합니다.`;
        case 'add_nodes_with_connections': {
            const nodeCount = Array.isArray(args.nodes) ? args.nodes.length : 0;
            const connectionCount = Array.isArray(args.connections) ? args.connections.length : 0;
            return `${nodeCount}개 노드를 만들고 ${connectionCount}개 연결을 함께 구성합니다.`;
        }
        case 'update_node':
            return `기존 노드의 내용, 감정, 위치 또는 레이어 정보를 갱신합니다.`;
        case 'delete_node':
            return '선택한 노드와 관련 연결을 정리합니다.';
        case 'create_connection':
            return `${args.relationType === 'indirect' ? '간접' : '직접'} 인과 관계를 새로 추가합니다.`;
        case 'delete_connection':
            return '현재 연결 관계를 제거합니다.';
        case 'auto_layout':
            return `${String(args.spacing ?? 'normal')} 간격 기준으로 맵을 다시 정렬합니다.`;
        case 'reroute_edges':
            return '겹치거나 어색한 연결선을 다시 계산합니다.';
        case 'adjust_layer_height':
            return `레이어 높이를 ${String(args.height ?? '-') }px 기준으로 조정합니다.`;
        case 'pin_node':
            return '레이아웃 변경 중에도 노드 위치를 유지합니다.';
        case 'unpin_node':
            return '노드 위치를 다시 자동 배치 대상에 포함합니다.';
        case 'focus_node':
            return '해당 노드가 화면 중심으로 오도록 시점을 이동합니다.';
        case 'fit_view':
            return '전체 맵이 한 화면에 보이도록 맞춥니다.';
        case 'set_viewport':
            return '화면 좌표와 줌 레벨을 직접 설정합니다.';
        case 'pan_viewport':
            return `현재 시점을 x ${String(args.dx ?? 0)}, y ${String(args.dy ?? 0)} 만큼 이동합니다.`;
        case 'zoom_viewport':
            return '확대 배율을 조정해 세부 확인 또는 전체 파악을 돕습니다.';
        case 'set_layer_opacity':
            return `레이어 시인성을 ${Math.round(Number(args.opacity ?? 0) * 100)}% 수준으로 조정합니다.`;
        case 'toggle_layer_background':
            return '레이어 구분 배경의 표시 여부를 전환합니다.';
        case 'set_ui_visibility':
            return '미니맵, 컨트롤, 레이어 패널 등 보조 UI 가시성을 조정합니다.';
        case 'set_style_variables':
            return '노드와 연결선의 시각 스타일을 함께 업데이트합니다.';
        case 'save_snapshot':
            return '현재 작업 상태를 로컬 또는 공유 스냅샷으로 남깁니다.';
        case 'restore_snapshot':
            return '저장해 둔 작업 상태로 되돌립니다.';
        default:
            return '캔버스에 필요한 변경을 적용합니다.';
    }
};

const getActionMeta = (action: AiAction) => {
    const args = (action.args ?? {}) as Record<string, unknown>;
    const meta: string[] = [];

    if (typeof args.layer === 'number' && LAYER_LABELS[args.layer]) {
        meta.push(LAYER_LABELS[args.layer]);
    }
    if (typeof args.type === 'string') {
        meta.push(String(args.type).replaceAll('_', ' '));
    }
    if (typeof args.relationType === 'string') {
        meta.push(args.relationType === 'indirect' ? '간접 연결' : '직접 연결');
    }
    if (typeof args.isPositive === 'boolean') {
        meta.push(args.isPositive ? '긍정 영향' : '부정 영향');
    }
    if (typeof args.spacing === 'string') {
        meta.push(`${args.spacing} 간격`);
    }

    return meta;
};

const getActionStats = (actions: AiAction[]) => {
    const counts = actions.reduce<Record<string, number>>((acc, action) => {
        const group = getActionGroup(action.name);
        acc[group] = (acc[group] ?? 0) + 1;
        return acc;
    }, {});

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([group, count]) => ({
            key: group,
            label: ACTION_GROUP_META[group]?.label ?? group,
            count
        }));
};

// 사용자 아바타 컴포넌트 - Tidio 스타일
interface UserAvatarProps {
    userName: string;
    userColor: string;
    size?: number;
    isAI?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ userName, userColor, size = 32, isAI = false }) => {
    if (isAI) {
        return (
            <div 
                className="user-avatar ai-avatar" 
                style={{ 
                    width: size, 
                    height: size,
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                }}
            >
                <Sparkles size={size * 0.5} />
            </div>
        );
    }
    
    const initial = userName.charAt(0).toUpperCase();
    return (
        <div 
            className="user-avatar" 
            style={{ 
                width: size, 
                height: size, 
                backgroundColor: userColor,
                fontSize: size * 0.45
            }}
        >
            {initial}
        </div>
    );
};

interface AIChatSidebarProps {
    onActionExecute: (action: AiAction) => void;
    notes: NoteData[];
    connections: ConnectionData[];
    layerHeights?: number[];
    passwordType?: PasswordType; // 모드 감지용
}

const isTokenLimitError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('resource_exhausted')
        || normalized.includes('rate limit')
        || normalized.includes('quota')
        || normalized.includes('429')
        || normalized.includes('rpd')
        || normalized.includes('daily')
        || normalized.includes('일일')
        || normalized.includes('토큰')
        || normalized.includes('limit')
    );
};

const getEvidenceClassName = (evidence?: MessageEvidence) => {
    if (!evidence) return 'general';
    return evidence.level;
};

const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
    onActionExecute,
    notes: _notes,
    connections: _connections,
    layerHeights,
    passwordType
}) => {
    const currentConfig = aiService.getConfig();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
    const attachmentPreviewsRef = useRef<Record<string, string>>({});
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [connectedUsers, setConnectedUsers] = useState(1);
    const [chatScope, setChatScope] = useState<'group' | 'direct'>('group');
    const [aiLockStatus, setAiLockStatus] = useState<{ lockedBy?: string; lockedAt?: number; expiresAt?: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const MAX_JSON_ATTACH_CHARS = 30000;
    
    // 현재 사용자 ID 가져오기
    const currentUserId = liveblocksService.getCurrentUserId();
    const sharedApiKeyMode = aiService.getConfig()?.sharedApiKeyMode ?? false;

    const filteredMessages = useMemo(() => {
        return messages.filter((msg) => (msg.scope ?? 'group') === chatScope);
    }, [messages, chatScope]);
    const [appliedActionKeys, setAppliedActionKeys] = useState<string[]>([]);

    const handleApplySingleAction = useCallback((messageId: string, action: AiAction, index: number) => {
        const actionKey = getActionExecutionKey(messageId, action, index);
        if (appliedActionKeys.includes(actionKey)) {
            return;
        }
        onActionExecute(action);
        setAppliedActionKeys((prev) => prev.concat(actionKey));
    }, [appliedActionKeys, onActionExecute]);

    const handleApplyAllActions = useCallback((messageId: string, actions: AiAction[]) => {
        const nextKeys: string[] = [];
        actions.forEach((action, index) => {
            const actionKey = getActionExecutionKey(messageId, action, index);
            if (!appliedActionKeys.includes(actionKey)) {
                onActionExecute(action);
                nextKeys.push(actionKey);
            }
        });

        if (nextKeys.length > 0) {
            setAppliedActionKeys((prev) => prev.concat(nextKeys));
        }
    }, [appliedActionKeys, onActionExecute]);

    // 메시지 복사 기능
    const handleCopyMessage = useCallback(async (messageId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            console.error('복사 실패:', err);
        }
    }, []);

    const handleClearChatHistory = useCallback(() => {
        const confirmed = window.confirm('채팅 내역을 초기화할까요? 이 작업은 되돌릴 수 없습니다.');
        if (!confirmed) return;

        if (liveblocksService.isConnected()) {
            liveblocksService.clearChatMessages();
        } else {
            setMessages([]);
        }

        aiService.resetChatSession();
        setAppliedActionKeys([]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, uploadProgress]);

    const activeModelLabel = currentConfig?.modelName || 'gemini-2.5-flash-lite';

    // 접속자 수 업데이트 (세션 상태 감시)
    useEffect(() => {
        const updateUserCount = () => {
            const session = liveblocksService.getCurrentSession();
            if (session?.connectedUsers) {
                setConnectedUsers(session.connectedUsers);
            }
        };
        
        updateUserCount();
        const interval = setInterval(updateUserCount, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const unsubscribe = liveblocksService.onAiLockStatus((status) => {
            setAiLockStatus(status);
        });
        return unsubscribe;
    }, []);

    const lastChatLogRef = useRef<{ count: number; lastId: string | null }>({
        count: 0,
        lastId: null
    });
    const pendingAiTextRef = useRef<{ id: string; text: string } | null>(null);
    const pendingAiTimerRef = useRef<number | null>(null);

    // Liveblocks 채팅 메시지 구독 - 세션 연결 후 재구독 필요
    useEffect(() => {
        let unsub: (() => void) | null = null;
        let retryCount = 0;
        const maxRetries = 10;

        const setupSubscription = () => {
            // 이미 연결되어 있으면 구독 설정
            if (liveblocksService.isConnected()) {
                console.log('🔗 [AIChatSidebar] Setting up Liveblocks chat subscription');
                unsub = liveblocksService.onChatMessages((msgs) => {
                    const lastMsg = msgs[msgs.length - 1];
                    const lastId = lastMsg?.id ?? null;
                    const lastLog = lastChatLogRef.current;
                    if (msgs.length !== lastLog.count || lastId !== lastLog.lastId) {
                        console.log('💬 [AIChatSidebar] Chat messages updated:', msgs.length);
                        lastChatLogRef.current = { count: msgs.length, lastId };
                    }
                    setMessages(msgs.map((msg) => ({
                        ...msg,
                        scope: msg.scope ?? 'group'
                    })));
                });

                const initialMsgs = liveblocksService.getChatMessages();
                if (initialMsgs.length > 0) {
                    setMessages(initialMsgs.map((msg) => ({
                        ...msg,
                        scope: msg.scope ?? 'group'
                    })));
                }
                return true;
            }
            return false;
        };

        // 즉시 시도
        if (!setupSubscription()) {
            // 연결되지 않은 경우 폴링으로 재시도
            const intervalId = setInterval(() => {
                retryCount++;
                if (setupSubscription() || retryCount >= maxRetries) {
                    clearInterval(intervalId);
                    if (retryCount >= maxRetries) {
                        console.warn('⚠️ [AIChatSidebar] Liveblocks connection timeout, using local mode');
                    }
                }
            }, 500);

            return () => {
                clearInterval(intervalId);
                unsub?.();
            };
        }

        return () => unsub?.();
    }, []);

    // 맵 상태 분석 기반 동적 제안 리스트 생성
    useEffect(() => {
        const generateSuggestions = () => {
            const newSuggestions: string[] = [];
            const nodeCount = _notes.length;
            const connCount = _connections.length;

            const hasResult = _notes.some(n => n.type === '결과');
            const hasBehavior = _notes.some(n => n.type === '행동');
            const hasLevars = _notes.some(n => n.type === '유형_레버' || n.type === '무형_레버');

            if (nodeCount === 0) {
                newSuggestions.push("새로운 결과 노드 추가해줘");
                newSuggestions.push("조직문화 분석 시작하는 법 알려줘");
                newSuggestions.push("버크만 레포트 분석해줘");
            } else if (!hasResult) {
                newSuggestions.push("조직의 최종 성과(결과) 노드를 먼저 추가해주세요");
                newSuggestions.push("결과 노드를 어떻게 구성할까요?");
            } else if (nodeCount < 4) {
                newSuggestions.push("이 결과와 관련된 행동 노드 추가해줘");
                newSuggestions.push("현재 노드들 사이의 관계 연결해줘");
                newSuggestions.push("추가적인 통찰(Insight) 제안해줘");
            } else {
                if (!hasBehavior) newSuggestions.push("관찰된 행동들을 추가해볼까요?");
                if (!hasLevars) newSuggestions.push("이 문화의 근본 원인(레버) 분석해줘");
                if (connCount < nodeCount / 2) newSuggestions.push("노드들 간의 인과관계 분석해서 연결해줘");

                newSuggestions.push("현재 맵 레이아웃 자동 정리해줘");
                newSuggestions.push("중복되거나 상충되는 요소 검토해줘");
            }

            // 최대 3개까지만 표시 (UI 공간 고려)
            setSuggestions(newSuggestions.slice(0, 3));
        };

        generateSuggestions();
    }, [_notes, _connections]);

    const handleSendMessage = async (overrideText?: string) => {
        const textToSend = overrideText || inputValue;
        if (!textToSend.trim() && attachments.length === 0) return;

        const currentText = textToSend;
        const isPrivateChat = chatScope === 'direct';
        const applyPendingActionsRequest = /^(전체\s*)?(반영|적용|실행)(해|해줘|해라|해\s*주세요|해주세요)?[.!?]?$/.test(currentText.trim());

        if (!isPrivateChat && attachments.length === 0 && applyPendingActionsRequest) {
            const latestPendingActionMessage = [...filteredMessages]
                .reverse()
                .find((message) => message.suggestedActions && message.suggestedActions.length > 0);

            if (latestPendingActionMessage?.suggestedActions?.length) {
                if (!overrideText) setInputValue('');
                if (liveblocksService.isConnected()) {
                    liveblocksService.sendChatMessage(currentText);
                } else {
                    setMessages(prev => [...prev, {
                        id: `user-${Date.now()}`,
                        role: 'user' as const,
                        content: currentText,
                        userId: currentUserId,
                        userName: '나',
                        userColor: '#3b82f6',
                        timestamp: Date.now(),
                        scope: chatScope
                    }]);
                }
                handleApplyAllActions(latestPendingActionMessage.id, latestPendingActionMessage.suggestedActions);
                return;
            }
        }

        const actionVerbs = ['추가', '생성', '만들', '연결', '정리', '정렬', '배치', '레이아웃', '삭제', '지워', '제거', '수정', '변경', '옮겨', '이동', '높이', '요약', '축약', '줄여', '간략', '다듬', '정제', '편집', '바꿔', '되돌', '돌려', '복원', '원복', '취소', '반영', '적용', '실행'];
        const actionNouns = ['노드', '포스트잇', '연결', '선', '화살표', '엣지', '레이아웃', '정렬', '배치', '맵', '레이어', '내용', '문장', '텍스트', '감성', '감정', '긍정', '부정', '중립', '빈도', '강도'];
        const explicitActionPattern = /(추가해|추가해줘|생성해|생성해줘|만들어|만들어줘|연결해|연결해줘|삭제해|지워줘|제거해|수정해|변경해|옮겨줘|이동해|정렬해|배치해|레이아웃해|높여|줄여|되돌려|되돌려줘|돌려|돌려줘|복원해|복원해줘|원복해|원복해줘|취소해|취소해줘|반영해|반영해줘|적용해|적용해줘|실행해|실행해줘|undo)/;
        const explanationKeywords = ['설명', '왜', '근거', '의미', '정의', '차이', '무슨', '뭐야', '무엇', '말해', '알려', '이유', '해석'];
        const contentReviewPattern = /(요약|축약|간략|검토|분석|설명|해석|정리).*(내용|텍스트|문장|의미|근거|현재 맵|이 맵|노드들|컬쳐맵)|((내용|텍스트|문장|의미|근거|현재 맵|이 맵|노드들|컬쳐맵).*(요약|축약|간략|검토|분석|설명|해석|정리))/;
        const hasVerb = actionVerbs.some(keyword => currentText.includes(keyword));
        const hasNoun = actionNouns.some(keyword => currentText.includes(keyword));
        const contentReviewRequest = contentReviewPattern.test(currentText);
        const edgeRerouteOnlyRequest = !contentReviewRequest
            && /((연결선|엣지|화살표|선)\s*(만|만을|만이라도)?\s*(정리|재정렬|정렬|조정|다시|깔끔|경로|겹침|겹치지)|((정리|재정렬|정렬|조정|다시|깔끔|경로).*(연결선|엣지|화살표|선)))/.test(currentText)
            && !/(연결해|연결해줘|관계.*(만들|생성|추가)|새\s*연결|연결\s*(만들|생성|추가))/.test(currentText);
        const layoutOnlyRequest = !contentReviewRequest && (edgeRerouteOnlyRequest || /(정렬|배치|레이아웃|높이|위치.*정리|맵.*정렬|맵.*배치)/.test(currentText));
        const undoOnlyRequest = /(되돌|돌려|복원|원복|취소|undo)/i.test(currentText);
        const mapEditIntentDetected = (hasVerb && hasNoun) || layoutOnlyRequest;
        const explanationRequest = explanationKeywords.some(keyword => currentText.includes(keyword));
        const explicitActionDetected = explicitActionPattern.test(currentText);
        const explicitMapEditRequest = !isPrivateChat && !contentReviewRequest && (explicitActionDetected || layoutOnlyRequest || undoOnlyRequest) && !explanationRequest;
        const preservePositionsRequested = /(위치.*유지|현재.*위치|정렬.*하지|정렬하지|레이아웃.*하지|자동\s*정렬.*(하지|말))/i.test(currentText);
        const forceFunctionCall = explicitMapEditRequest;
        const allowedFunctionNames = edgeRerouteOnlyRequest ? ['reroute_edges'] : undefined;

        if (!overrideText) setInputValue('');
        setIsLoading(true);
        let lockAcquired = false;

        // 현재 맵 상태를 AI가 이해할 수 있도록 상세하게 전달
        // AI가 노드 ID를 알아야 create_connection 등에서 사용 가능
        const layerNames: Record<number, string> = {
            1: '결과(Result)',
            2: '행동(Behavior)',
            3: '유형레버(Tangible Lever)',
            4: '무형레버(Intangible Lever)'
        };

        const nodesContext = _notes.length > 0
            ? _notes.map(n => {
                const layerName = layerNames[n.layer] || `Layer ${n.layer}`;
                const sentiment = n.sentiment === 'positive' ? '긍정' : n.sentiment === 'negative' ? '부정' : '중립';
                const position = `(${Math.round(n.position.x)}, ${Math.round(n.position.y)})`;
                return `  - ID: "${n.id}", 층위: ${layerName}, 좌표: ${position}, 감정: ${sentiment}, 내용: "${n.content || '(내용 없음)'}"`;
            }).join('\n')
            : '  (노드 없음)';

        const connectionsContext = _connections.length > 0
            ? _connections.map(c => {
                const fromNode = _notes.find(n => n.id === c.sourceId);
                const toNode = _notes.find(n => n.id === c.targetId);
                const relType = c.relationType === 'direct' ? '직접' : '간접';
                const polarity = c.isPositive ? '긍정적' : '부정적';
                return `  - "${fromNode?.content || c.sourceId}" → "${toNode?.content || c.targetId}" (${relType}, ${polarity})`;
            }).join('\n')
            : '  (연결 없음)';

        const normalizedLayerHeights = Array.isArray(layerHeights) && layerHeights.length === 4
            ? layerHeights
            : [0, 0, 0, 0];

        const layerHeightContext = normalizedLayerHeights.some(height => height > 0)
            ? `
📏 현재 레이어 높이(px):
- Layer 4(무형레버): ${normalizedLayerHeights[3]}
- Layer 3(유형레버): ${normalizedLayerHeights[2]}
- Layer 2(행동): ${normalizedLayerHeights[1]}
- Layer 1(결과): ${normalizedLayerHeights[0]}
`
            : '';

        const modeLabel = passwordType === 'consulting' ? '컨설팅' : '워크샵';
        const contextString = `[현재 컬처맵 상태]
    현재 모드: ${modeLabel} 모드
    워크샵 모드에서는 빈도/강도 표기를 사용하지 말고 도구에서도 intensity/frequency를 사용하지 마세요.
총 노드 수: ${_notes.length}개, 총 연결선 수: ${_connections.length}개

📐 층위 구조 (상위→하위 = 원인→결과):
- Layer 4 (무형레버): 조직의 기본 가정, 가치관, 신념
- Layer 3 (유형레버): 제도, 정책, 시스템, 보상체계
- Layer 2 (행동): 구성원들의 실제 행동 패턴
- Layer 1 (결과): 성과, 결과물, KPI

📋 노드 목록:
${nodesContext}

🔗 연결 관계:
${connectionsContext}

${layerHeightContext}

💡 연결 방향: 상위 층위(원인=sourceId) → 하위 층위(결과=targetId)
${edgeRerouteOnlyRequest ? '🚫 이번 요청은 연결선/엣지 경로 정리만 수행합니다. 새 노드 생성, 기존 노드 재생성, 새 연결 생성, 삭제, 자동 레이아웃을 하지 말고 reroute_edges만 호출하세요.' : '💡 노드와 연결을 새로 생성해 달라는 요청일 때만 add_node/add_nodes_with_connections/create_connection을 사용하세요.'}
${edgeRerouteOnlyRequest ? '' : '💡 여러 새 노드와 새 연결을 한 번에 만들 때만 add_nodes_with_connections를 사용하고, nodes에 tempId를 지정한 뒤 connections에서 tempId를 참조하세요.'}
💡 특정 위치로 옮길 때는 update_node에 x/y 좌표를 포함하세요.
💡 레이아웃이 겹치거나 연결선이 가려지면 adjust_layer_height로 레이어 높이를 늘려 공간을 확보하세요.
💡 "요약/검토/분석/설명/정리"가 내용 이해를 뜻하면 도구를 호출하지 말고 텍스트로만 답변하세요.
💡 reroute_edges는 사용자가 연결선/선/엣지 재정렬을 명시적으로 요청할 때만 사용하세요.
🚫 도구 호출은 코드로 출력하지 말고 반드시 function call로 실행하세요.`;

        let fileUri: string | undefined;
        let mimeType: string | undefined;
        let jsonAttachmentText: string | null = null;
        let jsonAttachmentName: string | null = null;

        try {
            console.log('💬 [AIChatSidebar] Sending message:', currentText);
            
            // 메시지 전송 - Liveblocks 연결 여부에 따라 분기
            if (sharedApiKeyMode && liveblocksService.isConnected()) {
                lockAcquired = liveblocksService.tryAcquireAiLock(60000);
                if (!lockAcquired) {
                    setIsLoading(false);
                    const warningMessage: ChatMessage = {
                        id: `system-${Date.now()}`,
                        role: 'system' as const,
                        content: '현재 다른 사용자가 AI를 사용 중입니다. 잠시 후 다시 시도해주세요.',
                        userName: 'System',
                        userColor: '#64748b',
                        timestamp: Date.now(),
                        scope: chatScope,
                    };
                    setMessages(prev => [...prev, warningMessage]);
                    return;
                }
            }

            if (currentText.trim()) {
                if (!isPrivateChat && liveblocksService.isConnected()) {
                    liveblocksService.sendChatMessage(currentText);
                } else {
                    // 개인 채팅 또는 Liveblocks 미연결 시 로컬 상태에 사용자 메시지 추가
                    console.log('📝 [AIChatSidebar] Adding user message to local state');
                    setMessages(prev => [...prev, {
                        id: `user-${Date.now()}`,
                        role: 'user' as const,
                        content: currentText,
                        userId: currentUserId,
                        userName: '나',
                        userColor: '#3b82f6',
                        timestamp: Date.now(),
                        scope: chatScope
                    }]);
                }
            }

            // 파일 업로드 처리 (있는 경우 첫 번째 파일만)
            if (attachments.length > 0) {
                const attachment = attachments[0];
                const isJsonAttachment =
                    attachment.type === 'application/json' || attachment.name.toLowerCase().endsWith('.json');

                if (isJsonAttachment) {
                    setUploadProgress('JSON 파일 읽는 중...');
                    const rawText = await attachment.text();
                    jsonAttachmentName = attachment.name;
                    try {
                        const parsedJson = JSON.parse(rawText);
                        const compactText = compactCultureMapJson(parsedJson);
                        const sourceText = compactText ?? rawText;
                        jsonAttachmentText = sourceText.length > MAX_JSON_ATTACH_CHARS
                            ? `${sourceText.slice(0, MAX_JSON_ATTACH_CHARS)}\n\n...[중략: ${sourceText.length - MAX_JSON_ATTACH_CHARS}자 생략]`
                            : sourceText;
                    } catch (jsonErr) {
                        console.error('JSON parse failed:', jsonErr);
                        const parseMessage = jsonErr instanceof Error ? jsonErr.message : '알 수 없는 JSON 파싱 오류';
                        const truncatedRawText = rawText.length > MAX_JSON_ATTACH_CHARS
                            ? `${rawText.slice(0, MAX_JSON_ATTACH_CHARS)}\n\n...[중략: ${rawText.length - MAX_JSON_ATTACH_CHARS}자 생략]`
                            : rawText;
                        jsonAttachmentText = [
                            `[주의] 이 파일은 엄격한 JSON으로 파싱되지 않았습니다: ${parseMessage}`,
                            '아래 원문 일부를 텍스트로 읽고, 구조 오류가 있으면 사용자에게 먼저 알려주세요.',
                            truncatedRawText
                        ].join('\n\n');
                    }
                    setUploadProgress(null);
                } else {
                    try {
                        setUploadProgress('파일 업로드 중...');
                        const metadata = await aiService.uploadAcademicFile(attachment);
                        fileUri = metadata.uri;
                        mimeType = metadata.mimeType;
                    } catch (uploadErr) {
                        console.error('File upload failed:', uploadErr);
                        const errorMessage = uploadErr instanceof Error ? uploadErr.message : '업로드 실패';
                        setUploadProgress(errorMessage);
                    }
                }
            }

            if (isPrivateChat && mapEditIntentDetected) {
                setIsLoading(false);
                const guidanceMessage: ChatMessage = {
                    id: `system-${Date.now()}`,
                    role: 'system' as const,
                    content: '1:1 탭에서는 컬쳐맵 도구가 비활성화되어 있어요. **전체 채팅** 탭으로 전환한 뒤, “노드 추가/연결/정렬”처럼 요청해 주세요.',
                    userName: 'System',
                    userColor: '#64748b',
                    timestamp: Date.now(),
                    scope: 'direct',
                };
                setMessages(prev => [...prev, guidanceMessage]);
                return;
            }

            console.log('🤖 [AIChatSidebar] Requesting AI Stream...');
            // 스트리밍 시작
            const jsonAttachmentSection = jsonAttachmentText
                ? `\n\n[첨부된 JSON 파일: ${jsonAttachmentName ?? 'unknown'}]\n${jsonAttachmentText}`
                : '';

            const aiStream = aiService.sendChatMessageStream(
                `${contextString}\n\n[사용자 메시지]\n${currentText || '첨부된 파일을 분석해주세요.'}${jsonAttachmentSection}`,
                fileUri,
                mimeType,
                {
                    forceFunctionCall,
                    allowExternalTools: !isPrivateChat && explicitMapEditRequest,
                    groundingQuery: currentText || '첨부된 파일을 분석해주세요.',
                    allowedFunctionNames
                }
            );

            let aiMsgId = '';
            let finalActions: AiAction[] = [];
            let isFirstChunk = true;
            let currentEvidence: MessageEvidence | undefined;

            const hasAcademicFiles = aiService.getAcademicFiles().length > 0;
            const timeoutMs = hasAcademicFiles || fileUri ? 120000 : 30000;

            // 타임아웃 설정 (응답 지연 시 무한 로딩 방지)
            const responseTimeout = setTimeout(() => {
                if (isFirstChunk) {
                    console.warn(`⌛ [AIChatSidebar] AI Response Timeout (${Math.round(timeoutMs / 1000)}s)`);
                    setIsLoading(false);
                    const timeoutEvidence: MessageEvidence = {
                        level: 'system',
                        summary: '시스템 응답 지연',
                        note: '응답 타임아웃으로 AI 결과를 받지 못했습니다.'
                    };
                    const timeoutId = liveblocksService.startAiResponse(timeoutEvidence);
                    liveblocksService.updateAiResponse(timeoutId, `AI 응답이 ${Math.round(timeoutMs / 1000)}초 이상 지연되어 연결을 중단했습니다. 인터넷 연결을 확인하거나 Gemini API 할당량을 확인해주세요.`, undefined, timeoutEvidence);
                }
            }, timeoutMs);

            const ensureAiMessage = (evidence?: MessageEvidence) => {
                const nextEvidence = evidence ?? currentEvidence;
                if (isFirstChunk) {
                    console.log('🤖 [AIChatSidebar] AI First chunk received!');
                    clearTimeout(responseTimeout);
                    setIsLoading(false);
                    if (!isPrivateChat && liveblocksService.isConnected()) {
                        aiMsgId = liveblocksService.startAiResponse(nextEvidence);
                        console.log('🤖 [AIChatSidebar] AI Message ID created:', aiMsgId);
                    }
                    isFirstChunk = false;

                    if (!aiMsgId) {
                        console.warn('⚠️ [AIChatSidebar] Liveblocks not connected, using local state');
                        const localMsgId = `local-ai-${Date.now()}`;
                        aiMsgId = localMsgId;
                        setMessages(prev => [...prev, {
                            id: localMsgId,
                            role: 'assistant' as const,
                            content: '',
                            userName: 'AI Assistant',
                            userColor: '#8b5cf6',
                            timestamp: Date.now(),
                            scope: chatScope,
                            evidence: nextEvidence
                        }]);
                    }
                    return;
                }

                if (!nextEvidence || !aiMsgId) return;
                if (!aiMsgId.startsWith('local-')) {
                    liveblocksService.updateAiResponse(aiMsgId, undefined, undefined, nextEvidence);
                } else {
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, evidence: nextEvidence } : m
                    ));
                }
            };

            try {
                for await (const chunk of aiStream) {
                    if (chunk.type === 'metadata') {
                        currentEvidence = chunk.evidence;
                        ensureAiMessage(currentEvidence);
                        continue;
                    }

                    ensureAiMessage();

                    if (chunk.type === 'text') {
                        console.log('🤖 [AIChatSidebar] Received text chunk, fullText length:', chunk.fullText?.length);
                        const pendingId = aiMsgId;
                        const pendingText = chunk.fullText || '';
                        pendingAiTextRef.current = { id: pendingId, text: pendingText };
                        if (!pendingAiTimerRef.current) {
                            pendingAiTimerRef.current = window.setTimeout(() => {
                                const pending = pendingAiTextRef.current;
                                pendingAiTimerRef.current = null;
                                if (!pending) return;
                                if (pending.id && !pending.id.startsWith('local-')) {
                                    liveblocksService.updateAiResponse(pending.id, pending.text, undefined, currentEvidence);
                                } else {
                                    setMessages(prev => prev.map(m =>
                                        m.id === pending.id ? { ...m, content: pending.text, evidence: currentEvidence ?? m.evidence } : m
                                    ));
                                }
                                pendingAiTextRef.current = null;
                            }, 120);
                        }
                    } else if (chunk.type === 'actions') {
                        const normalizeActionName = (name?: string) => (name ?? '').trim().toLowerCase();
                        const receivedActions = Array.isArray(chunk.actions) ? chunk.actions : [];
                        finalActions = edgeRerouteOnlyRequest
                            ? receivedActions.filter(action => normalizeActionName(action.name) === 'reroute_edges')
                            : receivedActions;

                        if (edgeRerouteOnlyRequest && finalActions.length !== receivedActions.length) {
                            console.warn('🛡️ [AIChatSidebar] Edge-only request: blocked non-reroute actions:', receivedActions.map(action => action.name));
                        }

                        if (edgeRerouteOnlyRequest && receivedActions.length > 0 && finalActions.length === 0) {
                            finalActions = [{ name: 'reroute_edges', args: {} }];
                        }

                        console.log('🎯 [AIChatSidebar] Actions received:', finalActions.length, 'items');

                        const isSnapshotSaveOnly =
                            finalActions.length > 0 &&
                            finalActions.every(action => normalizeActionName(action.name) === 'save_snapshot');

                        const resolveSnapshotName = (action: AiAction) => {
                            const rawName = typeof action.args?.name === 'string'
                                ? action.args?.name
                                : typeof action.args?.snapshot_id === 'string'
                                    ? action.args?.snapshot_id
                                    : undefined;
                            const trimmed = rawName?.trim();
                            return trimmed && trimmed.length > 0 ? trimmed : 'default';
                        };

                        if (isSnapshotSaveOnly) {
                            const snapshotActions = finalActions.map(action => ({
                                ...action,
                                __suppressAutoLayout: preservePositionsRequested
                            }));
                            snapshotActions.forEach(action => onActionExecute(action));
                            const snapshotLabel = resolveSnapshotName(snapshotActions[0]);
                            const responseText = `스냅샷 ID ${snapshotLabel} 저장되었습니다.`;
                            if (aiMsgId && !aiMsgId.startsWith('local-')) {
                                liveblocksService.updateAiResponse(aiMsgId, responseText, [], currentEvidence);
                            } else if (aiMsgId) {
                                setMessages(prev => prev.map(m =>
                                    m.id === aiMsgId ? { ...m, content: responseText, suggestedActions: [], evidence: currentEvidence ?? m.evidence } : m
                                ));
                            }
                        } else {
                            // 설정에 따라 자동 실행 또는 수동 확인
                            const autoExecute = aiService.getConfig()?.autoExecuteFunctionCalls ?? false;
                            if (!explicitMapEditRequest && finalActions.length > 0) {
                                console.warn('🛑 [AIChatSidebar] No explicit map-edit intent detected. Actions require confirmation.');
                            }
                            const shouldIgnoreActions = explanationRequest && !explicitMapEditRequest;
                            const actionsWithFlags = !isPrivateChat && !shouldIgnoreActions
                                ? finalActions.map(action => ({
                                    ...action,
                                    __suppressAutoLayout: preservePositionsRequested
                                }))
                                : [];

                            if (autoExecute && actionsWithFlags.length > 0 && explicitMapEditRequest) {
                            // 자동 실행 모드: 즉시 onActionExecute 호출
                            console.log('⚡ [AIChatSidebar] Auto-executing actions...');
                            actionsWithFlags.forEach(action => onActionExecute(action));
                            // 실행 완료 후 텍스트만 업데이트 (액션은 저장하지 않음 - 이미 실행됨)
                            if (aiMsgId && !aiMsgId.startsWith('local-')) {
                                liveblocksService.updateAiResponse(aiMsgId, undefined, undefined, currentEvidence);
                            }
                            } else {
                                // 수동 실행 모드: 메시지에 actions 저장하여 버튼 표시
                                console.log('🛡️ [AIChatSidebar] Manual mode - storing actions for user confirmation');
                                if (aiMsgId && !aiMsgId.startsWith('local-')) {
                                    liveblocksService.updateAiResponse(aiMsgId, undefined, actionsWithFlags, currentEvidence);
                                } else {
                                    setMessages(prev => prev.map(m =>
                                        m.id === aiMsgId ? { ...m, suggestedActions: actionsWithFlags, evidence: currentEvidence ?? m.evidence } : m
                                    ));
                                }
                            }
                        }
                    }
                }
            } finally {
                clearTimeout(responseTimeout);
                if (pendingAiTimerRef.current) {
                    window.clearTimeout(pendingAiTimerRef.current);
                    pendingAiTimerRef.current = null;
                }
                const pending = pendingAiTextRef.current;
                if (pending?.id) {
                    if (!pending.id.startsWith('local-')) {
                        liveblocksService.updateAiResponse(pending.id, pending.text, undefined, currentEvidence);
                    } else {
                        setMessages(prev => prev.map(m =>
                            m.id === pending.id ? { ...m, content: pending.text, evidence: currentEvidence ?? m.evidence } : m
                        ));
                    }
                }
                pendingAiTextRef.current = null;
            }

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 에러';
            const userFriendlyMessage = isTokenLimitError(message)
                ? '일일 토큰 제한량이 전부 찼습니다. 설정창을 통해 다른 AI 모델로 바꿔서 진행하세요.'
                : `죄송합니다. 오류가 발생했습니다: ${message}`;
            console.error('Chat error:', error);
            if (!isPrivateChat && liveblocksService.isConnected()) {
                liveblocksService.sendAiResponse(userFriendlyMessage, undefined, {
                    level: 'system',
                    summary: '시스템 오류 안내',
                    note: 'AI 응답 처리 중 오류가 발생했습니다.'
                });
            } else {
                setMessages(prev => [...prev, {
                    id: `ai-error-${Date.now()}`,
                    role: 'assistant' as const,
                    content: userFriendlyMessage,
                    userName: 'AI Assistant',
                    userColor: '#8b5cf6',
                    timestamp: Date.now(),
                    scope: chatScope,
                    evidence: {
                        level: 'system',
                        summary: '시스템 오류 안내',
                        note: 'AI 응답 처리 중 오류가 발생했습니다.'
                    }
                }]);
            }
        } finally {
            setIsLoading(false);
            setUploadProgress(null);
            setAttachments([]);
            if (lockAcquired) {
                liveblocksService.releaseAiLock();
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(Array.from(e.target.files));
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items || items.length === 0) return;

        const imageItem = Array.from(items).find(
            (item) => item.kind === 'file' && item.type.startsWith('image/')
        );

        if (!imageItem) return;

        const file = imageItem.getAsFile();
        if (!file) return;

        e.preventDefault();
        setAttachments([file]);
        setUploadProgress(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');
        if (!isJson && !isPdf && !isImage) return;
        e.preventDefault();
        setAttachments([file]);
        setUploadProgress(null);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        const previousPreviews = attachmentPreviewsRef.current;
        const nextPreviews: Record<string, string> = {};

        attachments.forEach((file) => {
            if (!file.type.startsWith('image/')) return;
            const key = `${file.name}-${file.size}-${file.lastModified}`;
            if (previousPreviews[key]) {
                nextPreviews[key] = previousPreviews[key];
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            nextPreviews[key] = objectUrl;
        });

        Object.entries(previousPreviews).forEach(([key, url]) => {
            if (!nextPreviews[key]) {
                URL.revokeObjectURL(url);
            }
        });

        attachmentPreviewsRef.current = nextPreviews;
        setAttachmentPreviews(nextPreviews);
    }, [attachments]);

    useEffect(() => {
        return () => {
            Object.values(attachmentPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    return (
        <div className="ai-chat-sidebar">
            <div className="ai-local-knowledge-banner">
                <div className="ai-local-knowledge-title">로컬 지식 베이스 사용</div>
                <div className="ai-local-knowledge-desc">
                    업로드한 PDF는 본인 브라우저에서만 사용되며, 세션에는 메타데이터만 공유됩니다.
                </div>
                <div className="ai-local-knowledge-meta">현재 모델: {activeModelLabel}</div>
            </div>
            <div className="chat-header">
                <div className="header-left">
                    <div className="ai-header-avatar">
                        <Sparkles size={16} />
                        <span className="online-badge" />
                    </div>
                    <div className="header-info">
                        <h2>Culture-MAP AI</h2>
                        <span className="header-status">온라인 · 질문에 답변 준비됨</span>
                    </div>
                </div>
                <div className="header-right">
                    <div className="connected-users" title={`${connectedUsers}명 접속 중`}>
                        <Users size={14} />
                        <span>{connectedUsers}</span>
                    </div>
                    {sharedApiKeyMode && aiLockStatus?.lockedBy && aiLockStatus.lockedBy !== currentUserId && (
                        <div className="ai-lock-badge" title="다른 사용자가 AI를 사용 중입니다">
                            AI 사용 중
                        </div>
                    )}
                    <motion.button
                        className="header-clear-btn"
                        onClick={handleClearChatHistory}
                        title="채팅 내역 초기화"
                        aria-label="채팅 내역 초기화"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Trash2 size={16} />
                    </motion.button>
                    <motion.button
                        className="header-config-btn"
                        onClick={() => setIsConfigOpen(true)}
                        title="AI API 설정 (BYOK)"
                        aria-label="AI API 설정 열기"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Settings size={18} />
                    </motion.button>
                </div>
            </div>

            <AIConfigModal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
            />

            <div className="chat-content">
                {/* 컨설팅 모드에서만 분석 도구 패널 표시 */}
                {passwordType === 'consulting' && (
                    <div className="chat-tools-slot">
                        <ConsultingToolsPanel
                            onSelectPrompt={(prompt, stepName) => {
                                console.log(`📋 [AIChatSidebar] Consulting prompt selected: ${stepName}`);
                                handleSendMessage(prompt);
                            }}
                        />
                    </div>
                )}

                <div className="chat-tabs">
                    <button
                        className={`chat-tab-btn ${chatScope === 'group' ? 'active' : ''}`}
                        onClick={() => setChatScope('group')}
                        type="button"
                    >
                        전체 채팅
                    </button>
                    <button
                        className={`chat-tab-btn ${chatScope === 'direct' ? 'active' : ''}`}
                        onClick={() => setChatScope('direct')}
                        type="button"
                    >
                        AI 1:1
                    </button>
                </div>

                <div className="chat-messages">
                    {filteredMessages.length === 0 && (
                        <div className="welcome-container">
                            <div className="welcome-card">
                                <h3>👋 반갑습니다!</h3>
                                <p>{chatScope === 'group' ? '조직문화 분석과 맵 제어를 도와드릴게요.' : 'AI와 1:1로 대화할 수 있어요.'}</p>
                                {chatScope === 'group' && (
                                    <div className="suggestion-buttons">
                                        {suggestions.map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                className="suggestion-item-btn"
                                                onClick={() => handleSendMessage(suggestion)}
                                                aria-label={`추천 질문: ${suggestion}`}
                                            >
                                                "{suggestion}"
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {filteredMessages.map((msg) => {
                        const isCurrentUser = msg.role === 'user' && msg.userId === currentUserId;
                        const isOtherUser = msg.role === 'user' && msg.userId !== currentUserId && msg.userId;
                        const isAI = msg.role === 'assistant';
                        const isSystem = msg.role === 'system';
                        const showSenderRow = msg.role === 'user' || isAI;
                        const senderLabel = isAI
                            ? 'AI 컨설턴트'
                            : (isCurrentUser ? `${msg.userName || '나'} (나)` : (msg.userName || '참여자'));
                        
                        return (
                        <div key={msg.id} className={`message-wrapper ${isCurrentUser ? 'current-user' : ''} ${isOtherUser ? 'other-user' : ''} ${isAI ? 'ai' : ''} ${isSystem ? 'system' : ''}`}>
                            {showSenderRow && (
                                <div className={`message-avatar-row ${isCurrentUser ? 'current-user' : ''}`}>
                                    <UserAvatar 
                                        userName={msg.userName} 
                                        userColor={msg.userColor} 
                                        size={28}
                                        isAI={isAI}
                                    />
                                    <span className="message-sender-name">{senderLabel}</span>
                                </div>
                            )}
                            <div className="message-bubble">
                                {msg.role === 'user' ? (
                                    <div className="message-content">{msg.content}</div>
                                ) : (
                                    <div className="message-content markdown-body">
                                            {msg.evidence && (
                                                <div className={`message-evidence evidence-${getEvidenceClassName(msg.evidence)}`}>
                                                    <div className="message-evidence-badge">
                                                        {EVIDENCE_LEVEL_LABELS[msg.evidence.level]}
                                                    </div>
                                                    <div className="message-evidence-summary">{msg.evidence.summary}</div>
                                                    {msg.evidence.note && (
                                                        <div className="message-evidence-note">{msg.evidence.note}</div>
                                                    )}
                                                    {msg.evidence.sources && msg.evidence.sources.length > 0 && (
                                                        <div className="message-evidence-sources">
                                                            {msg.evidence.sources.map((source, index) => (
                                                                <a
                                                                    key={`${msg.id}-source-${index}`}
                                                                    className="message-evidence-source"
                                                                    href={source.url || '#'}
                                                                    target={source.url ? '_blank' : undefined}
                                                                    rel={source.url ? 'noreferrer' : undefined}
                                                                    onClick={(event) => {
                                                                        if (!source.url) {
                                                                            event.preventDefault();
                                                                        }
                                                                    }}
                                                                >
                                                                    <span>{source.title}</span>
                                                                    {source.detail && <span>{source.detail}</span>}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}

                                {/* AI 메시지에만 복사 버튼 표시 */}
                                {msg.role === 'assistant' && (
                                    <button
                                        className="copy-message-btn"
                                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                                        title="메시지 복사"
                                        aria-label="AI 메시지 복사"
                                    >
                                        {copiedMessageId === msg.id ? (
                                            <><Check size={12} /> 복사됨</>
                                        ) : (
                                            <><Copy size={12} /> 복사</>
                                        )}
                                    </button>
                                )}

                                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                                    <div className="ai-tools-panel">
                                        <div className="ai-tools-header-row">
                                            <div className="tools-header">
                                                <Sparkles size={12} /> 추천 변경안 {msg.suggestedActions.length}개
                                            </div>
                                            <button
                                                className="action-apply-btn"
                                                onClick={() => handleApplyAllActions(msg.id, msg.suggestedActions ?? [])}
                                                aria-label="AI 제안 액션을 모두 캔버스에 적용"
                                            >
                                                전체 적용
                                            </button>
                                        </div>
                                        <div className="ai-tools-summary">
                                            <p className="ai-tools-summary-text">
                                                응답 내용을 바로 실행 가능한 작업으로 정리했습니다. 필요한 카드만 골라 적용할 수 있습니다.
                                            </p>
                                            <div className="ai-tool-stats">
                                                {getActionStats(msg.suggestedActions).map((stat) => (
                                                    <span key={`${msg.id}-${stat.key}`} className="ai-tool-stat">
                                                        {stat.label} {stat.count}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="ai-tool-grid">
                                            {msg.suggestedActions.map((action, index) => {
                                                const group = getActionGroup(action.name);
                                                const meta = getActionMeta(action);
                                                const actionKey = getActionExecutionKey(msg.id, action, index);
                                                const isApplied = appliedActionKeys.includes(actionKey);

                                                return (
                                                    <div key={actionKey} className={`ai-tool-card ai-tool-card--${ACTION_GROUP_META[group]?.tone ?? 'system'}`}>
                                                        <div className="ai-tool-card-header">
                                                            <span className="ai-tool-card-type">{ACTION_GROUP_META[group]?.label ?? '시스템'}</span>
                                                            <span className="ai-tool-card-index">#{index + 1}</span>
                                                        </div>
                                                        <div className="ai-tool-card-title">{getActionTitle(action)}</div>
                                                        <div className="ai-tool-card-desc">{getActionDescription(action)}</div>
                                                        {meta.length > 0 && (
                                                            <div className="ai-tool-card-meta">
                                                                {meta.map((item) => (
                                                                    <span key={`${actionKey}-${item}`} className="ai-tool-card-meta-chip">{item}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="ai-tool-card-footer">
                                                            <div className="ai-tool-card-name">{action.name}</div>
                                                            <button
                                                                className={`action-apply-inline-btn ${isApplied ? 'is-applied' : ''}`}
                                                                onClick={() => handleApplySingleAction(msg.id, action, index)}
                                                                disabled={isApplied}
                                                                aria-label={isApplied ? '이미 적용된 액션' : '이 액션만 적용'}
                                                            >
                                                                {isApplied ? '적용됨' : '이 액션만 적용'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="message-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        );
                    })}
                    {uploadProgress && (
                        <div className="status-indicator">
                            <Loader2 className="spinner" size={14} />
                            <span>{uploadProgress}</span>
                        </div>
                    )}
                    {isLoading && !uploadProgress && (
                        <div className="status-indicator">
                            <Loader2 className="spinner" size={14} />
                            <span>AI가 답변을 생성하고 있습니다...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="chat-footer">
                {attachments.length > 0 && (
                    <div className="attachment-list">
                        {attachments.map((file, i) => {
                            const previewKey = `${file.name}-${file.size}-${file.lastModified}`;
                            const previewUrl = attachmentPreviews[previewKey];
                            return (
                                <div key={previewKey} className="attachment-chip">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt={file.name} className="attachment-preview" />
                                    ) : (
                                        <FileText size={12} />
                                    )}
                                    <span className="file-name">{file.name}</span>
                                    <button onClick={() => removeAttachment(i)} aria-label={`${file.name} 첨부 제거`}>
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="input-row">
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        accept=".pdf,.json,application/json,image/*"
                    />
                    <button
                        className="footer-icon-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="파일 첨부"
                        aria-label="파일 첨부"
                    >
                        <Paperclip size={18} />
                    </button>

                    <textarea
                        className="chat-input-field"
                        placeholder="메시지를 입력하세요..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onPaste={handlePaste}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        rows={1}
                    />

                    <motion.button
                        className="send-btn-modern"
                        onClick={() => handleSendMessage()}
                        disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}
                        aria-label="메시지 전송"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Send size={18} />
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default AIChatSidebar;
