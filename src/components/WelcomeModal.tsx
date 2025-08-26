import React, { useState } from 'react';
import './WelcomeModal.css';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'intro' | 'updates'>('intro');

  if (!isOpen) return null;

  return (
    <div className="welcome-modal-overlay" onClick={onClose}>
      <div className="welcome-modal-content" onClick={e => e.stopPropagation()}>
        <div className="welcome-modal-header">
          <h2>조직문화 분석기 v1.0.8</h2>
          <button className="welcome-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="welcome-modal-tabs">
          <button
            className={`tab-button ${activeTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveTab('intro')}
          >
            프로그램 소개
          </button>
          <button
            className={`tab-button ${activeTab === 'updates' ? 'active' : ''}`}
            onClick={() => setActiveTab('updates')}
          >
            업데이트 히스토리
          </button>
        </div>

        <div className="welcome-modal-body">
          {activeTab === 'intro' ? (
            <div className="intro-content">
              <h3>🎯 조직문화 분석기란?</h3>
              <p>
                <strong>Dave Gray-Schein 4층위 조직문화 모델</strong>을 기반으로 한 전문적인
                조직문화 분석 도구입니다. 조직의 결과, 행동, 유형적/무형적 요인들을 시각화하여
                문화의 근본 동인을 파악할 수 있습니다.
              </p>

              <h3>📋 주요 기능</h3>
              <ul>
                <li>
                  <strong>컬쳐맵 생성:</strong> AI 분석을 통한 조직문화 요소들의 연결관계 시각화
                </li>
                <li>
                  <strong>워크샵 모드:</strong> 포스트잇 사진 분석으로 실시간 컬쳐맵 생성
                </li>
                <li>
                  <strong>프로페셜 모드:</strong> 단계별 심층 분석 프로세스
                </li>
                <li>
                  <strong>인터랙티브 편집:</strong> 드래그&드롭으로 자유로운 맵 편집
                </li>
                <li>
                  <strong>보고서 생성:</strong> 분석 결과를 전문적인 리포트로 출력
                </li>
              </ul>

              <h3>🚀 활용 방식</h3>
              <ol>
                <li>
                  <strong>데이터 수집:</strong> 조직문화 워크샵, 인터뷰, 설문조사 등
                </li>
                <li>
                  <strong>AI 분석:</strong> 프롬프트 생성기로 LLM에 분석 요청
                </li>
                <li>
                  <strong>맵 생성:</strong> AI 결과를 붙여넣어 컬쳐맵 자동 생성
                </li>
                <li>
                  <strong>맵 편집:</strong> 필요시 노드/연결선 추가, 수정, 삭제
                </li>
                <li>
                  <strong>보고서:</strong> 완성된 맵을 기반으로 전문 보고서 생성
                </li>
              </ol>

              <div className="intro-footer">
                <p>
                  💡 <strong>Tip:</strong> 워크샵 모드에서 포스트잇 사진을 AI에게 보내면 즉시
                  컬쳐맵을 생성할 수 있습니다!
                </p>
              </div>
            </div>
          ) : (
            <div className="updates-content">
              {/* 최신 업데이트 - v1.0.8 */}
              <div className="version-update latest">
                <h3>🆕 v1.0.8 주요 업데이트</h3>

                <div className="update-section">
                  <h4>🇰🇷 한국식 커뮤니케이션 맥락 분석 강화</h4>
                  <ul>
                    <li>
                      <strong>컨설턴트 평가 시스템:</strong> 프롬프트 복사 시 컨설턴트의 전반적
                      평가를 입력하여 AI 분석의 정확도 향상
                    </li>
                    <li>
                      <strong>한국 문화 맥락 가이드:</strong> 풍자, 해학, 간접 표현 등 한국식
                      커뮤니케이션 특성을 AI가 올바르게 해석하도록 프롬프트 개선
                    </li>
                    <li>
                      <strong>시각적 평가 인터페이스:</strong> 조직문화 상태를 명확히 선택할 수 있는
                      직관적인 모달 UI 제공
                    </li>
                    <li>
                      <strong>표현 해석 가이드:</strong> "괜찮은 편", "조금 아쉬운" 등 한국인의
                      우회적 표현의 실제 의미 해석 기능
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>🎯 드래그 성능 최적화</h4>
                  <ul>
                    <li>
                      <strong>렌더링 개선:</strong> 포스트잇 드래그 시 부드러운 움직임과 올바른
                      레이어링 구현
                    </li>
                    <li>
                      <strong>z-index 최적화:</strong> 드래그 중인 포스트잇이 다른 요소 뒤로
                      사라지는 문제 해결
                    </li>
                    <li>
                      <strong>트랜지션 최적화:</strong> 드래그 중 불필요한 애니메이션 비활성화로
                      성능 향상
                    </li>
                  </ul>
                </div>

                <div className="update-footer">
                  <p>
                    <strong>💡 주요 개선:</strong> 한국 조직의 간접적 표현 방식을 AI가 오해하여
                    지나치게 부정적으로 분석하는 문제를 해결했습니다!
                  </p>
                </div>
              </div>

              {/* 이전 업데이트 - v1.0.7 */}
              <div className="version-update previous">
                <h3>🔧 v1.0.7 업데이트</h3>

                <div className="update-section">
                  <h4>🎯 Step 4a-1 프롬프트 개선</h4>
                  <ul>
                    <li>
                      <strong>인과관계 분석 형식 개선:</strong> 컬쳐맵 설명력 분석에서 인과관계를
                      단계별 발언 근거와 함께 체계적으로 제시
                    </li>
                    <li>
                      <strong>전문적 설명 추가:</strong> 전문 용어를 사용하되 이해하기 쉬운
                      서술형으로 메커니즘 설명
                    </li>
                    <li>
                      <strong>실제 근거 제시:</strong> 4단계별(무형→행동→행동→결과) 실제 인터뷰
                      발언을 근거로 인과관계 증명
                    </li>
                  </ul>
                </div>

                <div className="update-footer">
                  <p>
                    <strong>💡 주요 개선:</strong> 조직문화 진단 결과의 설득력과 신뢰성을 높이기
                    위해 인과관계 분석에 구체적인 발언 근거를 체계적으로 제시하도록 개선했습니다!
                  </p>
                </div>
              </div>

              {/* 이전 업데이트 - v1.0.6 */}
              <div className="version-update previous">
                <h3>🔧 v1.0.6 업데이트</h3>

                <div className="update-section">
                  <h4>🎯 컬쳐맵 생성 로직 개선</h4>
                  <ul>
                    <li>
                      <strong>핵심 요소 중심:</strong> 공통적으로 언급되거나 견해 차이가 나타나는
                      요소만 컬쳐맵에 포함
                    </li>
                    <li>
                      <strong>소수 의견 분리:</strong> 개인이나 단일 그룹만 언급한 요소는 컬쳐맵에서
                      제외하고 Minority Report에서 별도 관리
                    </li>
                    <li>
                      <strong>명확한 핵심 파악:</strong> 복잡하고 다양한 모든 요소보다는 조직문화의
                      핵심적 특징을 명확히 드러내는 요소에 집중
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>📊 Minority Report 분석 추가</h4>
                  <ul>
                    <li>
                      <strong>누락된 핵심 요소:</strong> 컬쳐맵에서 제외된 소수 의견 중 조직문화
                      이해에 핵심적인 요소 분석
                    </li>
                    <li>
                      <strong>숨겨진 문화 동력:</strong> 소수만이 인식하지만 조직 전체에 영향을
                      미치는 은밀한 문화적 동력 발견
                    </li>
                    <li>
                      <strong>미래 변화 신호:</strong> 소수가 감지한 조직문화 변화의 조기 신호 포착
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>🔍 이론 근거 제시 강화</h4>
                  <ul>
                    <li>
                      <strong>정확한 근거 발언:</strong> 각 이론별로 [그룹명] "발언내용" 형태로
                      정확한 근거 제시
                    </li>
                    <li>
                      <strong>학술적 신뢰성:</strong> 이론 적용의 근거를 구체적인 구성원 발언으로
                      뒷받침
                    </li>
                    <li>
                      <strong>투명한 분석 과정:</strong> 왜 특정 이론을 선정했는지 명확한 근거와
                      함께 설명
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>🎯 컬쳐맵 생성 로직 개선</h4>
                  <ul>
                    <li>
                      <strong>핵심 요소 중심:</strong> 공통적으로 언급되거나 견해 차이가 나타나는
                      요소만 컬쳐맵에 포함
                    </li>
                    <li>
                      <strong>소수 의견 분리:</strong> 개인이나 단일 그룹만 언급한 요소는 컬쳐맵에서
                      제외하고 Minority Report에서 별도 관리
                    </li>
                    <li>
                      <strong>명확한 핵심 파악:</strong> 복잡하고 다양한 모든 요소보다는 조직문화의
                      핵심적 특징을 명확히 드러내는 요소에 집중
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>📊 Minority Report 분석 추가</h4>
                  <ul>
                    <li>
                      <strong>누락된 핵심 요소:</strong> 컬쳐맵에서 제외된 소수 의견 중 조직문화
                      이해에 핵심적인 요소 분석
                    </li>
                    <li>
                      <strong>숨겨진 문화 동력:</strong> 소수만이 인식하지만 조직 전체에 영향을
                      미치는 은밀한 문화적 동력 발견
                    </li>
                    <li>
                      <strong>미래 변화 신호:</strong> 소수가 감지한 조직문화 변화의 조기 신호 포착
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>🔍 이론 근거 제시 강화</h4>
                  <ul>
                    <li>
                      <strong>정확한 근거 발언:</strong> 각 이론별로 [그룹명] "발언내용" 형태로
                      정확한 근거 제시
                    </li>
                    <li>
                      <strong>학술적 신뢰성:</strong> 이론 적용의 근거를 구체적인 구성원 발언으로
                      뒷받침
                    </li>
                    <li>
                      <strong>투명한 분석 과정:</strong> 왜 특정 이론을 선정했는지 명확한 근거와
                      함께 설명
                    </li>
                  </ul>
                </div>

                <div className="update-footer">
                  <p>
                    <strong>💡 주요 개선:</strong> 컬쳐맵이 더욱 명확하고 핵심적인 조직문화 특징에
                    집중하며, 소수 의견도 체계적으로 관리하여 분석의 완성도를 높였습니다!
                  </p>
                </div>
              </div>

              {/* 이전 업데이트 - v1.0.5 */}
              <div className="version-update previous">
                <h3>🔧 v1.0.5 업데이트</h3>

                <div className="update-section">
                  <h4>📄 텍스트 파일 진행자 식별 기능 추가</h4>
                  <ul>
                    <li>
                      <strong>텍스트 기반 진행자 구분:</strong> 다른 LLM으로 생성된 텍스트에서도
                      발언 내용으로 진행자 자동 식별
                    </li>
                    <li>
                      <strong>식별 기준 체계화:</strong> 질문, 진행, 지명, 회의 운영 등 4가지
                      패턴으로 진행자 판별
                    </li>
                    <li>
                      <strong>분석 정확도 극대화:</strong> 화자 구분이 없는 텍스트에서도 정확한
                      구성원 발언만 추출
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>🔍 진행자 식별 패턴</h4>
                  <ul>
                    <li>
                      <strong>질문 패턴:</strong> "어떻게 생각하세요?", "말씀해 주세요" 등
                    </li>
                    <li>
                      <strong>진행 패턴:</strong> "다음 질문으로", "시간 관계상", "마지막으로" 등
                    </li>
                    <li>
                      <strong>지명 패턴:</strong> "김과장님 먼저", "다음은 누가" 등
                    </li>
                    <li>
                      <strong>운영 패턴:</strong> "정리하면", "결론적으로", "오늘 논의한 내용" 등
                    </li>
                  </ul>
                </div>

                <div className="update-footer">
                  <p>
                    <strong>💡 주요 개선:</strong> 이제 화자 구분이 없는 텍스트 파일에서도 내용을
                    분석하여 진행자를 자동으로 식별하고 분석에서 제외할 수 있습니다!
                  </p>
                </div>
              </div>

              {/* 이전 업데이트 - v1.0.4 */}
              <div className="version-update previous">
                <h3>🔧 v1.0.4 업데이트</h3>

                <div className="update-section">
                  <h4>🎯 인터뷰 분석 프로세스 개선</h4>
                  <ul>
                    <li>
                      <strong>진행자 발언 구분:</strong> 인터뷰어/진행자 발언을 별도
                      태그([진행자])로 구분하여 분석 대상에서 제외
                    </li>
                    <li>
                      <strong>음성 직접 분석 지원:</strong> Step 0 텍스트 변환 없이도 음성에서 직접
                      진행자를 식별하고 분석
                    </li>
                    <li>
                      <strong>분석 정확도 향상:</strong> 실제 구성원 발언만을 대상으로 하여 조직문화
                      분석의 신뢰성 증대
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>🔧 프로그램 안정성 향상</h4>
                  <ul>
                    <li>
                      <strong>빌드 프로세스 최적화:</strong> 빌드 중단 문제 해결 및 안정적인 릴리즈
                      프로세스 구축
                    </li>
                    <li>
                      <strong>업데이트 히스토리:</strong> 버전별 업데이트 내역을 히스토리 형태로
                      체계화
                    </li>
                    <li>
                      <strong>사용자 경험 개선:</strong> 새로운 기능과 개선사항을 명확하게 전달
                    </li>
                  </ul>
                </div>
              </div>

              {/* 이전 업데이트 - v1.0.2 */}
              <div className="version-update previous">
                <h3>🔧 v1.0.2 업데이트</h3>

                <div className="update-section">
                  <h4>🎯 워크샵 분석 프롬프트 대폭 개선</h4>
                  <ul>
                    <li>
                      <strong>As-Is / To-Be 분석 통합:</strong> 현재 상태와 목표 상태 분석을 하나의
                      프롬프트로 지원
                    </li>
                    <li>
                      <strong>분석 유형 선택:</strong> 워크샵 시작 전 As-Is 또는 To-Be 분석 모드를
                      명확히 선택
                    </li>
                    <li>
                      <strong>유연한 해석:</strong> 동일한 포스트잇 데이터를 상황에 맞게 해석 가능
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>📝 사용법 간편화</h4>
                  <ul>
                    <li>
                      <strong>카테고리명 활용:</strong> 포스트잇 사진의 좌측에 "As-Is 결과" / "To-Be
                      행동" 등으로 명시
                    </li>
                    <li>
                      <strong>자동 모드 전환:</strong> AI가 카테고리명을 읽고 자동으로 적절한 분석
                      모드 적용
                    </li>
                    <li>
                      <strong>직관적 구분:</strong> 현재 문제점과 미래 목표를 명확히 구분하여 분석
                    </li>
                  </ul>
                </div>

                <div className="update-section">
                  <h4>💡 실용성 향상</h4>
                  <ul>
                    <li>
                      <strong>단계별 워크샵 지원:</strong> 현재 진단 → 목표 설정으로 이어지는 워크샵
                      프로세스
                    </li>
                    <li>
                      <strong>맞춤형 예시:</strong> As-Is와 To-Be 각각에 대한 구체적인 분석 예시
                      제공
                    </li>
                    <li>
                      <strong>효율적 분석:</strong> 하나의 도구로 문제 진단과 개선 방향 도출 동시
                      수행
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="welcome-modal-footer">
          <button className="welcome-modal-start" onClick={onClose}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
