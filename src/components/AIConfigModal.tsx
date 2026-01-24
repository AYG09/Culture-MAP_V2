import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Key, Info, CheckCircle2, BookOpen, Upload, Trash2, Loader2, FileText, Eye, EyeOff, Users } from 'lucide-react';
import { aiService, type AIProvider, type AIConfig, type FileMetadata } from '../services/AIService';
import type { AcademicFileMeta } from '../types/liveblocks';
import liveblocksService from '../services/LiveblocksService';
import './AIConfigModal.css';

interface AIConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose }) => {
    const currentConfig = aiService.getConfig();
    const provider: AIProvider = 'gemini';
    const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
    const [modelName, setModelName] = useState(currentConfig?.modelName || 'gemini-2.5-flash-lite');
    const [autoExecute, setAutoExecute] = useState(currentConfig?.autoExecuteFunctionCalls || false);
    const [sharedApiKeyMode, setSharedApiKeyMode] = useState(currentConfig?.sharedApiKeyMode || false);
    const [isSaved, setIsSaved] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [consultingPassword, setConsultingPassword] = useState('');
    const [consultingError, setConsultingError] = useState('');
    const [consultingSuccess, setConsultingSuccess] = useState(false);
    const [isSwitchingMode, setIsSwitchingMode] = useState(false);
    const [workshopError, setWorkshopError] = useState('');
    const [workshopSuccess, setWorkshopSuccess] = useState(false);

    const currentUserId = liveblocksService.getCurrentUserId();

    // 전문 지식 파일 상태
    const [academicFiles, setAcademicFiles] = useState<FileMetadata[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [sharedAcademicFiles, setSharedAcademicFiles] = useState<Record<string, AcademicFileMeta[]>>({});
    const [activeUserIds, setActiveUserIds] = useState<string[]>(() => [currentUserId]);
    const hasSharedForCurrentUser = !!sharedAcademicFiles[currentUserId]?.length;
    const activeUserIdSet = useMemo(() => new Set(activeUserIds), [activeUserIds]);
    const sharedAcademicEntries = Object.entries(sharedAcademicFiles).filter(
        ([userId, files]) => files.length > 0 && activeUserIdSet.has(userId)
    );

    useEffect(() => {
        if (!isOpen) return;

        const localFiles = aiService.getAcademicFiles();
        const sharedFiles = liveblocksService.getAcademicFilesByUser();

        setAcademicFiles(localFiles);
        setSharedAcademicFiles(sharedFiles);

        if (localFiles.length === 0 && sharedFiles[currentUserId]?.length) {
            liveblocksService.publishAcademicFiles([]);
        }
    }, [currentUserId, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = liveblocksService.onAcademicFiles((data) => {
            setSharedAcademicFiles(data);
        });
        return unsubscribe;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setActiveUserIds([currentUserId]);
        const unsubscribe = liveblocksService.onOthersPresence((others) => {
            const otherIds = others
                .map((entry) => entry.presence?.userId)
                .filter((id): id is string => typeof id === 'string' && id.length > 0);
            const nextIds = Array.from(new Set([currentUserId, ...otherIds]));
            setActiveUserIds(nextIds);
        });
        return unsubscribe;
    }, [currentUserId, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const newConfig: AIConfig = {
            provider,
            apiKey: apiKey.trim(),
            modelName: modelName.trim(),
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const supportedFiles = files.filter(file => file.type === 'application/pdf' || file.type.startsWith('image/'));
        if (supportedFiles.length === 0) {
            alert('PDF 또는 이미지 파일만 업로드 가능합니다.');
            e.target.value = '';
            return;
        }

        const pdfCount = academicFiles.filter(file => file.mimeType === 'application/pdf').length;
        const imageCount = academicFiles.filter(file => file.mimeType.startsWith('image/')).length;
        const remainingPdfSlots = Math.max(0, 10 - pdfCount);
        const remainingImageSlots = Math.max(0, 10 - imageCount);

        const pdfFiles = supportedFiles.filter(file => file.type === 'application/pdf');
        const imageFiles = supportedFiles.filter(file => file.type.startsWith('image/'));

        if (pdfFiles.length > remainingPdfSlots || imageFiles.length > remainingImageSlots) {
            alert(`PDF 최대 ${remainingPdfSlots}개, 이미지 최대 ${remainingImageSlots}개까지 업로드 가능합니다.`);
        }

        const filesToUpload = [
            ...pdfFiles.slice(0, remainingPdfSlots),
            ...imageFiles.slice(0, remainingImageSlots)
        ];

        if (filesToUpload.length === 0) {
            e.target.value = '';
            return;
        }

        try {
            setIsUploading(true);
            for (const file of filesToUpload) {
                await aiService.addAcademicFile(file);
            }
            const updatedFiles = [...aiService.getAcademicFiles()];
            setAcademicFiles(updatedFiles);
            const ownerId = liveblocksService.getCurrentUserId();
            const ownerName = liveblocksService.getCurrentUserDisplayName();
            const metaList: AcademicFileMeta[] = updatedFiles.map(file => ({
                name: file.name,
                displayName: file.displayName,
                mimeType: file.mimeType,
                keywords: file.keywords,
                uploadedAt: Date.now(),
                ownerId,
                ownerName,
            }));
            liveblocksService.publishAcademicFiles(metaList);
        } catch (error) {
            console.error('Failed to upload academic files:', error);
            alert('파일 업로드에 실패했습니다. API 키를 확인해주세요.');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveFile = (fileName: string) => {
        aiService.removeAcademicFile(fileName);
        const updatedFiles = [...aiService.getAcademicFiles()];
        setAcademicFiles(updatedFiles);
        const ownerId = liveblocksService.getCurrentUserId();
        const ownerName = liveblocksService.getCurrentUserDisplayName();
        const metaList: AcademicFileMeta[] = updatedFiles.map(file => ({
            name: file.name,
            displayName: file.displayName,
            mimeType: file.mimeType,
            keywords: file.keywords,
            uploadedAt: Date.now(),
            ownerId,
            ownerName,
        }));
        liveblocksService.publishAcademicFiles(metaList);
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

    const getModels = () => aiService.getAvailableGeminiModels();

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
                        <p className="help-text" style={{ color: '#10b981', fontWeight: 500, lineHeight: 1.5 }}>
                            {modelName.includes('gemini-3')
                                ? "✨ Gemini 3.0: thinkingLevel 기반 추론(자동 적용)"
                                : "⚙️ Gemini 2.5: thinkingBudget 기반 추론(자동 적용)"}
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

                    {/* 전문가 지식 베이스 섹션 */}
                    <div className="academic-section">
                            <div className="academic-header">
                                <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <BookOpen size={16} color="#3b82f6" />
                                    전문가 지식 베이스 (PDF/이미지)
                                </label>
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    PDF {academicFiles.filter(file => file.mimeType === 'application/pdf').length}/10 · 이미지 {academicFiles.filter(file => file.mimeType.startsWith('image/')).length}/10
                                </span>
                            </div>

                            <div className="file-list">
                                {academicFiles.length === 0 && hasSharedForCurrentUser && (
                                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', margin: '10px 0' }}>
                                        로컬 저장소가 초기화되어 전문 지식 베이스가 비어 있습니다. 세션 공유 목록은 메타데이터만 표시되며 실제 파일은 각 브라우저에만 저장됩니다. 필요하면 다시 업로드해 주세요.
                                    </p>
                                )}
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
                                    accept=".pdf,image/png,image/jpeg,image/webp"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                {isUploading ? (
                                    <>
                                        <Loader2 size={16} className="spinner" /> 업로드 중...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} /> 전문 PDF/이미지 추가 (마인드맵 포함)
                                    </>
                                )}
                            </label>
                            <p className="help-text" style={{ marginTop: '8px', color: '#6b7280' }}>
                                * PDF는 최대 10개, 이미지는 최대 10개까지 등록할 수 있습니다. 이미지 해상도는 3600x3600 이하만 지원됩니다.
                            </p>
                        </div>

                        <div className="academic-section" style={{ marginTop: '16px' }}>
                            <div className="academic-header">
                                <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Users size={16} color="#6366f1" />
                                    세션 공유 목록 (읽기 전용)
                                </label>
                            </div>

                            <div className="file-list">
                                {sharedAcademicEntries.length === 0 && (
                                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', margin: '10px 0' }}>
                                        공유된 지식 파일이 없습니다.
                                    </p>
                                )}
                                {sharedAcademicEntries.map(([userId, files]) => (
                                    <div key={userId} className="file-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            {files[0]?.ownerName || userId}의 업로드
                                        </div>
                                        {files.map((file) => (
                                            <div key={file.name} className="file-info" style={{ paddingLeft: '4px' }}>
                                                <FileText size={14} />
                                                <span className="file-name" title={file.displayName}>{file.displayName}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <p className="help-text" style={{ marginTop: '8px', color: '#6b7280' }}>
                                * 공유 목록은 메타데이터만 표시되며, 실제 파일 내용은 각 사용자 로컬에서만 사용됩니다.
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
