import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Upload, X, Copy, SendHorizontal, Play, AlertTriangle, ClipboardList, Map, Search } from 'lucide-react';
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

export interface ConsultingRecentOutput {
    id: string;
    label: string;
    content: string;
    timestamp: number;
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
    recentOutputs?: ConsultingRecentOutput[];
}

interface PreparedStep {
    step: ConsultingStep;
    prompt: string;
}

type StepInputKey = 'step1Analysis' | 'step2CultureMap';

const STEP_INPUT_LABELS: Record<StepInputKey, string> = {
    step1Analysis: 'Step 1 1차 분석 결과',
    step2CultureMap: 'Step 2 컬쳐맵 생성 결과',
};

const STEP_INPUT_PLACEHOLDERS: Record<StepInputKey, string> = {
    step1Analysis: '외부 LLM 또는 이 앱에서 생성한 1차 분석 결과를 붙여넣으세요.',
    step2CultureMap: 'Step 2에서 생성된 [결과], [행동], [유형_레버], [무형_레버], [연결] 형식의 컬쳐맵 텍스트를 붙여넣으세요.',
};

const getStepStage = (stepId: string) => {
    if (stepId === 'step2') return 'source-analysis';
    if (stepId === 'step3') return 'culture-map';
    return 'diagnosis-strategy';
};

const isDiagnosisStep = (stepId: string) => stepId.startsWith('step4');

const ConsultingToolsPanel: React.FC<ConsultingToolsPanelProps> = ({ onFillInput, onRunAnalysis, recentOutputs = [] }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const [preparedStep, setPreparedStep] = useState<PreparedStep | null>(null);
    const [materials, setMaterials] = useState<ConsultingMaterial[]>([]);
    const [copyStatus, setCopyStatus] = useState<'base' | 'full' | null>(null);
    const [validationWarning, setValidationWarning] = useState<string | null>(null);
    const [materialError, setMaterialError] = useState<string | null>(null);
    const [stepInputs, setStepInputs] = useState<Record<StepInputKey, string>>({
        step1Analysis: '',
        step2CultureMap: '',
    });
    const [showSourceMaterials, setShowSourceMaterials] = useState(false);
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
            setValidationWarning(null);
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

    const clearAllMaterials = () => {
        setMaterials([]);
        setMaterialError(null);
    };

    const handleCopyPrompt = async () => {
        if (!preparedStep) return;
        await copyText(preparedStep.prompt, 'base');
    };

    const handleCopyFullPrompt = async () => {
        if (!preparedStep) return;
        const validation = validatePreparedInputs(preparedStep.step.id);
        if (validation) {
            setValidationWarning(validation);
            return;
        }
        await copyText(buildFullPrompt(preparedStep), 'full');
    };

    const copyText = async (text: string, status: 'base' | 'full') => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // 클립보드 API 미지원 환경 — 선택 fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopyStatus(status);
        setTimeout(() => setCopyStatus(null), 2500);
    };

    const handleFillInput = () => {
        if (!preparedStep) return;
        const promptForInput = validatePreparedInputs(preparedStep.step.id)
            ? preparedStep.prompt
            : buildFullPrompt(preparedStep);
        onFillInput(promptForInput, `${preparedStep.step.name}: ${preparedStep.step.description}`);
        setPreparedStep(null);
    };

    const handleRunAnalysis = () => {
        if (!preparedStep) return;
        const validation = validatePreparedInputs(preparedStep.step.id);
        if (validation) {
            setValidationWarning(validation);
            return;
        }
        setValidationWarning(null);
        onRunAnalysis(preparedStep.prompt, `${preparedStep.step.name}: ${preparedStep.step.description}`, buildAnalysisMaterials(preparedStep.step.id));
        setPreparedStep(null);
    };

    const formatBytes = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`;

    const updateStepInput = (key: StepInputKey, value: string) => {
        setStepInputs(prev => ({ ...prev, [key]: value }));
        setValidationWarning(null);
    };

    const useRecentOutput = (key: StepInputKey, outputId: string) => {
        const output = recentOutputs.find(item => item.id === outputId);
        if (!output) return;
        updateStepInput(key, output.content);
    };

    const getRequiredInputKeys = (stepId: string): StepInputKey[] => {
        if (stepId === 'step3') return ['step1Analysis'];
        if (isDiagnosisStep(stepId)) return ['step1Analysis', 'step2CultureMap'];
        return [];
    };

    const validatePreparedInputs = (stepId: string): string | null => {
        if (stepId === 'step2' && materials.filter(m => m.selected).length === 0) {
            return '분석에 사용할 원천자료를 먼저 선택해주세요.';
        }
        if (stepId === 'step3' && !stepInputs.step1Analysis.trim()) {
            return 'Step 1의 1차 분석 결과를 먼저 입력해주세요.';
        }
        if (isDiagnosisStep(stepId)) {
            if (!stepInputs.step1Analysis.trim()) return 'Step 1의 1차 분석 결과를 먼저 입력해주세요.';
            if (!stepInputs.step2CultureMap.trim()) return 'Step 2의 컬쳐맵 생성 결과를 먼저 입력해주세요.';
        }
        return null;
    };

    const createSyntheticMaterial = (name: string, content: string): ConsultingMaterial => ({
        id: `source-${name}`,
        name,
        type: 'text/plain',
        size: new Blob([content]).size,
        addedAt: Date.now(),
        selected: true,
        content,
    });

    const buildAnalysisMaterials = (stepId: string): ConsultingMaterial[] => {
        if (stepId === 'step2') {
            return materials.filter(m => m.selected);
        }

        const sourceMaterials: ConsultingMaterial[] = [];
        if (stepId === 'step3') {
            sourceMaterials.push(createSyntheticMaterial(STEP_INPUT_LABELS.step1Analysis, stepInputs.step1Analysis));
        }

        if (isDiagnosisStep(stepId)) {
            sourceMaterials.push(
                createSyntheticMaterial(STEP_INPUT_LABELS.step1Analysis, stepInputs.step1Analysis),
                createSyntheticMaterial(STEP_INPUT_LABELS.step2CultureMap, stepInputs.step2CultureMap)
            );
            sourceMaterials.push(...materials.filter(m => m.selected).map(m => ({
                ...m,
                name: `원천자료 참고: ${m.name}`,
            })));
        }

        return sourceMaterials;
    };

    const buildFullPrompt = (prepared: PreparedStep): string => {
        const materialsForPrompt = buildAnalysisMaterials(prepared.step.id);
        const sourceText = materialsForPrompt
            .map(m => `[입력 소스: ${m.name}]\n${m.content}`)
            .join('\n\n---\n\n');

        return sourceText
            ? `${sourceText}\n\n---\n\n[실행 프롬프트]\n${prepared.prompt}`
            : prepared.prompt;
    };

    const getStageInfo = (stepId: string) => {
        const stage = getStepStage(stepId);
        if (stage === 'source-analysis') {
            return {
                icon: <ClipboardList size={15} />,
                title: '원천자료를 바탕으로 1차 분석을 실행합니다.',
                body: '회의록, 인터뷰 기록, 전사본 등 원천자료를 선택한 뒤 실행하세요.',
            };
        }
        if (stage === 'culture-map') {
            return {
                icon: <Map size={15} />,
                title: 'Step 1의 1차 분석 결과를 컬쳐맵 텍스트로 변환합니다.',
                body: '외부 LLM 결과는 붙여넣고, 이 앱에서 실행한 결과는 최근 AI 답변에서 가져올 수 있습니다.',
            };
        }
        return {
            icon: <Search size={15} />,
            title: 'Step 1 분석 결과와 Step 2 컬쳐맵 결과를 함께 사용합니다.',
            body: '원천자료도 참고자료로 선택해 함께 확인할 수 있습니다.',
        };
    };

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
                  {/* 콘텐츠 영역 — chat-content 스크롤로 자연 접근 */}
                  <div className="prep-body">
                    <div className="prep-panel-header">
                        <div className="prep-title-block">
                            <span className="prep-step-name">{preparedStep.step.name}: {preparedStep.step.description}</span>
                            <span className="prep-step-guide">
                                {getStageInfo(preparedStep.step.id).icon}
                                {getStageInfo(preparedStep.step.id).title}
                            </span>
                        </div>
                        <button className="prep-close-btn" onClick={() => setPreparedStep(null)} aria-label="닫기">
                            <X size={14} />
                        </button>
                    </div>
                    <p className="prep-stage-desc">{getStageInfo(preparedStep.step.id).body}</p>

                    {getRequiredInputKeys(preparedStep.step.id).length > 0 && (
                        <div className="source-inputs-section">
                            {getRequiredInputKeys(preparedStep.step.id).map((key) => (
                                <div key={key} className="source-input-card">
                                    <div className="source-input-header">
                                        <span>{STEP_INPUT_LABELS[key]}</span>
                                        {recentOutputs.length > 0 && (
                                            <select
                                                className="recent-output-select"
                                                value=""
                                                onChange={(event) => useRecentOutput(key, event.target.value)}
                                                aria-label={`${STEP_INPUT_LABELS[key]} 최근 AI 답변 선택`}
                                            >
                                                <option value="" disabled>최근 AI 답변 사용</option>
                                                {recentOutputs.map(output => (
                                                    <option key={`${key}-${output.id}`} value={output.id}>
                                                        {output.label}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <textarea
                                        className={`source-textarea${key === 'step2CultureMap' ? ' culture-map-input' : ''}`}
                                        aria-label={STEP_INPUT_LABELS[key]}
                                        value={stepInputs[key]}
                                        onChange={(event) => updateStepInput(key, event.target.value)}
                                        placeholder={STEP_INPUT_PLACEHOLDERS[key]}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {(preparedStep.step.id === 'step2' || isDiagnosisStep(preparedStep.step.id)) && (
                        <div className={`materials-section ${isDiagnosisStep(preparedStep.step.id) ? 'reference-mode' : ''}`}>
                            <div className="materials-header">
                                <span className="materials-title">
                                    {preparedStep.step.id === 'step2' ? '📁 분석 자료함' : '📁 원천자료 참고'}
                                </span>
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
                                <>
                                    {isDiagnosisStep(preparedStep.step.id) && (
                                        <button
                                            className="source-toggle-btn"
                                            type="button"
                                            onClick={() => setShowSourceMaterials(prev => !prev)}
                                        >
                                            {showSourceMaterials ? '원천자료 목록 접기' : `원천자료 ${materials.length}개 보기`}
                                        </button>
                                    )}
                                    {(!isDiagnosisStep(preparedStep.step.id) || showSourceMaterials) && (
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
                                </>
                            )}

                            <p className="materials-notice">
                                자료는 내 PC에만 보관됩니다. {preparedStep.step.id === 'step2' ? '분석 실행 시 선택한 자료만 AI에 전달됩니다.' : 'Step 3 실행 시 선택한 원천자료는 참고 근거로 함께 전달됩니다.'}
                            </p>
                            {materialError && (
                                <p className="materials-error">
                                    {materialError}
                                </p>
                            )}
                        </div>
                    )}

                    {/* 경고 */}
                    {validationWarning && (
                        <div className="no-materials-warning">
                            <AlertTriangle size={13} />
                            {validationWarning}
                        </div>
                    )}

                  </div>{/* /prep-body */}

                  {/* 액션 버튼 — 패널 하단 일반 영역 */}
                  <div className="prep-actions">
                      <button className="prep-btn copy-btn" onClick={handleCopyPrompt} title="외부 AI 도구에서 사용할 프롬프트 복사">
                          <Copy size={13} />
                          {copyStatus === 'base' ? '복사됨!' : '프롬프트만 복사'}
                      </button>
                      <button className="prep-btn copy-full-btn" onClick={handleCopyFullPrompt} title="입력한 단계 결과와 프롬프트를 함께 복사">
                          <Copy size={13} />
                          {copyStatus === 'full' ? '복사됨!' : '소스 포함 복사'}
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
                      {copyStatus && (
                          <p className="copy-success-msg">
                              {copyStatus === 'base'
                                  ? '프롬프트가 복사되었습니다. 외부 AI 도구에서 필요한 자료를 먼저 업로드하거나 결과를 붙여넣은 뒤 사용하세요.'
                                  : '입력한 소스와 프롬프트가 함께 복사되었습니다. 외부 AI 도구에 바로 붙여넣어 사용할 수 있습니다.'}
                          </p>
                      )}
                  </div>
                </div>
            )}

            <div className="consulting-tools-hint">
                카드를 선택한 뒤 자료를 확인하고 실행하거나 프롬프트를 복사할 수 있습니다.
            </div>
        </div>
    );
};

export default ConsultingToolsPanel;
