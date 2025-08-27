import React, { useState, useEffect } from 'react';
import { promptLoader } from '../utils/promptLoader';
import type { NoteData, ConnectionData } from '../types/culture';
import './PromptGenerator.css';

interface StepProps {
  stepNumber: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isCompleted: boolean;
}

const Step: React.FC<StepProps> = ({
  stepNumber,
  title,
  isOpen,
  onToggle,
  children,
  isCompleted,
}) => {
  return (
    <div className={`step ${isOpen ? 'open' : ''} ${isCompleted ? 'completed' : ''}`}>
      <div className="step-header" onClick={onToggle}>
        <div className="step-icon">
          <span className="step-number">{stepNumber + 1}</span>
        </div>
        <h3 className="step-title">{title}</h3>
        <div className="step-toggle">
          <span>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>
      {isOpen && <div className="step-content">{children}</div>}
    </div>
  );
};

interface PromptGeneratorProps {
  onGenerateMap: (data: { notes: NoteData[]; connections: ConnectionData[] }) => void;
  onClear: () => void;
}

const PromptGenerator: React.FC<PromptGeneratorProps> = ({
  onGenerateMap,
  onClear,
}) => {
  const [analysisInput, setAnalysisInput] = useState('');
  const [openStep, setOpenStep] = useState<number>(0);
  const [workshopPrompt, setWorkshopPrompt] = useState<string>('');
  const [step4a1Prompt, setStep4a1Prompt] = useState<string>('');
  const [step4a2Prompt, setStep4a2Prompt] = useState<string>('');

  useEffect(() => {
    // 모든 프롬프트 로드
    const loadPrompts = async () => {
      try {
        const [workshop, step4a1, step4a2] = await Promise.all([
          promptLoader.getPrompt('workshop'),
          promptLoader.getPrompt('step4a1_culture_diagnosis'),
          promptLoader.getPrompt('step4a2_theory_analysis')
        ]);
        setWorkshopPrompt(workshop);
        setStep4a1Prompt(step4a1);
        setStep4a2Prompt(step4a2);
      } catch (error) {
        console.error('프롬프트 로딩 실패:', error);
      }
    };
    loadPrompts();
  }, []);

  const handleCopyPrompt = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        alert(`${label} 프롬프트가 클립보드에 복사되었습니다!`);
      } else {
        // 폴백 방식
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`${label} 프롬프트가 클립보드에 복사되었습니다!`);
      }
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  const parseAIOutput = (text: string): { notes: NoteData[]; connections: ConnectionData[] } => {
    const notes: NoteData[] = [];
    const connections: ConnectionData[] = [];
    
    const lines = text.split('\n');
    let currentLayer = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 레이어 식별
      if (trimmed.includes('결과') || trimmed.includes('Results')) {
        currentLayer = 'results';
      } else if (trimmed.includes('행동') || trimmed.includes('Behaviors')) {
        currentLayer = 'behaviors';
      } else if (trimmed.includes('시스템') || trimmed.includes('Systems')) {
        currentLayer = 'enablers';
      } else if (trimmed.includes('정체성') || trimmed.includes('Identity')) {
        currentLayer = 'identity';
      }
      
      // 항목 추출
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
        const content = trimmed.substring(1).trim();
        if (content && content.length > 3) {
          notes.push({
            id: `note-${Date.now()}-${Math.random()}`,
            content,
            layer: currentLayer as any,
            x: Math.random() * 400 + 100,
            y: Math.random() * 300 + 100,
            isExpanded: false,
          });
        }
      }
    }
    
    return { notes, connections };
  };

  const handleShowReportClick = () => {
    if (!analysisInput.trim()) {
      alert('분석 결과 텍스트를 먼저 입력해주세요.');
      return;
    }
    
    try {
      const parsedData = parseAIOutput(analysisInput);
      if (parsedData.notes.length === 0) {
        alert('분석 결과에서 유효한 데이터를 찾을 수 없습니다.');
        return;
      }
      onGenerateMap(parsedData);
    } catch (error) {
      console.error('분석 결과 파싱 오류:', error);
      alert('분석 결과 처리 중 오류가 발생했습니다.');
    }
  };

  const isStep0Completed = !!analysisInput;

  return (
    <div className="prompt-generator">
      {/* 워크샵 모드 헤더 */}
      <div className="workshop-mode-header">
        <h2>📋 워크샵 분석 도구</h2>
        <p>포스트잇 기반 조직문화 분석 및 컬처맵 생성</p>
      </div>

      {/* AI 도구 툴바 */}
      <div className="ai-tools-toolbar">
        <h3>🤖 AI 도구 모음</h3>
        <div className="ai-tools-grid">
          <button
            onClick={() => window.open('https://chatgpt.com', '_blank')}
            className="btn-tool"
            title="ChatGPT - OpenAI의 대화형 AI"
          >
            <span className="tool-icon">🤖</span>
            <span className="tool-name">ChatGPT</span>
          </button>
          <button
            onClick={() => window.open('https://claude.ai', '_blank')}
            className="btn-tool"
            title="Claude - Anthropic의 고급 AI 어시스턴트"
          >
            <span className="tool-icon">🧠</span>
            <span className="tool-name">Claude</span>
          </button>
          <button
            onClick={() => window.open('https://gemini.google.com', '_blank')}
            className="btn-tool"
            title="Gemini - Google의 차세대 AI"
          >
            <span className="tool-icon">✨</span>
            <span className="tool-name">Gemini</span>
          </button>
          <button
            onClick={() => window.open('https://perplexity.ai', '_blank')}
            className="btn-tool"
            title="Perplexity - AI 기반 검색 엔진"
          >
            <span className="tool-icon">🔍</span>
            <span className="tool-name">Perplexity</span>
          </button>
          <button
            onClick={() => window.open('https://grok.x.ai', '_blank')}
            className="btn-tool"
            title="Grok - X의 실시간 정보 AI"
          >
            <span className="tool-icon">⚡</span>
            <span className="tool-name">Grok</span>
          </button>
          <button
            onClick={() => window.open('https://www.semanticscholar.org', '_blank')}
            className="btn-tool"
            title="Semantic Scholar - 학술 논문 검색"
          >
            <span className="tool-icon">📚</span>
            <span className="tool-name">Scholar</span>
          </button>
          <button
            onClick={() => window.open('https://consensus.app', '_blank')}
            className="btn-tool"
            title="Consensus - AI 기반 연구 논문 분석"
          >
            <span className="tool-icon">📊</span>
            <span className="tool-name">Consensus</span>
          </button>
          <button
            onClick={() => window.open('https://elicit.org', '_blank')}
            className="btn-tool"
            title="Elicit - 연구 논문 자동 요약"
          >
            <span className="tool-icon">🔬</span>
            <span className="tool-name">Elicit</span>
          </button>
        </div>
      </div>

      <div className="workshop-mode">
        <Step
          stepNumber={0}
          title="포스트잇 사진 분석"
          isOpen={openStep === 0}
          onToggle={() => setOpenStep(openStep === 0 ? -1 : 0)}
          isCompleted={isStep0Completed}
        >
          <p>워크샵에서 참여자들이 만든 <strong>결과-행동 포스트잇 사진</strong>을 AI에게 분석 요청하세요.</p>

          <div className="workshop-instructions">
            <h4>사용 방법</h4>
            <ol>
              <li>아래 프롬프트를 복사하세요</li>
              <li>AI 도구에서 프롬프트를 붙여넣으세요</li>
              <li>포스트잇 사진을 함께 첨부하세요</li>
              <li>AI가 생성한 결과를 다음 단계에서 사용하세요</li>
            </ol>
          </div>

          <button 
            onClick={() => handleCopyPrompt(workshopPrompt, '워크샵 분석')} 
            className="btn-primary"
          >
            📋 워크샵 분석 프롬프트 복사
          </button>
        </Step>

        <Step
          stepNumber={1}
          title="컬처 맵 그리기"
          isOpen={openStep === 1}
          onToggle={() => setOpenStep(openStep === 1 ? -1 : 1)}
          isCompleted={!!analysisInput}
        >
          <p>AI가 생성한 '분석 보고서' 텍스트 전체를 아래에 붙여넣고 '보고서 보기' 버튼을 누르세요.</p>
          
          <textarea
            value={analysisInput}
            onChange={e => setAnalysisInput(e.target.value)}
            placeholder="여기에 분석 보고서 텍스트를 붙여넣으세요..."
            rows={8}
            className="analysis-textarea"
          />
          
          <button 
            onClick={handleShowReportClick} 
            disabled={!analysisInput}
            className="btn-primary"
          >
            📊 컬처맵 생성하기
          </button>
        </Step>

        {/* 심화 분석 1: 인과관계 분석 */}
        <Step
          stepNumber={2}
          title="🔍 인과관계 분석"
          isOpen={openStep === 2}
          onToggle={() => setOpenStep(openStep === 2 ? -1 : 2)}
          isCompleted={false}
        >
          <p>생성된 컬처맵의 <strong>인과관계 구조</strong>를 심층 분석하여 조직문화 상태를 진단하세요.</p>
          
          <div className="analysis-features">
            <h4>✨ 주요 분석 항목</h4>
            <ul>
              <li>조직문화 상태를 한 문장으로 정의</li>
              <li>컬쳐맵 핵심 인과관계 Top 3 식별</li>
              <li>악순환/선순환 메커니즘 분석</li>
              <li>한국 조직문화 특성을 고려한 진단</li>
            </ul>
          </div>

          <button 
            onClick={() => handleCopyPrompt(step4a1Prompt, '인과관계 분석')} 
            className="btn-primary"
          >
            🔍 인과관계 분석 프롬프트 복사
          </button>
        </Step>

        {/* 심화 분석 2: 이론적 근거 분석 */}
        <Step
          stepNumber={3}
          title="📚 이론적 근거 분석"
          isOpen={openStep === 3}
          onToggle={() => setOpenStep(openStep === 3 ? -1 : 3)}
          isCompleted={false}
        >
          <p>컬처맵의 <strong>모든 유형/무형 요인에 적용된 이론</strong>을 완전 분석하여 학술적 타당성을 검증하세요.</p>
          
          <div className="analysis-features">
            <h4>✨ 주요 분석 항목</h4>
            <ul>
              <li>각 이론의 핵심 개념과 선정 근거</li>
              <li>조직 현실과 이론의 연관성 분석</li>
              <li>모든 이론 요소를 빠짐없이 해설</li>
              <li>구체적 발언 근거와 함께 검증</li>
            </ul>
          </div>

          <button 
            onClick={() => handleCopyPrompt(step4a2Prompt, '이론적 근거 분석')} 
            className="btn-primary"
          >
            📚 이론적 근거 분석 프롬프트 복사
          </button>
        </Step>

        {/* 이론적 배경 */}
        <Step
          stepNumber={4}
          title="📖 이론적 배경"
          isOpen={openStep === 4}
          onToggle={() => setOpenStep(openStep === 4 ? -1 : 4)}
          isCompleted={false}
        >
          <div className="theory-content">
            <h4>Dave Gray-Schein 4층위 모델</h4>
            <div className="theory-layers">
              <div className="layer">
                <strong>1층: 결과 (Results)</strong>
                <p>측정 가능한 성과, KPI, 고객만족도, 재무성과</p>
              </div>
              <div className="layer">
                <strong>2층: 행동 (Behaviors)</strong>
                <p>일상적 업무 행동, 의사결정 패턴, 상호작용 방식</p>
              </div>
              <div className="layer">
                <strong>3층: 시스템 (Systems)</strong>
                <p>유형적 요인: 조직구조, 프로세스, 정책, 보상시스템</p>
              </div>
              <div className="layer">
                <strong>4층: 정체성 (Identity)</strong>
                <p>무형적 요인: 신념, 가치관, 가정, 심리적 요인</p>
              </div>
            </div>
          </div>
        </Step>
      </div>
    </div>
  );
};

export default PromptGenerator;