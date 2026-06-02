import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Upload, X, Copy, SendHorizontal, Play, AlertTriangle } from 'lucide-react';
import documentService from '../services/DocumentService';
import './ConsultingToolsPanel.css';

interface ConsultingStep {
    id: string;
    name: string;
    description: string;
    file: string;
    subSteps?: ConsultingStep[];
}

export interface ConsultingMaterial {
    id: string;
    name: string;
    type: string;
    size: number;
    addedAt: number;
    selected: boolean;
    content: string;
}

const CONSULTING_STEPS: ConsultingStep[] = [
    { id: 'step2', name: 'Step 1', description: '1차 분석', file: 'step2.md' },
    { id: 'step3', name: 'Step 2', description: '컬쳐맵 생성', file: 'step3.md' },
    {
        id: 'step4',
        name: 'Step 3',
        description: '진단·전략',
        file: '',
        subSteps: [
            { id: 'step4a1', name: '3a-1', description: '문화 상태 정의', file: 'step4a1_culture_diagnosis.md' },
            { id: 'step4a2', name: '3a-2', description: '이론 해설', file: 'step4a2_theory_analysis.md' },
            { id: 'step4a3', name: '3a-3', description: '인지편향 분석', file: 'step4a3_bias_analysis.md' },
            { id: 'step4b', name: '3b', description: '실행 전략', file: 'step4b_claude_strategy.md' },
        ]
    },
];

const SUPPORTED_TYPES = ['.txt', '.md', '.pdf', '.json'];

interface ConsultingToolsPanelProps {
    onFillInput: (prompt: string, stepName: string) => void;
    onRunAnalysis: (prompt: string, stepName: string, materials: ConsultingMaterial[]) => void;
}

interface PreparedStep {
    step: ConsultingStep;
    prompt: string;
}

const ConsultingToolsPanel: React.FC<ConsultingToolsPanelProps> = ({ onFillInput, onRunAnalysis }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const [preparedStep, setPreparedStep] = useState<PreparedStep | null>(null);
    const [materials, setMaterials] = useState<ConsultingMaterial[]>([]);
    const [copySuccess, setCopySuccess] = useState(false);
    const [noMaterialsWarning, setNoMaterialsWarning] = useState(false);
    const [materialError, setMaterialError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadPrompt = async (step: ConsultingStep) => {
        if (!step.file) return;
        setIsLoading(step.id);
        setExpandedStep(null);
        try {
            const response = await fetch(`/prompts/${step.file}`);
            if (!response.ok) throw new Error('프롬프트 로드 실패');
            const promptText = await response.text();
            setPreparedStep({ step, prompt: promptText });
        } catch (error) {
            console.error('프롬프트 로드 오류:', error);
        } finally {
            setIsLoading(null);
        }
    };

    const handleStepClick = (step: ConsultingStep) => {
        if (step.subSteps) {
            setExpandedStep(expandedStep === step.id ? null : step.id);
        } else {
            loadPrompt(step);
        }
    };

    const readMaterialContent = async (file: File): Promise<string> => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            const extracted = await documentService.extractTextFromPDF(file);
            const trimmed = extracted.trim();
            if (!trimmed) {
                throw new Error('PDF에서 읽을 수 있는 텍스트를 찾지 못했습니다.');
            }
            return trimmed;
        }

        return file.text();
    };

    const handleAddMaterials = async (files: FileList | null) => {
        if (!files) return;
        const newMaterials: ConsultingMaterial[] = [];
        const failedFiles: string[] = [];

        for (const [index, file] of Array.from(files).entries()) {
            try {
                const content = await readMaterialContent(file);
                newMaterials.push({
                    id: `${Date.now()}-${index}-${file.name}-${file.size}-${file.lastModified}`,
                    name: file.name,
                    type: file.type || 'text/plain',
                    size: file.size,
                    addedAt: Date.now(),
                    selected: true,
                    content,
                });
            } catch {
                console.warn('파일 읽기 실패:', file.name);
                failedFiles.push(file.name);
            }
        }

        setMaterials(prev => [...prev, ...newMaterials]);
        setMaterialError(
            failedFiles.length > 0
                ? `읽지 못한 자료가 있습니다: ${failedFiles.join(', ')}`
                : null
        );
    };

    const toggleMaterial = (id: string) => {
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
    };

    const removeMaterial = (id: string) => {
        setMaterials(prev => prev.filter(m => m.id !== id));
    };

    const clearAllMaterials = () => setMaterials([]);

    const handleCopyPrompt = async () => {
        if (!preparedStep) return;
        try {
            await navigator.clipboard.writeText(preparedStep.prompt);
        } catch {
            // 클립보드 API 미지원 환경 — 선택 fallback
            const ta = document.createElement('textarea');
            ta.value = preparedStep.prompt;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
    };

    const handleFillInput = () => {
        if (!preparedStep) return;
        onFillInput(preparedStep.prompt, `${preparedStep.step.name}: ${preparedStep.step.description}`);
        setPreparedStep(null);
    };

    const handleRunAnalysis = () => {
        if (!preparedStep) return;
        const selected = materials.filter(m => m.selected);
        if (selected.length === 0) {
            setNoMaterialsWarning(true);
            setTimeout(() => setNoMaterialsWarning(false), 3000);
            return;
        }
        setNoMaterialsWarning(false);
        onRunAnalysis(preparedStep.prompt, `${preparedStep.step.name}: ${preparedStep.step.description}`, selected);
        setPreparedStep(null);
    };

    const formatBytes = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`;

    if (isCollapsed) {
        return (
            <div className="consulting-tools-collapsed" onClick={() => setIsCollapsed(false)}>
                <FileText size={14} />
                <span>컨설팅 분석 도구</span>
                <ChevronDown size={14} />
            </div>
        );
    }

    return (
        <div className="consulting-tools-panel">
            <div className="consulting-tools-header">
                <div className="header-title">
                    <FileText size={14} />
                    <span>📊 컨설팅 분석 도구</span>
                </div>
                <button className="collapse-btn" onClick={() => setIsCollapsed(true)} aria-label="패널 접기">
                    <ChevronUp size={14} />
                </button>
            </div>

            {/* 분석 단계 카드 */}
            <div className="consulting-steps-grid">
                {CONSULTING_STEPS.map((step) => (
                    <div key={step.id} className="step-wrapper">
                        <button
                            className={`step-card ${expandedStep === step.id ? 'expanded' : ''} ${isLoading === step.id ? 'loading' : ''} ${preparedStep?.step.id === step.id ? 'selected' : ''}`}
                            onClick={() => handleStepClick(step)}
                            disabled={isLoading !== null}
                            aria-label={`${step.name} ${step.description} 선택`}
                        >
                            {isLoading === step.id ? (
                                <Loader2 size={16} className="spinner" />
                            ) : (
                                <>
                                    <span className="step-name">{step.name}</span>
                                    <span className="step-desc">{step.description}</span>
                                    {step.subSteps && <ChevronDown size={12} className="expand-icon" />}
                                </>
                            )}
                        </button>

                        {step.subSteps && expandedStep === step.id && (
                            <div className="sub-steps">
                                {step.subSteps.map((subStep) => (
                                    <button
                                        key={subStep.id}
                                        className={`sub-step-btn ${isLoading === subStep.id ? 'loading' : ''}`}
                                        onClick={() => loadPrompt(subStep)}
                                        disabled={isLoading !== null}
                                    >
                                        {isLoading === subStep.id ? (
                                            <Loader2 size={12} className="spinner" />
                                        ) : (
                                            <>
                                                <span className="sub-step-name">{subStep.name}</span>
                                                <span className="sub-step-desc">{subStep.description}</span>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 분석 준비 패널 */}
            {preparedStep && (
                <div className="prep-panel">
                    <div className="prep-panel-header">
                        <span className="prep-step-name">{preparedStep.step.name}: {preparedStep.step.description}</span>
                        <button className="prep-close-btn" onClick={() => setPreparedStep(null)} aria-label="닫기">
                            <X size={14} />
                        </button>
                    </div>

                    {/* 분석 자료함 */}
                    <div className="materials-section">
                        <div className="materials-header">
                            <span className="materials-title">📁 분석 자료함</span>
                            <div className="materials-actions">
                                <button
                                    className="materials-add-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    title={`지원 형식: ${SUPPORTED_TYPES.join(', ')}`}
                                >
                                    <Upload size={12} />
                                    자료 추가
                                </button>
                                {materials.length > 0 && (
                                    <button className="materials-clear-btn" onClick={clearAllMaterials}>
                                        모든 자료 비우기
                                    </button>
                                )}
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".txt,.md,.pdf,.json"
                            style={{ display: 'none' }}
                            onChange={e => handleAddMaterials(e.target.files)}
                        />

                        {materials.length === 0 ? (
                            <p className="materials-empty">
                                회의록, 인터뷰 기록, 전사본 등 분석 대상 자료를 추가하세요.
                            </p>
                        ) : (
                            <ul className="materials-list">
                                {materials.map(m => (
                                    <li key={m.id} className={`material-item ${m.selected ? 'selected' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={m.selected}
                                            onChange={() => toggleMaterial(m.id)}
                                            aria-label={`${m.name} 선택`}
                                        />
                                        <span className="material-name" title={m.name}>{m.name}</span>
                                        <span className="material-size">{formatBytes(m.size)}</span>
                                        <button
                                            className="material-remove-btn"
                                            onClick={() => removeMaterial(m.id)}
                                            aria-label={`${m.name} 제거`}
                                        >
                                            <X size={11} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <p className="materials-notice">
                            자료는 내 PC에만 보관됩니다. 분석 실행 시 선택한 자료만 AI에 전달됩니다.
                        </p>
                        {materialError && (
                            <p className="materials-error">
                                {materialError}
                            </p>
                        )}
                    </div>

                    {/* 경고 */}
                    {noMaterialsWarning && (
                        <div className="no-materials-warning">
                            <AlertTriangle size={13} />
                            분석에 사용할 자료를 먼저 선택해주세요.
                        </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="prep-actions">
                        <button className="prep-btn copy-btn" onClick={handleCopyPrompt} title="외부 AI 도구에서 사용할 프롬프트 복사">
                            <Copy size={13} />
                            {copySuccess ? '복사됨!' : '프롬프트만 복사'}
                        </button>
                        <button className="prep-btn fill-btn" onClick={handleFillInput} title="채팅 입력창에 프롬프트를 넣습니다. 전송되지 않습니다.">
                            <SendHorizontal size={13} />
                            채팅 입력창에 넣기
                        </button>
                        <button
                            className="prep-btn run-btn"
                            onClick={handleRunAnalysis}
                            title={materials.filter(m => m.selected).length === 0 ? '자료를 먼저 선택해주세요' : '선택한 자료로 분석 실행'}
                        >
                            <Play size={13} />
                            선택한 자료로 분석 실행
                        </button>
                    </div>

                    {copySuccess && (
                        <p className="copy-success-msg">
                            프롬프트가 복사되었습니다. 외부 AI 도구에서 자료를 먼저 업로드한 뒤 붙여넣어 사용하세요.
                        </p>
                    )}
                </div>
            )}

            <div className="consulting-tools-hint">
                카드를 선택한 뒤 자료를 확인하고 실행하거나 프롬프트를 복사할 수 있습니다.
            </div>
        </div>
    );
};

export default ConsultingToolsPanel;
