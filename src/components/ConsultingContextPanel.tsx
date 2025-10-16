import React from 'react';
import { useConsultingContext } from '../contexts/useConsultingContext';
import './ConsultingContextPanel.css';

const ConsultingContextPanel: React.FC = () => {
  const { toneAndManner, positivity, negativity, observationNote, koreanCulture, setContext } = useConsultingContext();

  return (
    <div className="consulting-context-panel">
      {/* 1. 컨설턴트 관찰 노트 */}
      <div className="observation-section">
        <h4>💡 컨설턴트 관찰 노트</h4>
        <textarea 
          value={observationNote}
          onChange={(e) => setContext({ observationNote: e.target.value })}
          placeholder="인터뷰 중 관찰한 중요한 맥락, 분위기, 비언어적 신호 등을 자유롭게 기록하세요..."
          rows={4}
        />
      </div>

      {/* 2. 톤앤매너 */}
      <div className="tone-section">
        <h4>🎭 조직 구성원 톤앤매너</h4>
        <select 
          value={toneAndManner}
          onChange={(e) => setContext({ toneAndManner: e.target.value })}
        >
          <option value="">선택하세요</option>
          <option value="formal">격식있고 공손함</option>
          <option value="casual">편안하고 자유로움</option>
          <option value="hierarchical">위계적이고 조심스러움</option>
          <option value="collaborative">협력적이고 개방적</option>
          <option value="passive">소극적이고 방어적</option>
          <option value="dynamic">적극적이고 역동적</option>
        </select>
      </div>

      {/* 3. 긍정성/부정성 */}
      <div className="sentiment-section">
        <h4>😊 감정 경향</h4>
        <div className="sentiment-grid">
          <div>
            <label>긍정성</label>
            <select 
              value={positivity}
              onChange={(e) => setContext({ positivity: e.target.value })}
            >
              <option value="">선택하세요</option>
              <option value="very-positive">매우 긍정적</option>
              <option value="positive">대체로 긍정적</option>
              <option value="neutral">중립적</option>
              <option value="negative">다소 부정적</option>
              <option value="very-negative">매우 부정적</option>
            </select>
          </div>
          
          <div>
            <label>부정성</label>
            <select 
              value={negativity}
              onChange={(e) => setContext({ negativity: e.target.value })}
            >
              <option value="">선택하세요</option>
              <option value="very-low">거의 없음</option>
              <option value="low">낮음</option>
              <option value="moderate">보통</option>
              <option value="high">높음</option>
              <option value="very-high">매우 높음</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. 한국 문화 특성 */}
      <div className="korean-culture-section">
        <h4>🇰🇷 한국 조직문화 특성</h4>
        <div className="checkbox-grid">
          <label>
            <input 
              type="checkbox"
              checked={koreanCulture.silence}
              onChange={(e) => setContext({ 
                koreanCulture: { ...koreanCulture, silence: e.target.checked }
              })}
            />
            <span>침묵 빈도 (동의/불편함의 간접 표현)</span>
          </label>
          
          <label>
            <input 
              type="checkbox"
              checked={koreanCulture.faceSaving}
              onChange={(e) => setContext({ 
                koreanCulture: { ...koreanCulture, faceSaving: e.target.checked }
              })}
            />
            <span>체면 문화 (직접적 비판 회피)</span>
          </label>
          
          <label>
            <input 
              type="checkbox"
              checked={koreanCulture.humor}
              onChange={(e) => setContext({ 
                koreanCulture: { ...koreanCulture, humor: e.target.checked }
              })}
            />
            <span>풍자-해학 (간접적 의견 표현)</span>
          </label>
          
          <label>
            <input 
              type="checkbox"
              checked={koreanCulture.consideration}
              onChange={(e) => setContext({ 
                koreanCulture: { ...koreanCulture, consideration: e.target.checked }
              })}
            />
            <span>배려/겸손 (자기 주장 절제)</span>
          </label>
          
          <label>
            <input 
              type="checkbox"
              checked={koreanCulture.hierarchy}
              onChange={(e) => setContext({ 
                koreanCulture: { ...koreanCulture, hierarchy: e.target.checked }
              })}
            />
            <span>위계 문화 (권위에 대한 복종)</span>
          </label>
          
          <label>
            <input 
              type="checkbox"
              checked={koreanCulture.collectivism}
              onChange={(e) => setContext({ 
                koreanCulture: { ...koreanCulture, collectivism: e.target.checked }
              })}
            />
            <span>집단주의 (개인보다 조직 우선)</span>
          </label>
        </div>
        
        <input 
          type="text" 
          placeholder="기타 관찰된 한국 문화 특성..."
          value={koreanCulture.other}
          onChange={(e) => setContext({ 
            koreanCulture: { ...koreanCulture, other: e.target.value }
          })}
        />
      </div>
    </div>
  );
};

export default ConsultingContextPanel;
