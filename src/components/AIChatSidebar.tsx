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

    useEffect(() => {
        const unsub = liveblocksService.onChatMessages((msgs) => {
            setMessages(msgs);
        });

        const initialMsgs = liveblocksService.getChatMessages();
        if (initialMsgs.length > 0) {
            setMessages(initialMsgs);
        }

        return () => unsub();
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

        try {
            // 메시지 전송 시작
            if (currentText.trim()) {
                liveblocksService.sendChatMessage(currentText);
            }

            let fileUri: string | undefined;
            let mimeType: string | undefined;

            if (attachments.length > 0) {
                setUploadProgress('파일 분석 중...');
                const metadata = await aiService.uploadPDF(attachments[0]);
                fileUri = metadata.uri;
                mimeType = metadata.mimeType;
                setUploadProgress(null);
            }

            // 현재 맵 상태를 요약하여 컨텍스트로 생성
            const mapContext = {
                notes: _notes.map(n => ({
                    id: n.id,
                    content: n.content, // text -> content
                    type: n.type,
                    layer: n.layer,
                    sentiment: n.sentiment,
                    intensity: n.perceptionIntensity
                })),
                connections: _connections.map(c => ({
                    sourceId: c.sourceId,
                    targetId: c.targetId,
                    description: c.description || c.relationType,
                    isPositive: c.isPositive
                })),
                canvasStructure: {
                    layerHeights,
                    totalHeight: layerHeights.reduce((a, b) => a + b, 0)
                }
            };
            const contextString = `[Current Map State]\n${JSON.stringify(mapContext, null, 2)}\n\n[Instruction] 위 맵 상태를 참고하여 사용자의 요청을 수행하세요. 기존 노드는 가급적 유지하고 필요할 때만 추가/수정/삭제하세요.`;

            const response = await aiService.sendChatMessage(
                `${contextString}\n\n[User Message]\n${currentText || '첨부된 파일을 분석해주세요.'}`,
                fileUri,
                mimeType
            );
            liveblocksService.sendAiResponse(response.text, response.functionCalls);

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
