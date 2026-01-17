import React, { useState, useEffect } from 'react';
import { X, Save, Key, Info, CheckCircle2, BookOpen, Upload, Trash2, Loader2, FileText, Eye, EyeOff } from 'lucide-react';
import { aiService, type AIProvider, type AIConfig, type FileMetadata } from '../services/AIService';
import liveblocksService from '../services/LiveblocksService';
import './AIConfigModal.css';

interface AIConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose }) => {
    const currentConfig = aiService.getConfig();
    const [provider, setProvider] = useState<AIProvider>(currentConfig?.provider || 'gemini');
    const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
    const [modelName, setModelName] = useState(currentConfig?.modelName || (provider === 'gemini' ? 'gemini-2.5-flash-lite' : 'claude-sonnet-4-5-20250929'));
    const [autoExecute, setAutoExecute] = useState(currentConfig?.autoExecuteFunctionCalls || false);
    const [isSaved, setIsSaved] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [consultingPassword, setConsultingPassword] = useState('');
    const [consultingError, setConsultingError] = useState('');
    const [consultingSuccess, setConsultingSuccess] = useState(false);
    const [isSwitchingMode, setIsSwitchingMode] = useState(false);

    // 전문 지식 파일 상태
    const [academicFiles, setAcademicFiles] = useState<FileMetadata[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAcademicFiles(aiService.getAcademicFiles());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const newConfig: AIConfig = {
            provider,
            apiKey: apiKey.trim(),
            modelName: modelName.trim(),
            autoExecuteFunctionCalls: autoExecute
        };
        aiService.setConfig(newConfig);
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            onClose();
        }, 1500);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('PDF 파일만 업로드 가능합니다.');
            return;
        }

        try {
            setIsUploading(true);
            await aiService.addAcademicFile(file);
            setAcademicFiles([...aiService.getAcademicFiles()]);
        } catch (error) {
            console.error('Failed to upload academic file:', error);
            alert('파일 업로드에 실패했습니다. API 키를 확인해주세요.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveFile = (fileName: string) => {
        aiService.removeAcademicFile(fileName);
        setAcademicFiles([...aiService.getAcademicFiles()]);
    };

    const handleSwitchToConsulting = async () => {
        setConsultingError('');
        setConsultingSuccess(false);

        const session = liveblocksService.getCurrentSession();
        if (!session) {
            setConsultingError('세션에 연결된 상태에서만 전환할 수 있습니다.');
            return;
        }

        if (!session.isHost) {
            setConsultingError('호스트만 컨설팅 모드로 전환할 수 있습니다.');
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

    const getModels = () => {
        if (provider === 'gemini') {
            return aiService.getAvailableGeminiModels();
        }
        return aiService.getAvailableClaudeModels();
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
                        <p>입력하신 API 키는 브라우저의 로컬 저장소에만 보관되며, 서버로 전송되지 않습니다.</p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">제공자 선택</label>
                        <div className="provider-tabs">
                            <button
                                className={`provider-tab ${provider === 'gemini' ? 'active' : ''}`}
                                onClick={() => {
                                    setProvider('gemini');
                                    setModelName('gemini-2.5-flash-lite');
                                }}
                            >
                                Google Gemini
                            </button>
                            <button
                                className={`provider-tab ${provider === 'claude' ? 'active' : ''}`}
                                onClick={() => {
                                    setProvider('claude');
                                    setModelName('claude-sonnet-4-5-20250929');
                                }}
                            >
                                Anthropic Claude
                            </button>
                        </div>
                    </div>

                    <div className="config-section">
                        <label className="section-label">API 키</label>
                        <div className="input-with-action">
                            <input
                                type={showKey ? "text" : "password"}
                                className="config-input"
                                placeholder={`${provider === 'gemini' ? 'Gemini' : 'Claude'} API 키를 입력하세요`}
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
                            {provider === 'gemini' ? (
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                                    Google AI Studio에서 키 발급받기 ↗
                                </a>
                            ) : (
                                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                                    Anthropic Console에서 키 발급받기 ↗
                                </a>
                            )}
                        </p>
                    </div>

                    <div className="config-section">
                        <label className="section-label">모델 선택</label>
                        <select
                            className="config-select"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        >
                            {getModels().map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        {provider === 'gemini' && (
                            <p className="help-text" style={{ color: '#10b981', fontWeight: 500, lineHeight: 1.5 }}>
                                {modelName.includes('gemini-3')
                                    ? "✨ Gemini 3.0: thinkingLevel 기반 추론(자동 적용)"
                                    : "⚙️ Gemini 2.5: thinkingBudget 기반 추론(자동 적용)"}
                            </p>
                        )}
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
                        <p className="help-text">* 전환은 호스트만 가능하며, 비밀번호 입력이 필요합니다.</p>
                    </div>

                    {/* 전문가 지식 베이스 섹션 (Gemini 전용) */}
                    {provider === 'gemini' && (
                        <div className="academic-section">
                            <div className="academic-header">
                                <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <BookOpen size={16} color="#3b82f6" />
                                    전문가 지식 베이스 (PDF)
                                </label>
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{academicFiles.length}/10개</span>
                            </div>

                            <div className="file-list">
                                {academicFiles.map((file, idx) => (
                                    <div key={idx} className="file-item">
                                        <div className="file-info">
                                            <FileText size={14} />
                                            <span className="file-name" title={file.displayName || file.name}>
                                                {file.displayName || file.name.replace('files/', '')}
                                            </span>
                                        </div>
                                        <button className="remove-file-btn" onClick={() => handleRemoveFile(file.name)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {academicFiles.length === 0 && (
                                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', margin: '10px 0' }}>
                                        등록된 지식 파일이 없습니다.
                                    </p>
                                )}
                            </div>

                            <label className="upload-academic-btn">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                    disabled={isUploading || academicFiles.length >= 10}
                                />
                                {isUploading ? (
                                    <>
                                        <Loader2 size={16} className="spinner" /> 업로드 중...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} /> 전문 PDF 추가 (에드가 샤인 등)
                                    </>
                                )}
                            </label>
                            <p className="help-text" style={{ marginTop: '8px', color: '#6b7280' }}>
                                * 업로드된 서적은 대화 시 AI의 핵심 지식으로 활용됩니다.
                            </p>
                        </div>
                    )}
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
