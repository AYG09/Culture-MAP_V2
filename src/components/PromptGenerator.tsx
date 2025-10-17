import React, { useState, useEffect } from 'react';
import { promptLoader } from '../utils/promptLoader';
import { parseAIOutput } from '../utils/parser';
import type { NoteData, ConnectionData } from '../types/culture';
import { ConsultingContextProvider } from '../contexts/ConsultingContext';
import { useConsultingContext } from '../contexts/useConsultingContext';
import ConsultingContextPanel from './ConsultingContextPanel';
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
  mode?: 'workshop' | 'consulting';
  onGenerateMap: (data: { notes: NoteData[]; connections: ConnectionData[] }) => void;
  reportContent?: string;
  onReportChange?: (content: string) => void;
  onSwitchToReportTab?: () => void;
  onOpenAiPanel?: () => void;
}

const PromptGenerator: React.FC<PromptGeneratorProps> = ({ 
  mode = 'workshop',
  onGenerateMap,
  reportContent,
  onReportChange,
  onSwitchToReportTab,
  onOpenAiPanel
}) => {
  return (
    <ConsultingContextProvider>
      <PromptGeneratorInner
        mode={mode}
        onGenerateMap={onGenerateMap}
        reportContent={reportContent}
        onReportChange={onReportChange}
        onSwitchToReportTab={onSwitchToReportTab}
        onOpenAiPanel={onOpenAiPanel}
      />
    </ConsultingContextProvider>
  );
};

const PromptGeneratorInner: React.FC<PromptGeneratorProps> = ({ 
  mode = 'workshop',
  onGenerateMap,
  onSwitchToReportTab,
  onOpenAiPanel
}) => {
  // ConsultingContext 사용
  const { toneAndManner, positivity, negativity, observationNote, koreanCulture } = useConsultingContext();
  
  // 컨텍스트를 포함한 프롬프트 생성 함수
  const generateContextualPrompt = (basePrompt: string): string => {
    if (mode !== 'consulting') {
      return basePrompt; // 워크샵 모드는 기본 프롬프트만 반환
    }
    
    let prompt = '';
    
    // 1. 컨설턴트 관찰 노트
    if (observationNote && observationNote.trim()) {
      prompt += `## 🔍 컨설턴트 현장 관찰 내용\n\n${observationNote}\n\n---\n\n`;
    }
    
    // 2. 인터뷰 맥락
    if (toneAndManner || positivity || negativity) {
      prompt += `## 🎭 인터뷰 상황 맥락\n\n`;
      if (toneAndManner) {
        const toneLabel: Record<string, string> = {
          formal: '격식있고 공손함',
          casual: '편안하고 자유로움',
          hierarchical: '위계적이고 조심스러움',
          collaborative: '협력적이고 개방적',
          passive: '소극적이고 방어적',
          dynamic: '적극적이고 역동적',
        };
        prompt += `- **톤앤매너**: ${toneLabel[toneAndManner] || toneAndManner}\n`;
      }
      if (positivity) {
        const positivityLabel: Record<string, string> = {
          'very-positive': '매우 긍정적',
          'positive': '대체로 긍정적',
          'neutral': '중립적',
          'negative': '다소 부정적',
          'very-negative': '매우 부정적',
        };
        prompt += `- **긍정성**: ${positivityLabel[positivity] || positivity}\n`;
      }
      if (negativity) {
        const negativityLabel: Record<string, string> = {
          'very-low': '거의 없음',
          'low': '낮음',
          'moderate': '보통',
          'high': '높음',
          'very-high': '매우 높음',
        };
        prompt += `- **부정성**: ${negativityLabel[negativity] || negativity}\n`;
      }
      prompt += `\n---\n\n`;
    }
    
    // 3. 한국 문화 특성
    const koreanItems: string[] = [];
    if (koreanCulture.silence) koreanItems.push('**침묵 빈도 높음**: 동의/불편함을 말로 표현하지 않고 침묵으로 전달');
    if (koreanCulture.faceSaving) koreanItems.push('**체면 문화**: 직접적인 비판이나 부정적 의견을 회피하는 경향');
    if (koreanCulture.humor) koreanItems.push('**풍자-해학**: 간접적이고 유머러스한 방식으로 의견 전달');
    if (koreanCulture.consideration) koreanItems.push('**배려/겸손**: 자기 주장을 절제하고 타인을 배려하는 태도');
    if (koreanCulture.hierarchy) koreanItems.push('**위계 문화**: 권위에 대한 복종, 수직적 의사소통');
    if (koreanCulture.collectivism) koreanItems.push('**집단주의**: 개인보다 조직/팀을 우선시');
    if (koreanCulture.other && koreanCulture.other.trim()) koreanItems.push(`**기타**: ${koreanCulture.other}`);
    
    if (koreanItems.length > 0) {
      prompt += `## 🇰🇷 한국 조직문화 특성\n\n인터뷰 중 관찰된 한국 문화적 맥락:\n\n`;
      koreanItems.forEach(item => {
        prompt += `- ${item}\n`;
      });
      prompt += `\n**주의**: 위 특성들은 AI가 텍스트만으로는 감지하기 어려운 비언어적/상황적 맥락입니다. 분석 시 반드시 고려해주세요.\n\n---\n\n`;
    }
    
    // 4. 기본 프롬프트
    prompt += basePrompt;
    
    return prompt;
  };
  
  const [analysisInput, setAnalysisInput] = useState('');
  const [openStep, setOpenStep] = useState<number>(0);
  const [workshopPrompt, setWorkshopPrompt] = useState<string>('');
  const [comprehensiveAnalysisPrompt, setComprehensiveAnalysisPrompt] = useState<string>('');
  
  // 컨설팅 모드 프롬프트 state 추가
  const [consultingPrompts, setConsultingPrompts] = useState<{
    step0: string;
    step1: string;
    step2: string;
    step3: string;
    step4a: string;
    step4b: string;
  }>({
    step0: '',
    step1: '',
    step2: '',
    step3: '',
    step4a: '',
    step4b: '',
  });

  useEffect(() => {
    let ignore = false;
    
    // 모드에 따라 프롬프트 로드
    const loadPrompts = async () => {
      try {
        if (mode === 'workshop') {
          const [workshopResult, comprehensiveResult] = await Promise.all([
            promptLoader.loadPrompt('workshop_analysis'),
            promptLoader.loadPrompt('comprehensive_analysis'),
          ]);
          
          if (!ignore) {
            setWorkshopPrompt(workshopResult.content || '프롬프트를 불러올 수 없습니다.');
            setComprehensiveAnalysisPrompt(
              comprehensiveResult.content || '프롬프트를 불러올 수 없습니다.'
            );

            // 로딩 결과 로그
            console.log('워크샵 프롬프트 로딩:', workshopResult.success ? '성공' : '실패');
            console.log('종합 분석 프롬프트 로딩:', comprehensiveResult.success ? '성공' : '실패');
          }
        } else if (mode === 'consulting') {
          const [step0Result, step1Result, step2Result, step3Result, step4aResult, step4bResult] = await Promise.all([
            promptLoader.loadPrompt('step0'),
            promptLoader.loadPrompt('step1'),
            promptLoader.loadPrompt('step2'),
            promptLoader.loadPrompt('step3'),
            promptLoader.loadPrompt('step4a_claude_diagnosis'),
            promptLoader.loadPrompt('step4b_claude_strategy'),
          ]);
          
          if (!ignore) {
            setConsultingPrompts({
              step0: step0Result.content || '프롬프트를 불러올 수 없습니다.',
              step1: step1Result.content || '프롬프트를 불러올 수 없습니다.',
              step2: step2Result.content || '프롬프트를 불러올 수 없습니다.',
              step3: step3Result.content || '프롬프트를 불러올 수 없습니다.',
              step4a: step4aResult.content || '프롬프트를 불러올 수 없습니다.',
              step4b: step4bResult.content || '프롬프트를 불러올 수 없습니다.',
            });

            // 로딩 결과 로그
            console.log('컨설팅 프롬프트 로딩:', 
              step0Result.success && step1Result.success && step2Result.success && 
              step3Result.success && step4aResult.success && step4bResult.success ? '성공' : '실패'
            );
          }
        }
      } catch (error) {
        console.error('프롬프트 로딩 실패:', error);
        if (mode === 'workshop') {
          setWorkshopPrompt('프롬프트 로딩 중 오류가 발생했습니다.');
          setComprehensiveAnalysisPrompt('프롬프트 로딩 중 오류가 발생했습니다.');
        } else if (mode === 'consulting') {
          setConsultingPrompts({
            step0: '프롬프트 로딩 중 오류가 발생했습니다.',
            step1: '프롬프트 로딩 중 오류가 발생했습니다.',
            step2: '프롬프트 로딩 중 오류가 발생했습니다.',
            step3: '프롬프트 로딩 중 오류가 발생했습니다.',
            step4a: '프롬프트 로딩 중 오류가 발생했습니다.',
            step4b: '프롬프트 로딩 중 오류가 발생했습니다.',
          });
        }
      }
    };
    
    loadPrompts();
    
    return () => {
      ignore = true;
    };
  }, [mode]);
  
  // mode 변경 시 openStep 초기화
  useEffect(() => {
    setOpenStep(0);
  }, [mode]);

  const handleCopyPrompt = async (text: string, label: string) => {
    // 프롬프트 텍스트가 비어있는지 확인
    if (!text || text.trim().length === 0) {
      alert('복사할 프롬프트 내용이 없습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // 컨설팅 모드일 때만 컨텍스트 추가
    const finalPrompt = generateContextualPrompt(text);

    try {
      // 최신 Clipboard API 사용 (HTTPS에서만 작동)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(finalPrompt);
        console.log('클립보드 복사 성공 (Clipboard API):', finalPrompt.substring(0, 100));
        alert(`${label} 프롬프트가 클립보드에 복사되었습니다!`);
      } else {
        // 폴백 방식 (HTTP에서도 작동)
        const textArea = document.createElement('textarea');
        textArea.value = finalPrompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          console.log('클립보드 복사 성공 (execCommand):', finalPrompt.substring(0, 100));
          alert(`${label} 프롬프트가 클립보드에 복사되었습니다!`);
        } else {
          throw new Error('execCommand 복사 실패');
        }
      }
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      console.log('복사 시도한 텍스트 길이:', finalPrompt.length);

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

  const isStep0Completed = !!analysisInput;

  return (
      <div className="prompt-generator">
        {/* 모드별 헤더 */}
        <div className="workshop-mode-header">
          <h2>{mode === 'workshop' ? '📋 워크샵 분석 도구' : '💼 컨설팅 분석 도구'}</h2>
          <p>
            {mode === 'workshop' 
              ? '포스트잇 기반 조직문화 분석 및 컬처맵 생성' 
              : '인터뷰 기반 심층 조직문화 분석'}
          </p>
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

      {/* 워크샵 모드 Steps */}
      {mode === 'workshop' && (
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

        {/* AI 보고서 입력 */}
        <Step
          stepNumber={3}
          title="📝 AI 보고서 입력"
          isOpen={openStep === 3}
          onToggle={() => setOpenStep(openStep === 3 ? -1 : 3)}
          isCompleted={!!analysisInput}
        >
          <div className="step-description">
            <p>
              AI가 생성한 <strong>종합 분석 보고서</strong>를 아래 텍스트 영역에 붙여넣으세요.
            </p>
          </div>

          <div className="input-section">
            <textarea
              value={analysisInput}
              onChange={(e) => setAnalysisInput(e.target.value)}
              placeholder="AI가 생성한 종합 분석 보고서를 여기에 붙여넣으세요..."
              rows={15}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
            />
          </div>

          {analysisInput && (
            <button
              onClick={() => onSwitchToReportTab?.()}
              className="btn-primary"
              style={{ marginTop: '16px' }}
            >
              📄 보고서 탭으로 이동
            </button>
          )}
        </Step>
      </div>
      )}

      {/* 컨설팅 모드 Steps */}
      {mode === 'consulting' && (
        <div className="consulting-mode">
          {/* Step 0: 음성-텍스트 변환 */}
          <Step
            stepNumber={0}
            title="🎤 음성-텍스트 변환"
            isOpen={openStep === 0}
            onToggle={() => setOpenStep(openStep === 0 ? -1 : 0)}
            isCompleted={false}
          >
            <p>
              인터뷰 녹음 파일을 <strong>NotebookLM</strong>에 업로드하여 텍스트로 변환합니다.
            </p>
            <ol>
              <li>NotebookLM에 인터뷰 녹음 파일 업로드</li>
              <li>자동 텍스트 변환 (Speech-to-Text)</li>
              <li>변환된 텍스트 다운로드</li>
            </ol>
            <button
              className="copy-prompt-btn"
              onClick={() => handleCopyPrompt(consultingPrompts.step0, 'Step 0: 음성-텍스트 변환')}
              disabled={!consultingPrompts.step0}
            >
              📋 프롬프트 복사
            </button>
          </Step>

          {/* Step 1: 핵심 데이터 추출 */}
          <Step
            stepNumber={1}
            title="📋 핵심 데이터 추출"
            isOpen={openStep === 1}
            onToggle={() => setOpenStep(openStep === 1 ? -1 : 1)}
            isCompleted={false}
          >
            <p>
              변환된 인터뷰 텍스트에서 핵심 데이터를 추출합니다.
            </p>
            <ol>
              <li>Step 0에서 변환된 텍스트 복사</li>
              <li>아래 프롬프트를 <strong>ChatGPT</strong> 또는 <strong>Claude</strong>에 붙여넣기</li>
              <li>추출된 핵심 데이터를 다음 단계에 사용</li>
            </ol>
            <button
              className="copy-prompt-btn"
              onClick={() => handleCopyPrompt(consultingPrompts.step1, 'Step 1: 핵심 데이터 추출')}
              disabled={!consultingPrompts.step1}
            >
              📋 프롬프트 복사
            </button>
          </Step>

          {/* Step 2: Gemini 1차 분석 */}
          <Step
            stepNumber={2}
            title="🔍 Gemini 1차 분석"
            isOpen={openStep === 2}
            onToggle={() => setOpenStep(openStep === 2 ? -1 : 2)}
            isCompleted={false}
          >
            <p>
              Step 1에서 추출한 핵심 데이터를 <strong>Gemini</strong>에 입력하여 1차 분석을 진행합니다.
            </p>
            
            {/* 컨설팅 컨텍스트 입력 섹션 */}
            <div className="context-panel-section">
              <h4>📝 컨설팅 컨텍스트 입력</h4>
              <p>프롬프트에 포함될 인터뷰 맥락 정보를 입력하세요. (선택사항)</p>
              <ConsultingContextPanel />
            </div>
            
            <ol>
              <li>위에 컨설팅 컨텍스트를 입력하세요 (선택사항)</li>
              <li>Step 1에서 추출한 데이터 복사</li>
              <li>아래 "프롬프트 복사" 버튼 클릭</li>
              <li>프롬프트를 <strong>Gemini</strong>에 붙여넣기</li>
              <li>Gemini 분석 결과를 다음 단계에 사용</li>
            </ol>
            <button
              className="copy-prompt-btn"
              onClick={async () => {
                if (!consultingPrompts.step2) return;
                
                const finalPrompt = generateContextualPrompt(consultingPrompts.step2);
                
                try {
                  await navigator.clipboard.writeText(finalPrompt);
                  alert('프롬프트가 클립보드에 복사되었습니다!');
                } catch {
                  try {
                    const textarea = document.createElement('textarea');
                    textarea.value = finalPrompt;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    
                    if (success) {
                      alert('프롬프트가 클립보드에 복사되었습니다!');
                    } else {
                      throw new Error('복사 실패');
                    }
                  } catch {
                    alert('클립보드 복사에 실패했습니다.');
                  }
                }
              }}
              disabled={!consultingPrompts.step2}
            >
              📋 프롬프트 복사
            </button>
          </Step>

          {/* Step 3: Claude 컬처맵 생성 */}
          <Step
            stepNumber={3}
            title="🗺️ Claude 컬처맵 생성"
            isOpen={openStep === 3}
            onToggle={() => setOpenStep(openStep === 3 ? -1 : 3)}
            isCompleted={false}
          >
            <p>
              Step 2의 Gemini 분석 결과를 <strong>Claude</strong>에 입력하여 컬처맵을 생성합니다.
            </p>
            
            {/* 컨설팅 컨텍스트 확인 섹션 */}
            <div className="context-panel-section">
              <h4>📝 컨설팅 컨텍스트 확인</h4>
              <p>Step 2에서 입력한 컨텍스트가 자동으로 포함됩니다. 필요시 수정 가능합니다.</p>
              <ConsultingContextPanel />
            </div>
            
            <ol>
              <li>Step 2의 Gemini 분석 결과 복사</li>
              <li>아래 "프롬프트 복사" 버튼 클릭</li>
              <li>프롬프트를 <strong>Claude</strong>에 붙여넣기</li>
              <li>생성된 컬처맵 데이터를 복사하여 "AI 일괄 생성 패널 열기" 버튼으로 입력</li>
            </ol>
            <button
              className="copy-prompt-btn"
              onClick={async () => {
                if (!consultingPrompts.step3) return;
                
                const finalPrompt = generateContextualPrompt(consultingPrompts.step3);
                
                try {
                  await navigator.clipboard.writeText(finalPrompt);
                  alert('프롬프트가 클립보드에 복사되었습니다!');
                } catch {
                  try {
                    const textarea = document.createElement('textarea');
                    textarea.value = finalPrompt;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    
                    if (success) {
                      alert('프롬프트가 클립보드에 복사되었습니다!');
                    } else {
                      throw new Error('복사 실패');
                    }
                  } catch {
                    alert('클립보드 복사에 실패했습니다.');
                  }
                }
              }}
              disabled={!consultingPrompts.step3}
            >
              📋 프롬프트 복사
            </button>
            
            <button
              className="ai-generate-btn"
              onClick={() => onOpenAiPanel?.()}
              style={{ marginTop: '10px' }}
            >
              🤖 AI 일괄 생성 패널 열기
            </button>
          </Step>

          {/* Step 4: 조직문화 진단 */}
          <Step
            stepNumber={4}
            title="📊 조직문화 진단"
            isOpen={openStep === 4}
            onToggle={() => setOpenStep(openStep === 4 ? -1 : 4)}
            isCompleted={false}
          >
            <p>
              Step 3에서 생성한 컬처맵을 바탕으로 <strong>Claude</strong>를 이용하여 조직문화를 진단합니다.
            </p>
            <ol>
              <li>Step 3의 컬처맵 데이터 복사</li>
              <li>아래 프롬프트를 <strong>Claude</strong>에 붙여넣기</li>
              <li>진단 결과를 검토하고 다음 단계에 활용</li>
            </ol>
            <button
              className="copy-prompt-btn"
              onClick={() => handleCopyPrompt(consultingPrompts.step4a, 'Step 4: 조직문화 진단')}
              disabled={!consultingPrompts.step4a}
            >
              📋 프롬프트 복사
            </button>
            
            <div className="sub-prompts" style={{ marginTop: '15px' }}>
              <p><strong>세부 진단 프롬프트:</strong></p>
              <p style={{ fontSize: '14px', color: '#666' }}>
                step4a1 (문화 진단), step4a2 (이론 분석), step4a3 (편향 분석) 프롬프트는 필요 시 별도로 사용할 수 있습니다.
              </p>
            </div>
          </Step>

          {/* Step 5: 실행 전략 */}
          <Step
            stepNumber={5}
            title="🚀 실행 전략"
            isOpen={openStep === 5}
            onToggle={() => setOpenStep(openStep === 5 ? -1 : 5)}
            isCompleted={false}
          >
            <p>
              Step 4의 진단 결과를 바탕으로 <strong>Claude</strong>를 이용하여 실행 전략을 수립합니다.
            </p>
            <ol>
              <li>Step 4의 진단 결과 복사</li>
              <li>아래 프롬프트를 <strong>Claude</strong>에 붙여넣기</li>
              <li>생성된 실행 전략을 검토하고 조직에 적용</li>
            </ol>
            <button
              className="copy-prompt-btn"
              onClick={() => handleCopyPrompt(consultingPrompts.step4b, 'Step 5: 실행 전략')}
              disabled={!consultingPrompts.step4b}
            >
              📋 프롬프트 복사
            </button>
          </Step>
        </div>
      )}

      <div className="workshop-mode">
        {/* 이론적 배경 */}
        <Step
          stepNumber={mode === 'consulting' ? 6 : 4}
          title="📖 이론적 배경"
          isOpen={openStep === (mode === 'consulting' ? 6 : 4)}
          onToggle={() => {
            const stepNum = mode === 'consulting' ? 6 : 4;
            setOpenStep(openStep === stepNum ? -1 : stepNum);
          }}
          isCompleted={false}
        >
          <div className="theory-content">
            <p>
              {mode === 'workshop'
                ? '워크샵 분석 결과를 이론적 배경과 함께 해석합니다.'
                : '컨설팅 분석 결과를 이론적 배경과 함께 해석합니다.'}
            </p>
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
