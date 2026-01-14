import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react';
import './ConsultingToolsPanel.css';

interface ConsultingStep {
    id: string;
    name: string;
    description: string;
    file: string;
    subSteps?: ConsultingStep[];
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

interface ConsultingToolsPanelProps {
    onSelectPrompt: (prompt: string, stepName: string) => void;
}

const ConsultingToolsPanel: React.FC<ConsultingToolsPanelProps> = ({ onSelectPrompt }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);

    const loadPrompt = async (step: ConsultingStep) => {
        if (!step.file) return;

        setIsLoading(step.id);
        try {
            const response = await fetch(`/prompts/${step.file}`);
            if (!response.ok) throw new Error('프롬프트 로드 실패');
            const promptText = await response.text();
            onSelectPrompt(promptText, `${step.name}: ${step.description}`);
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
                <button className="collapse-btn" onClick={() => setIsCollapsed(true)}>
                    <ChevronUp size={14} />
                </button>
            </div>

            <div className="consulting-steps-grid">
                {CONSULTING_STEPS.map((step) => (
                    <div key={step.id} className="step-wrapper">
                        <button
                            className={`step-card ${expandedStep === step.id ? 'expanded' : ''} ${isLoading === step.id ? 'loading' : ''}`}
                            onClick={() => handleStepClick(step)}
                            disabled={isLoading !== null}
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

            <div className="consulting-tools-hint">
                카드를 클릭하면 해당 분석 프롬프트가 AI에게 전송됩니다.
            </div>
        </div>
    );
};

export default ConsultingToolsPanel;
