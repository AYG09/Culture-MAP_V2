import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, X, Sparkles, Loader2, FileText, Settings, Copy, Check, Users, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiService } from '../services/AIService';
import AIConfigModal from './AIConfigModal';
import ConsultingToolsPanel from './ConsultingToolsPanel';
import liveblocksService from '../services/LiveblocksService';
import type { ChatMessage } from '../types/liveblocks';
import type { AiAction } from '../types/actions';
import type { NoteData, ConnectionData } from '../types/culture';
import type { PasswordType } from '../services/GatewayAdminService';
import './AIChatSidebar.css';

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
                    console.log('💬 [AIChatSidebar] Chat messages updated:', msgs.length);
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

� 층위 구조 (상위→하위 = 원인→결과):
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
💡 참고: 노드 생성 후 관련 노드와 create_connection 호출 권장!
💡 여러 노드와 연결을 한 번에 만들 때는 add_nodes_with_connections를 사용하고, nodes에 tempId를 지정한 뒤 connections에서 tempId를 참조하세요.
💡 특정 위치로 옮길 때는 update_node에 x/y 좌표를 포함하세요.
💡 레이아웃이 겹치거나 연결선이 가려지면 adjust_layer_height로 레이어 높이를 늘려 공간을 확보하세요.
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
                    try {
                        setUploadProgress('JSON 파일 읽는 중...');
                        const rawText = await attachment.text();
                        JSON.parse(rawText);
                        jsonAttachmentName = attachment.name;
                        jsonAttachmentText = rawText.length > MAX_JSON_ATTACH_CHARS
                            ? `${rawText.slice(0, MAX_JSON_ATTACH_CHARS)}\n\n...[중략: ${rawText.length - MAX_JSON_ATTACH_CHARS}자 생략]`
                            : rawText;
                        setUploadProgress(null);
                    } catch (jsonErr) {
                        console.error('JSON parse failed:', jsonErr);
                        setUploadProgress('JSON 형식이 올바르지 않습니다.');
                        return;
                    }
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

            const actionVerbs = ['추가', '생성', '만들', '연결', '정리', '정렬', '배치', '레이아웃', '삭제', '지워', '제거', '수정', '변경', '옮겨', '이동', '높이', '요약', '축약', '줄여', '간략', '다듬', '정제', '편집', '바꿔'];
            const actionNouns = ['노드', '포스트잇', '연결', '선', '화살표', '엣지', '레이아웃', '정렬', '배치', '맵', '레이어', '내용', '문장', '텍스트'];
            const explicitActionPattern = /(추가해|추가해줘|생성해|생성해줘|만들어|만들어줘|연결해|연결해줘|삭제해|지워줘|제거해|수정해|변경해|옮겨줘|이동해|정렬해|배치해|레이아웃해|높여|줄여)/;
            const explanationKeywords = ['설명', '왜', '근거', '의미', '정의', '차이', '무슨', '뭐야', '무엇', '말해', '알려', '이유', '해석'];
            const hasVerb = actionVerbs.some(keyword => currentText.includes(keyword));
            const hasNoun = actionNouns.some(keyword => currentText.includes(keyword));
            const layoutOnlyRequest = /정렬|정리|배치|레이아웃|높이/.test(currentText);
            const mapEditIntentDetected = (hasVerb && hasNoun) || layoutOnlyRequest;
            const explanationRequest = explanationKeywords.some(keyword => currentText.includes(keyword));
            const explicitActionDetected = explicitActionPattern.test(currentText);
            const explicitMapEditRequest = !isPrivateChat && (explicitActionDetected || layoutOnlyRequest) && !explanationRequest;
            const preservePositionsRequested = /(위치.*유지|현재.*위치|정렬.*하지|정렬하지|레이아웃.*하지|자동\s*정렬.*(하지|말))/i.test(currentText);
            const forceFunctionCall = explicitMapEditRequest;

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
                { forceFunctionCall, allowExternalTools: !isPrivateChat && explicitMapEditRequest }
            );

            let aiMsgId = '';
            let finalActions: AiAction[] = [];
            let isFirstChunk = true;

            const hasAcademicFiles = aiService.getAcademicFiles().length > 0;
            const timeoutMs = hasAcademicFiles || fileUri ? 120000 : 30000;

            // 타임아웃 설정 (응답 지연 시 무한 로딩 방지)
            const responseTimeout = setTimeout(() => {
                if (isFirstChunk) {
                    console.warn(`⌛ [AIChatSidebar] AI Response Timeout (${Math.round(timeoutMs / 1000)}s)`);
                    setIsLoading(false);
                    const timeoutId = liveblocksService.startAiResponse();
                    liveblocksService.updateAiResponse(timeoutId, `AI 응답이 ${Math.round(timeoutMs / 1000)}초 이상 지연되어 연결을 중단했습니다. 인터넷 연결을 확인하거나 Gemini API 할당량을 확인해주세요.`);
                }
            }, timeoutMs);

            try {
                for await (const chunk of aiStream) {
                    if (isFirstChunk) {
                        console.log('🤖 [AIChatSidebar] AI First chunk received!');
                        clearTimeout(responseTimeout);
                        setIsLoading(false); // 스트리밍이 시작되면 일반 로딩 인디케이터 숨김
                        if (!isPrivateChat && liveblocksService.isConnected()) {
                            aiMsgId = liveblocksService.startAiResponse();
                            console.log('🤖 [AIChatSidebar] AI Message ID created:', aiMsgId);
                        }
                        isFirstChunk = false;

                        // Liveblocks가 연결되지 않은 경우 로컬 상태로 폴백
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
                                scope: chatScope
                            }]);
                        }
                    }

                    if (chunk.type === 'text') {
                        console.log('🤖 [AIChatSidebar] Received text chunk, fullText length:', chunk.fullText?.length);
                        // Liveblocks 연결 시
                        if (aiMsgId && !aiMsgId.startsWith('local-')) {
                            liveblocksService.updateAiResponse(aiMsgId, chunk.fullText || '');
                        } else {
                            // 로컬 상태 업데이트
                            setMessages(prev => prev.map(m =>
                                m.id === aiMsgId ? { ...m, content: chunk.fullText || '' } : m
                            ));
                        }
                    } else if (chunk.type === 'actions') {
                        if (isFirstChunk) {
                            console.log('🤖 [AIChatSidebar] AI First chunk received (actions)');
                            clearTimeout(responseTimeout);
                            setIsLoading(false);
                            if (!isPrivateChat && liveblocksService.isConnected()) {
                                aiMsgId = liveblocksService.startAiResponse();
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
                                    scope: chatScope
                                }]);
                            }
                        }

                        finalActions = Array.isArray(chunk.actions) ? chunk.actions : [];
                        console.log('🎯 [AIChatSidebar] Actions received:', finalActions.length, 'items');

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
                                liveblocksService.updateAiResponse(aiMsgId);
                            }
                        } else {
                            // 수동 실행 모드: 메시지에 actions 저장하여 버튼 표시
                            console.log('🛡️ [AIChatSidebar] Manual mode - storing actions for user confirmation');
                            if (aiMsgId && !aiMsgId.startsWith('local-')) {
                                liveblocksService.updateAiResponse(aiMsgId, undefined, actionsWithFlags);
                            } else {
                                setMessages(prev => prev.map(m =>
                                    m.id === aiMsgId ? { ...m, suggestedActions: actionsWithFlags } : m
                                ));
                            }
                        }
                    }
                }
            } finally {
                clearTimeout(responseTimeout);
            }

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 에러';
            console.error('Chat error:', error);
            if (!isPrivateChat && liveblocksService.isConnected()) {
                liveblocksService.sendAiResponse(`죄송합니다. 오류가 발생했습니다: ${message}`);
            } else {
                setMessages(prev => [...prev, {
                    id: `ai-error-${Date.now()}`,
                    role: 'assistant' as const,
                    content: `죄송합니다. 오류가 발생했습니다: ${message}`,
                    userName: 'AI Assistant',
                    userColor: '#8b5cf6',
                    timestamp: Date.now(),
                    scope: chatScope
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
                                        <div className="tools-header">
                                            <Sparkles size={12} /> AI 제안 액션 ({msg.suggestedActions.length})
                                        </div>
                                        <button
                                            className="action-apply-btn"
                                            onClick={() => {
                                                msg.suggestedActions?.forEach(action => onActionExecute(action));
                                            }}
                                            aria-label="AI 제안 액션을 캔버스에 적용"
                                        >
                                            캔버스에 즉시 적용
                                        </button>
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
