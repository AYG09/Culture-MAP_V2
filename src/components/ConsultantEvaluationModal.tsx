import React, { useState } from 'react';
import './ConsultantEvaluationModal.css';

export interface ConsultantEvaluation {
  overallAssessment: 'positive' | 'neutral' | 'negative';
  contextualNotes: string[];
  additionalContext: string;
  communicationStyle: string[];
}

interface ConsultantEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (evaluation: ConsultantEvaluation) => void;
  stepType: 'gemini' | 'claude';
}

const ConsultantEvaluationModal: React.FC<ConsultantEvaluationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  stepType,
}) => {
  const [overallAssessment, setOverallAssessment] = useState<'positive' | 'neutral' | 'negative'>(
    'neutral'
  );
  const [contextualNotes, setContextualNotes] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  const [communicationStyle, setCommunicationStyle] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleContextualNoteToggle = (note: string) => {
    setContextualNotes(prev =>
      prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note]
    );
  };

  const handleCommunicationStyleToggle = (style: string) => {
    setCommunicationStyle(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const handleConfirm = () => {
    onConfirm({
      overallAssessment,
      contextualNotes,
      additionalContext,
      communicationStyle,
    });
  };

  const getStepTitle = () => {
    return stepType === 'gemini' ? 'STEP 2 - Gemini 1차 분석' : 'STEP 3 - Claude 전문 분석';
  };

  const contextualOptions = [
    '한국식 표현/농담이 많음',
    '직급 문화가 강함',
    '집단주의 문화',
    '간접적 표현 선호',
    '눈치와 배려 중시',
    '상하관계 중요',
    '체면 문화',
    '정서적 유대감 강함',
  ];

  const communicationOptions = [
    '풍자적 표현',
    '해학적 표현',
    '은유적 표현',
    '완곡어법',
    '겸손어법',
    '존댓말 문화',
    '침묵의 의미',
    '맥락적 소통',
  ];

  return (
    <div className="modal-overlay">
      <div className="evaluation-modal">
        <div className="modal-header">
          <h2>🔍 {getStepTitle()} 분석 맥락 설정</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="warning-box">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>중요: AI의 정확한 분석을 위해 반드시 작성해주세요</strong>
              <p>
                한국식 커뮤니케이션 방식(풍자, 해학)을 AI가 오해하지 않도록 컨설턴트의 전반적 평가를
                입력해주세요.
              </p>
            </div>
          </div>

          <div className="form-section">
            <label className="section-title">📋 전반적 조직문화 평가 *</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="assessment"
                  value="positive"
                  checked={overallAssessment === 'positive'}
                  onChange={() => setOverallAssessment('positive')}
                />
                <span className="radio-label positive">
                  ✅ 긍정적/건강함
                  <small>전반적으로 조직문화가 건전하고 긍정적</small>
                </span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="assessment"
                  value="neutral"
                  checked={overallAssessment === 'neutral'}
                  onChange={() => setOverallAssessment('neutral')}
                />
                <span className="radio-label neutral">
                  ⚖️ 보통/혼재
                  <small>긍정적 요소와 부정적 요소가 혼재</small>
                </span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="assessment"
                  value="negative"
                  checked={overallAssessment === 'negative'}
                  onChange={() => setOverallAssessment('negative')}
                />
                <span className="radio-label negative">
                  ❌ 부정적/문제있음
                  <small>심각한 조직문화 문제가 존재</small>
                </span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <label className="section-title">🏢 한국 조직문화 특성 (선택)</label>
            <div className="checkbox-grid">
              {contextualOptions.map(option => (
                <label key={option} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={contextualNotes.includes(option)}
                    onChange={() => handleContextualNoteToggle(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="section-title">💬 커뮤니케이션 스타일 (선택)</label>
            <div className="checkbox-grid">
              {communicationOptions.map(option => (
                <label key={option} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={communicationStyle.includes(option)}
                    onChange={() => handleCommunicationStyleToggle(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="section-title">💡 추가 맥락 정보 (선택)</label>
            <textarea
              className="context-textarea"
              placeholder="AI가 오해할 수 있는 추가적인 맥락이나 특이사항을 입력해주세요..."
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" onClick={handleConfirm}>
            프롬프트 복사
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultantEvaluationModal;
