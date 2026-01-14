import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Sparkles, Loader2, FileText, Settings } from 'lucide-react';
import { aiService } from '../services/AIService';
import AIConfigModal from './AIConfigModal';
import liveblocksService from '../services/LiveblocksService';
import type { ChatMessage } from '../types/liveblocks';
import type { NoteData, ConnectionData } from '../types/culture';
import './AIChatSidebar.css';

interface AIChatSidebarProps {
    onActionExecute: (action: any) => void;
    notes: NoteData[];
    connections: ConnectionData[];
    layerHeights?: number[];
}

const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
    onActionExecute,
    notes: _notes,
    connections: _connections,
    layerHeights = [200, 200, 200, 200]
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, uploadProgress]);

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
                    setMessages(msgs);
                });
                
                const initialMsgs = liveblocksService.getChatMessages();
                if (initialMsgs.length > 0) {
                    setMessages(initialMsgs);
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
        if (!overrideText) setInputValue('');
        setIsLoading(true);

        // 현재 맵 상태를 텍스트로 요약 (AI 컨텍스트용)
        const contextString = `[현재 컬처맵 컨텍스트]
- 노드 수: ${_notes.length}개
- 노드 목록: ${_notes.map(n => `[${n.type}] ${n.text}`).join(', ')}
- 연결 관계: ${_connections.map(c => {
    const fromNode = _notes.find(n => n.id === c.from);
    const toNode = _notes.find(n => n.id === c.to);
    return `${fromNode?.text || '?'} -> ${toNode?.text || '?'}`;
}).join(', ')}`;

        let fileUri: string | undefined;
        let mimeType: string | undefined;

        try {
            console.log('💬 [AIChatSidebar] Sending message:', currentText);
            // 메시지 전송 시작
            if (currentText.trim()) {
                liveblocksService.sendChatMessage(currentText);
            }
            
            // 파일 업로드 처리 (있는 경우 첫 번째 파일만)
            if (attachments.length > 0) {
                try {
                    setUploadProgress('파일 업로드 중...');
                    const metadata = await aiService.uploadPDF(attachments[0]);
                    fileUri = metadata.uri;
                    mimeType = metadata.mimeType;
                } catch (uploadErr) {
                    console.error('File upload failed:', uploadErr);
                    setUploadProgress('업로드 실패');
                }
            }
            
            console.log('🤖 [AIChatSidebar] Requesting AI Stream...');
            // 스트리밍 시작
            const aiStream = aiService.sendChatMessageStream(
                `${contextString}\n\n[사용자 메시지]\n${currentText || '첨부된 파일을 분석해주세요.'}`,
                fileUri,
                mimeType
            );

            let aiMsgId = '';
            let finalActions: any[] = [];
            let isFirstChunk = true;

            // 30초 타임아웃 설정 (응답 지연 시 무한 로딩 방지)
            const responseTimeout = setTimeout(() => {
                if (isFirstChunk) {
                    console.warn('⌛ [AIChatSidebar] AI Response Timeout (30s)');
                    setIsLoading(false);
                    const timeoutId = liveblocksService.startAiResponse();
                    liveblocksService.updateAiResponse(timeoutId, 'AI 응답이 30초 이상 지연되어 연결을 중단했습니다. 인터넷 연결을 확인하거나 Gemini API 할당량을 확인해주세요.');
                }
            }, 30000);

            try {
                for await (const chunk of aiStream) {
                    if (isFirstChunk) {
                        console.log('🤖 [AIChatSidebar] AI First chunk received!');
                        clearTimeout(responseTimeout);
                        setIsLoading(false); // 스트리밍이 시작되면 일반 로딩 인디케이터 숨김
                        aiMsgId = liveblocksService.startAiResponse();
                        console.log('🤖 [AIChatSidebar] AI Message ID created:', aiMsgId);
                        isFirstChunk = false;
                        
                        // Liveblocks가 연결되지 않은 경우 로컬 상태로 폴백
                        if (!aiMsgId) {
                            console.warn('⚠️ [AIChatSidebar] Liveblocks not connected, using local state');
                            const localMsgId = `local-ai-${Date.now()}`;
                            aiMsgId = localMsgId;
                            setMessages(prev => [...prev, {
                                id: localMsgId,
                                role: 'assistant',
                                content: '',
                                timestamp: Date.now()
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
                        finalActions = chunk.actions || [];
                        if (aiMsgId && !aiMsgId.startsWith('local-')) {
                            liveblocksService.updateAiResponse(aiMsgId, undefined as any, finalActions);
                        } else {
                            setMessages(prev => prev.map(m =>
                                m.id === aiMsgId ? { ...m, suggestedActions: finalActions } : m
                            ));
                        }
                    }
                }
            } finally {
                clearTimeout(responseTimeout);
            }

        } catch (error: any) {
            console.error('Chat error:', error);
            liveblocksService.sendAiResponse(`죄송합니다. 오류가 발생했습니다: ${error.message || '알 수 없는 에러'}`);
        } finally {
            setIsLoading(false);
            setUploadProgress(null);
            setAttachments([]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(Array.from(e.target.files));
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="ai-chat-sidebar">
            <div className="chat-header">
                <h2><Sparkles size={18} className="ai-icon" /> AI 컨설턴트</h2>
                <button
                    className="header-config-btn"
                    onClick={() => setIsConfigOpen(true)}
                    title="AI API 설정 (BYOK)"
                >
                    <Settings size={18} />
                </button>
            </div>

            <AIConfigModal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
            />

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="welcome-container">
                        <div className="welcome-card">
                            <h3>👋 반갑습니다!</h3>
                            <p>조직문화 분석과 맵 제어를 도와드릴게요.</p>
                            <div className="suggestion-buttons">
                                {suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        className="suggestion-item-btn"
                                        onClick={() => handleSendMessage(suggestion)}
                                    >
                                        "{suggestion}"
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-wrapper ${msg.role === 'user' ? 'user' : 'ai'}`}>
                        <div className="message-bubble">
                            <div className="message-content">{msg.content}</div>

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
                ))}
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

            <div className="chat-footer">
                {attachments.length > 0 && (
                    <div className="attachment-list">
                        {attachments.map((file, i) => (
                            <div key={i} className="attachment-chip">
                                <FileText size={12} />
                                <span className="file-name">{file.name}</span>
                                <button onClick={() => removeAttachment(i)}><X size={12} /></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="input-row">
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        accept=".pdf,image/*"
                    />
                    <button className="footer-icon-btn" onClick={() => fileInputRef.current?.click()} title="파일 첨부">
                        <Paperclip size={18} />
                    </button>

                    <textarea
                        className="chat-input-field"
                        placeholder="AI에게 지시하기..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        rows={1}
                    />

                    <button
                        className="send-btn"
                        onClick={() => handleSendMessage()}
                        disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatSidebar;
