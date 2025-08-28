import React, { useState, useEffect } from 'react';
import { promptLoader } from '../utils/promptLoader';
import { parseAIOutput } from '../utils/parser';
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
  onShowReport: (report: string) => void;
}

const PromptGenerator: React.FC<PromptGeneratorProps> = ({ onGenerateMap, onShowReport }) => {
  const [analysisInput, setAnalysisInput] = useState('');
  const [openStep, setOpenStep] = useState<number>(0);
  const [workshopPrompt, setWorkshopPrompt] = useState<string>('');
  const [comprehensiveAnalysisPrompt, setComprehensiveAnalysisPrompt] = useState<string>('');

  useEffect(() => {
    // 모든 프롬프트 로드
    const loadPrompts = async () => {
      try {
        const [workshopResult, comprehensiveResult] = await Promise.all([
          promptLoader.loadPrompt('workshop'),
          promptLoader.loadPrompt('comprehensive_analysis'),
        ]);

        // loadPrompt는 PromptLoadResult 객체를 반환하므로 content 속성에 접근
        setWorkshopPrompt(workshopResult.content || '프롬프트를 불러올 수 없습니다.');
        setComprehensiveAnalysisPrompt(
          comprehensiveResult.content || '프롬프트를 불러올 수 없습니다.'
        );

        // 로딩 결과 로그
        console.log('워크샵 프롬프트 로딩:', workshopResult.success ? '성공' : '실패');
        console.log('종합 분석 프롬프트 로딩:', comprehensiveResult.success ? '성공' : '실패');
      } catch (error) {
        console.error('프롬프트 로딩 실패:', error);
        setWorkshopPrompt('프롬프트 로딩 중 오류가 발생했습니다.');
        setComprehensiveAnalysisPrompt('프롬프트 로딩 중 오류가 발생했습니다.');
      }
    };
    loadPrompts();
  }, []);

  const handleCopyPrompt = async (text: string, label: string) => {
    // 프롬프트 텍스트가 비어있는지 확인
    if (!text || text.trim().length === 0) {
      alert('복사할 프롬프트 내용이 없습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      // 최신 Clipboard API 사용 (HTTPS에서만 작동)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        console.log('클립보드 복사 성공 (Clipboard API):', text.substring(0, 100));
        alert(`${label} 프롬프트가 클립보드에 복사되었습니다!`);
      } else {
        // 폴백 방식 (HTTP에서도 작동)
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          console.log('클립보드 복사 성공 (execCommand):', text.substring(0, 100));
          alert(`${label} 프롬프트가 클립보드에 복사되었습니다!`);
        } else {
          throw new Error('execCommand 복사 실패');
        }
      }
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      console.log('복사 시도한 텍스트 길이:', text.length);

      // 수동 복사 옵션 제공
      const shouldShowText = confirm('클립보드 복사에 실패했습니다. 텍스트를 직접 보여드릴까요?');
      if (shouldShowText) {
        // 새 창에서 텍스트 표시
        const newWindow = window.open('', '_blank', 'width=800,height=600');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>${label} 프롬프트</title></head>
              <body style="font-family: monospace; padding: 20px; white-space: pre-wrap;">
                <h3>${label} 프롬프트</h3>
                <p style="color: #666; margin-bottom: 20px;">아래 텍스트를 선택하여 복사하세요 (Ctrl+A, Ctrl+C)</p>
                <textarea style="width: 100%; height: 400px; font-family: monospace;">${text}</textarea>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      }
    }
  };

  const handleShowReportClick = () => {
    if (!analysisInput.trim()) {
      alert('종합 분석 보고서 텍스트를 먼저 입력해주세요.');
      return;
    }
    onShowReport(analysisInput);
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
          <p>
            워크샵에서 참여자들이 만든 <strong>결과-행동 포스트잇 사진</strong>을 AI에게 분석
            요청하세요.
          </p>

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
          <p>AI가 생성한 Culture Map 텍스트를 아래에 붙여넣고 '컬처맵 생성하기' 버튼을 누르세요.</p>

          <textarea
            value={analysisInput}
            onChange={e => setAnalysisInput(e.target.value)}
            placeholder="여기에 AI가 생성한 Culture Map 텍스트를 붙여넣으세요...

(예시)
[결과] (긍정) 프로젝트 성공률 향상
[행동] (부정) 보고 절차가 복잡하다
[유형_레버] (부정) 다단계 승인 구조 (저자: 막스 베버, 이론: 계층제 이론, 연도: 1922)
[연결] [유형_레버] (부정) 다단계 승인 구조 → [행동] (부정) 보고 절차가 복잡하다 (직접)"
            rows={10}
            className="analysis-textarea"
          />

          <button
            onClick={() => {
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
            }}
            disabled={!analysisInput}
            className="btn-primary"
          >
            📊 컬처맵 생성하기
          </button>
        </Step>

        {/* 종합 분석 프롬프트 */}
        <Step
          stepNumber={2}
          title="종합 분석 프롬프트 복사"
          isOpen={openStep === 2}
          onToggle={() => setOpenStep(openStep === 2 ? -1 : 2)}
          isCompleted={false}
        >
          <p>Culture Map을 종합 분석하는 통합 프롬프트를 복사하세요.</p>

          <div className="analysis-features">
            <h4>✨ 종합 분석 내용 (6단계)</h4>
            <ul>
              <li>
                <strong>1. 조직문화 정의</strong>: 한 문장으로 직관적 정의
              </li>
              <li>
                <strong>2. 유사 조직문화 유형</strong>: 다양한 이론 모델 적용
              </li>
              <li>
                <strong>3. Culture Map 설명</strong>: 인과관계 분석
              </li>
              <li>
                <strong>4. 핵심 요소</strong>: AS-IS/TO-BE 분석 및 이론적 근거
              </li>
              <li>
                <strong>5. 개선/강화 방안</strong>: 제도/활동/개인 차원
              </li>
              <li>
                <strong>6. 동기부여 메시지</strong>: 긍정적 격려 및 비판적 검토
              </li>
            </ul>
          </div>

          <div className="workshop-instructions">
            <h4>사용 방법</h4>
            <ol>
              <li>아래 버튼으로 종합 분석 프롬프트를 복사하세요</li>
              <li>AI 도구에 접속하여 프롬프트를 붙여넣으세요</li>
              <li>1단계에서 생성된 Culture Map 텍스트를 함께 제공하세요</li>
              <li>AI가 생성한 종합 분석 보고서를 다음 단계에서 사용하세요</li>
            </ol>
          </div>

          <button
            onClick={() => handleCopyPrompt(comprehensiveAnalysisPrompt, '종합 분석')}
            className="btn-primary"
          >
            📊 종합 분석 프롬프트 복사
          </button>
        </Step>

        {/* 종합 분석 보고서 보기 */}
        <Step
          stepNumber={3}
          title="종합 분석 보고서 보기"
          isOpen={openStep === 3}
          onToggle={() => setOpenStep(openStep === 3 ? -1 : 3)}
          isCompleted={!!analysisInput}
        >
          <p>
            AI가 생성한 <strong>종합 분석 보고서</strong> 텍스트 전체를 아래에 붙여넣고 '보고서
            보기' 버튼을 누르세요.
          </p>
          <div className="report-info">
            <h4>📋 보고서에 포함된 내용</h4>
            <ul>
              <li>조직문화 정의 (한 문장 요약)</li>
              <li>유사 조직문화 유형 (다양한 이론 적용)</li>
              <li>Culture Map 인과관계 설명</li>
              <li>핵심 요소 및 이론적 근거</li>
              <li>개선/강화 방안 (제도/활동/개인 차원)</li>
              <li>동기부여 메시지</li>
            </ul>
          </div>
          <textarea
            value={analysisInput}
            onChange={e => setAnalysisInput(e.target.value)}
            placeholder="여기에 AI가 생성한 종합 분석 보고서 텍스트를 붙여넣으세요...

보고서는 마크다운 형식으로 작성되어 있으며, WORD/PDF로 출력할 수 있습니다."
            rows={12}
            className="analysis-textarea"
          />
          <button onClick={handleShowReportClick} disabled={!analysisInput} className="btn-primary">
            📄 보고서 보기 (WORD/PDF 출력 가능)
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
