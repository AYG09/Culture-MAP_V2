import React, { useEffect, useState, useCallback } from 'react';
import { X, Save, Key, Info, CheckCircle2, Trash2, Loader2, FileText, Eye, EyeOff, Share2, Database, AlertTriangle } from 'lucide-react';
import { aiService, type AIProvider, type AIConfig, type ReasoningPreset, type GeminiModelListResult } from '../services/AIService';
import liveblocksService from '../services/LiveblocksService';
import './AIConfigModal.css';

function resolveModelListWarning(result: GeminiModelListResult): string {
    switch (result.reason) {
        case 'stale-cache-after-refresh-error':
            return '최신 목록 조회에 실패해 이전에 조회한 모델 목록을 표시합니다.';
        case 'filter-empty':
            return 'Google 응답은 있었지만 생성 가능한 Gemini 모델을 찾지 못했습니다.';
        case 'client-not-initialized':
            return 'API 키는 저장되어 있지만 AI 클라이언트가 초기화되지 않았습니다.';
        case 'api-error':
            return '저장된 API 키로 Google 모델 목록 조회에 실패했습니다. 기본 목록을 표시합니다.';
        case 'empty-api-result':
            return 'Google API가 모델 목록을 반환하지 않았습니다. 기본 목록을 표시합니다.';
        case 'missing-api-key':
            return 'API 키가 설정되지 않아 모델 목록을 조회할 수 없습니다.';
        default:
            return '모델 목록을 조회할 수 없어 기본 목록을 표시합니다.';
    }
}

interface AIConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose }) => {
    const currentConfig = aiService.getConfig();
    const provider: AIProvider = 'gemini';
    const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
    const [tavilyApiKey, setTavilyApiKey] = useState(currentConfig?.tavilyApiKey || '');
    const [modelName, setModelName] = useState(currentConfig?.modelName || aiService.getAvailableGeminiModels()[0] || '');
    const [reasoningPreset, setReasoningPreset] = useState<ReasoningPreset>(currentConfig?.reasoningPreset ?? 'default');
    const [autoExecute, setAutoExecute] = useState(currentConfig?.autoExecuteFunctionCalls || false);
    const [sharedApiKeyMode, setSharedApiKeyMode] = useState(currentConfig?.sharedApiKeyMode || false);
    const [isSaved, setIsSaved] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [showTavilyKey, setShowTavilyKey] = useState(false);
    const [consultingPassword, setConsultingPassword] = useState('');
    const [consultingError, setConsultingError] = useState('');
    const [consultingSuccess, setConsultingSuccess] = useState(false);
    const [isSwitchingMode, setIsSwitchingMode] = useState(false);
    const [workshopError, setWorkshopError] = useState('');
    const [workshopSuccess, setWorkshopSuccess] = useState(false);

    const currentUserId = liveblocksService.getCurrentUserId();

    // 공유 RAG 상태
    const [sharedRagDocs, setSharedRagDocs] = useState<Array<{ docId: string; docName: string; uploaderId: string; uploaderName: string; chunkCount: number; uploadedAt: number }>>([]);
    const [isUploadingToShared, setIsUploadingToShared] = useState(false);

    // 공유 RAG 문서 목록 로드
    const loadSharedRagDocs = useCallback(() => {
        const docs = liveblocksService.getSharedRagDocList();
        setSharedRagDocs(docs);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        loadSharedRagDocs();
    }, [isOpen, loadSharedRagDocs]);

    // 공유 RAG 청크 변경 감지
    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = liveblocksService.onSharedRagChunks(() => {
            loadSharedRagDocs();
        });
        return unsubscribe;
    }, [isOpen, loadSharedRagDocs]);

    const [availableModels, setAvailableModels] = useState<string[]>(() => aiService.getAvailableGeminiModels());
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelListWarning, setModelListWarning] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;
        setIsLoadingModels(true);
        setModelListWarning(null);
        // client-not-initialized 방어: API 키가 있으면 클라이언트 재초기화 후 조회
        aiService.ensureClientInitialized();
        // 설정창을 열 때마다 강제 갱신하여 최신 모델 목록 반영
        aiService.getAvailableGeminiModelsResult(true)
            .then((result: GeminiModelListResult) => {
                if (!mounted) return;
                setAvailableModels(result.models);
                setModelName((prev) => (result.models.includes(prev) ? prev : result.models[0]));
                if (result.source === 'fallback' || result.stale) {
                    setModelListWarning(resolveModelListWarning(result));
                }
            })
            .catch((error) => {
                console.warn('⚠️ [AIConfigModal] 모델 목록 로드 실패:', error);
                if (mounted) {
                    setModelListWarning('저장된 API 키로 Google 모델 목록 조회에 실패했습니다. 기본 목록을 표시합니다.');
                }
            })
            .finally(() => {
                if (mounted) setIsLoadingModels(false);
            });

        return () => {
            mounted = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const latestConfig = aiService.getConfig();
        setApiKey(latestConfig?.apiKey || '');
        setTavilyApiKey(latestConfig?.tavilyApiKey || '');
        setModelName(latestConfig?.modelName || availableModels[0] || '');
        setReasoningPreset(latestConfig?.reasoningPreset ?? 'default');
        setAutoExecute(latestConfig?.autoExecuteFunctionCalls || false);
        setSharedApiKeyMode(latestConfig?.sharedApiKeyMode || false);
        setShowKey(false);
        setShowTavilyKey(false);
        setIsSaved(false);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const newConfig: AIConfig = {
            provider,
            apiKey: apiKey.trim(),
            tavilyApiKey: tavilyApiKey.trim() || undefined,
            modelName: modelName.trim(),
            reasoningPreset,
            ragSearchScope: 'shared',
            autoExecuteFunctionCalls: autoExecute,
            sharedApiKeyMode
        };
        aiService.setConfig(newConfig);
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            onClose();
        }, 1500);
    };

    // 공유 RAG로 PDF 업로드
    const handleSharedRagUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const pdfFiles = files.filter(file => file.type === 'application/pdf');
        if (pdfFiles.length === 0) {
            alert('세션 RAG는 PDF 파일만 지원합니다.');
            e.target.value = '';
            return;
        }

        const currentCount = sharedRagDocs.length;
        const remainingSlots = Math.max(0, 20 - currentCount);
        if (pdfFiles.length > remainingSlots) {
            alert(`세션 RAG는 세션당 최대 20개까지 가능합니다. (현재 ${currentCount}개)`);
        }

        const filesToUpload = pdfFiles.slice(0, remainingSlots);
        if (filesToUpload.length === 0) {
            e.target.value = '';
            return;
        }

        try {
            setIsUploadingToShared(true);
            for (const file of filesToUpload) {
                // 먼저 Gemini에 업로드
                const metadata = await aiService.uploadAcademicFileWithOptions(file, { indexLocally: false });
                // 공유 RAG로 인덱싱
                const result = await aiService.indexAcademicPdfToShared(file, metadata);
                if (result && result.chunkCount > 0) {
                    console.log(`📚 [AIConfigModal] 공유 RAG 업로드 완료: ${file.name} (${result.chunkCount} chunks)`);
                }
            }
            loadSharedRagDocs();
        } catch (error) {
            console.error('세션 RAG 업로드 실패:', error);
            alert('세션 RAG 업로드에 실패했습니다. API 키를 확인해주세요.');
        } finally {
            setIsUploadingToShared(false);
            e.target.value = '';
        }
    };

    // 공유 RAG 문서 삭제
    const handleRemoveSharedRagDoc = (docId: string) => {
        if (!window.confirm('이 학술자료를 세션 RAG에서 삭제하시겠습니까? 모든 참여자의 AI 검색에서 제외됩니다.')) {
            return;
        }
        aiService.removeSharedRagDocument(docId);
        loadSharedRagDocs();
    };

    const handleSwitchToConsulting = async () => {
        setConsultingError('');
        setConsultingSuccess(false);
        setWorkshopError('');
        setWorkshopSuccess(false);

        const session = liveblocksService.getCurrentSession();
        if (!session) {
            setConsultingError('세션에 연결된 상태에서만 전환할 수 있습니다.');
            return;
        }

        if (session.type === 'consulting') {
            setConsultingError('이미 컨설팅 모드입니다.');
            return;
        }

        const input = consultingPassword.trim().toLowerCase();
        const required = 'winter09@!';
        if (input !== required.toLowerCase()) {
            setConsultingError('비밀번호가 올바르지 않습니다.');
            return;
        }

        setIsSwitchingMode(true);
        try {
            await liveblocksService.updateSessionType('consulting');
            setConsultingSuccess(true);
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } catch (error) {
            console.error('컨설팅 모드 전환 실패:', error);
            setConsultingError('모드 전환에 실패했습니다. 잠시 후 다시 시도하세요.');
        } finally {
            setIsSwitchingMode(false);
        }
    };

    const handleSwitchToWorkshop = async () => {
        setWorkshopError('');
        setWorkshopSuccess(false);
        setConsultingError('');
        setConsultingSuccess(false);

        const session = liveblocksService.getCurrentSession();
        if (!session) {
            setWorkshopError('세션에 연결된 상태에서만 전환할 수 있습니다.');
            return;
        }

        if (session.type === 'workshop') {
            setWorkshopError('이미 워크샵 모드입니다.');
            return;
        }

        if (!window.confirm('워크샵 모드로 전환하시겠습니까?\n\n보고서/빈도 기능이 숨겨지고 워크샵 UI로 전환됩니다.')) {
            return;
        }

        setIsSwitchingMode(true);
        try {
            await liveblocksService.updateSessionType('workshop');
            setWorkshopSuccess(true);
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } catch (error) {
            console.error('워크샵 모드 전환 실패:', error);
            setWorkshopError('모드 전환에 실패했습니다. 잠시 후 다시 시도하세요.');
        } finally {
            setIsSwitchingMode(false);
        }
    };

    return (
        <div className="ai-config-modal-overlay">
            <div className="ai-config-modal">
                <div className="modal-header">
                    <div className="header-title">
                        <Key size={20} className="icon-blue" />
                        <h3>AI API 설정 (BYOK)</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="info-box">
                        <Info size={16} />
                        <p>입력한 키는 이 브라우저의 로컬 저장소에 저장됩니다. Tavily 키를 넣으면 웹 검색 요청 시 서버 릴레이를 통해 해당 키가 우선 사용됩니다.</p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">API 키</label>
                        <div className="input-with-action">
                            <input
                                type={showKey ? "text" : "password"}
                                className="config-input"
                                placeholder="Gemini API 키를 입력하세요"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <button
                                className="config-toggle-visibility"
                                onClick={() => setShowKey(!showKey)}
                                title={showKey ? "숨기기" : "보기"}
                            >
                                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="help-text">
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                                Google AI Studio에서 키 발급받기 ↗
                            </a>
                        </p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">Tavily 웹 검색 키</label>
                        <div className="input-with-action">
                            <input
                                type={showTavilyKey ? "text" : "password"}
                                className="config-input"
                                placeholder="선택 사항: Tavily API 키를 입력하세요"
                                value={tavilyApiKey}
                                onChange={(e) => setTavilyApiKey(e.target.value)}
                            />
                            <button
                                className="config-toggle-visibility"
                                onClick={() => setShowTavilyKey(!showTavilyKey)}
                                title={showTavilyKey ? "숨기기" : "보기"}
                                type="button"
                            >
                                {showTavilyKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="help-text">
                            <a href="https://app.tavily.com/home" target="_blank" rel="noreferrer">
                                Tavily에서 키 발급받기 ↗
                            </a>
                        </p>
                        <p className="help-text ai-config-help-muted">
                            입력하지 않으면 서버 환경 변수의 Tavily 키를 사용합니다.
                        </p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">
                            모델 선택
                            {isLoadingModels && <Loader2 size={13} className="spinner" style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
                        </label>
                        <select
                            className="config-select"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            disabled={isLoadingModels}
                        >
                            {availableModels.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        {modelListWarning && (
                            <p className="help-text" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={13} /> {modelListWarning}
                            </p>
                        )}
                    </div>

                    <div className="config-section">
                        <label className="section-label">추론 깊이</label>
                        <select
                            className="config-select"
                            value={reasoningPreset}
                            onChange={(e) => setReasoningPreset(e.target.value as ReasoningPreset)}
                        >
                            <option value="default">기본값 — 모델 기본 설정</option>
                            <option value="fast">빠름 — 낮은 추론, 빠른 응답</option>
                            <option value="balanced">균형 — 중간 추론</option>
                            <option value="deep">깊게 — 높은 추론, 정밀 분석</option>
                        </select>
                        <p className="help-text" style={{ color: '#10b981', fontWeight: 500, lineHeight: 1.5 }}>
                            {(() => {
                                const isG3 = /^gemini-3(\.|-)/.test(modelName) || modelName === 'gemini-3';
                                const isG25 = /^gemini-2\.5/.test(modelName);
                                if (isG3) {
                                    if (reasoningPreset === 'default') return '✨ Gemini 3.x: 모델 기본 추론 사용';
                                    if (reasoningPreset === 'fast') return '✨ Gemini 3.x: 낮은 추론 수준 적용';
                                    if (reasoningPreset === 'balanced') return '✨ Gemini 3.x: 중간 추론 수준 적용';
                                    if (reasoningPreset === 'deep') return '✨ Gemini 3.x: 높은 추론 수준 적용';
                                }
                                if (isG25) {
                                    if (reasoningPreset === 'default') return '⚙️ Gemini 2.5: 모델 기본 추론 사용';
                                    if (reasoningPreset === 'fast') return '⚙️ Gemini 2.5: 낮은 토큰 예산 (빠름)';
                                    if (reasoningPreset === 'balanced') return '⚙️ Gemini 2.5: 중간 토큰 예산 (균형)';
                                    if (reasoningPreset === 'deep') return '⚙️ Gemini 2.5: 높은 토큰 예산 (정밀)';
                                }
                                return 'ℹ️ 모델 기본 추론 사용';
                            })()}
                        </p>
                    </div>

                    {/* AI 액션 자동 실행 설정 */}
                    <div className="config-section">
                        <label className="section-label">AI 액션 실행 모드</label>
                        <div className="toggle-row">
                            <span className="toggle-label">
                                {autoExecute ? '🚀 자동 실행' : '✋ 수동 확인'}
                            </span>
                            <button
                                className={`toggle-switch ${autoExecute ? 'active' : ''}`}
                                onClick={() => setAutoExecute(!autoExecute)}
                                type="button"
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>
                        <p className="help-text">
                            {autoExecute
                                ? '⚡ AI가 제안하는 노드 추가/수정이 즉시 캔버스에 반영됩니다.'
                                : '🛡️ AI 제안을 확인 후 "캔버스에 적용" 버튼을 눌러야 반영됩니다.'}
                        </p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">공용 API 키 모드</label>
                        <div className="toggle-row">
                            <span className="toggle-label">
                                {sharedApiKeyMode ? '👥 세션 단일 키(동시 호출 제한)' : '👤 개인 키(각자 호출)'}
                            </span>
                            <button
                                className={`toggle-switch ${sharedApiKeyMode ? 'active' : ''}`}
                                onClick={() => setSharedApiKeyMode(!sharedApiKeyMode)}
                                type="button"
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>
                        <p className="help-text">
                            {sharedApiKeyMode
                                ? '세션 참여자 간 AI 호출을 순차 처리해 429 오류를 줄입니다.'
                                : '각자 API 키를 사용하면 동시 호출 제한이 없습니다.'}
                        </p>
                    </div>

                    <div className="config-section ai-config-rag-mode">
                        <label className="section-label">학술자료 검색 범위</label>
                        <div className="rag-mode-summary">
                            <Database size={16} />
                            <div>
                                <strong>세션 RAG만 사용</strong>
                                <span>업로드된 PDF는 세션에 저장되고, 다시 접속해도 모든 참여자가 AI 검색/인용에 활용합니다.</span>
                            </div>
                        </div>
                    </div>

                    <div className="config-section">
                        <label className="section-label">컨설팅 모드 전환</label>
                        <div className="consulting-switch">
                            <input
                                type="password"
                                className="config-input consulting-input"
                                placeholder="비밀번호 입력 (대소문자 구분 없음)"
                                value={consultingPassword}
                                onChange={(e) => setConsultingPassword(e.target.value)}
                            />
                            <button
                                className="save-btn consulting-switch-btn"
                                onClick={handleSwitchToConsulting}
                                disabled={!consultingPassword.trim() || isSwitchingMode}
                                type="button"
                            >
                                {isSwitchingMode ? '전환 중...' : '컨설팅 모드로 전환'}
                            </button>
                        </div>
                        {consultingError && <p className="consulting-error">{consultingError}</p>}
                        {consultingSuccess && <p className="consulting-success">컨설팅 모드로 전환되었습니다.</p>}
                        <p className="help-text">* 전환은 세션 연결 상태에서만 가능하며, 비밀번호 입력이 필요합니다.</p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">워크샵 모드 전환</label>
                        <div className="consulting-switch">
                            <button
                                className="save-btn consulting-switch-btn"
                                onClick={handleSwitchToWorkshop}
                                disabled={isSwitchingMode}
                                type="button"
                            >
                                {isSwitchingMode ? '전환 중...' : '워크샵 모드로 전환'}
                            </button>
                        </div>
                        {workshopError && <p className="consulting-error">{workshopError}</p>}
                        {workshopSuccess && <p className="consulting-success">워크샵 모드로 전환되었습니다.</p>}
                        <p className="help-text">* 전환은 세션 연결 상태에서만 가능합니다.</p>
                    </div>

                    {/* 세션 RAG 섹션 (벡터 임베딩 세션 공유) */}
                        <div className="academic-section session-rag-section">
                            <div className="academic-header">
                                <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Database size={16} color="#1b6d24" />
                                    세션 RAG 지식베이스
                                </label>
                                <span className="rag-doc-count">
                                    {sharedRagDocs.length}/20 문서
                                </span>
                            </div>

                            <div className="file-list">
                                {sharedRagDocs.length === 0 && (
                                    <p className="empty-rag-message">
                                        세션 RAG 문서가 없습니다. PDF를 업로드하면 이 세션을 다시 열 때마다 AI가 검색/인용에 사용할 수 있습니다.
                                    </p>
                                )}
                                {sharedRagDocs.map((doc) => (
                                    <div key={doc.docId} className="file-item">
                                        <div className="file-info" style={{ flex: 1 }}>
                                            <FileText size={14} color="#10b981" />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span className="file-name" title={doc.docName}>{doc.docName}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                                    {doc.uploaderName} · {doc.chunkCount}청크
                                                </span>
                                            </div>
                                        </div>
                                        {doc.uploaderId === currentUserId && (
                                            <button 
                                                className="remove-file-btn" 
                                                onClick={() => handleRemoveSharedRagDoc(doc.docId)}
                                                title="삭제"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <label className="upload-academic-btn" style={{ backgroundColor: '#10b981' }}>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={handleSharedRagUpload}
                                    disabled={isUploadingToShared}
                                />
                                {isUploadingToShared ? (
                                    <>
                                        <Loader2 size={16} className="spinner" /> 임베딩 생성 중...
                                    </>
                                ) : (
                                    <>
                                        <Share2 size={16} /> 세션에 PDF 업로드
                                    </>
                                )}
                            </label>
                            <p className="help-text session-rag-note">
                                업로드된 PDF의 벡터 임베딩은 세션에 저장됩니다. 삭제하지 않는 한 모든 참여자가 이후 접속에서도 활용할 수 있습니다.
                            </p>
                        </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn-text" onClick={onClose}>취소</button>
                    <button
                        className={`save-btn ${isSaved ? 'saved' : ''}`}
                        onClick={handleSave}
                        disabled={!apiKey.trim() || isSaved}
                    >
                        {isSaved ? (
                            <>
                                <CheckCircle2 size={18} /> 저장됨
                            </>
                        ) : (
                            <>
                                <Save size={18} /> 설정 저장
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIConfigModal;
