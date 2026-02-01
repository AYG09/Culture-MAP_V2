import './ModalBase.css';
import './HelpModal.css';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal = ({ onClose }: HelpModalProps) => {
  return (
    <div className="cm-modal-overlay help-modal-overlay" onClick={onClose}>
      <div className="cm-modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header help-modal-header">
          <div>
            <p className="help-modal-eyebrow">AI + 수동 조작 통합 가이드</p>
            <h2 className="cm-modal-title">초보 사용자를 위한 빠른 안내</h2>
          </div>
          <button onClick={onClose} className="cm-modal-close help-modal-close">
            &times;
          </button>
        </div>

        <div className="cm-modal-body help-modal-body">
          <section className="help-modal-section">
            <h3 className="help-modal-section-title">🚀 빠른 시작</h3>
            <div className="help-modal-grid">
              <div className="help-card">
                <h4>1) 노드 만들기</h4>
                <p>빈 캔버스 우클릭 → 레이어 선택</p>
                <div className="help-chip">또는 AI에게 “노드 3개 만들어줘”</div>
              </div>
              <div className="help-card">
                <h4>2) 연결하기</h4>
                <p>노드 핸들을 드래그해서 다른 노드에 연결</p>
                <div className="help-chip">AI에게 “A와 B 연결해줘”</div>
              </div>
              <div className="help-card">
                <h4>3) 정렬하기</h4>
                <p>노드 위치만 정렬하려면 자동 정렬</p>
                <div className="help-chip">AI에게 “자동 정렬해”</div>
              </div>
            </div>
          </section>

          <section className="help-modal-section">
            <h3 className="help-modal-section-title">🖱️ 수동 사용법</h3>
            <div className="help-modal-two-col">
              <div className="help-card">
                <h4>캔버스/노드</h4>
                <ul className="help-list">
                  <li><strong>맵 이동:</strong> 빈 공간 중간/우클릭 드래그</li>
                  <li><strong>확대/축소:</strong> 마우스 휠</li>
                  <li><strong>노드 이동:</strong> 왼쪽 버튼 드래그</li>
                  <li><strong>크기 조절:</strong> 리사이즈 핸들 드래그</li>
                  <li><strong>편집:</strong> 더블클릭</li>
                </ul>
              </div>
              <div className="help-card">
                <h4>우클릭 메뉴</h4>
                <ul className="help-list">
                  <li><strong>속성 변경:</strong> 감성/종류 전환</li>
                  <li><strong>노드 삭제:</strong> 노드 우클릭 → 삭제</li>
                  <li><strong>연결선 삭제:</strong> 연결선 우클릭 → 삭제</li>
                  <li><strong>핀 고정:</strong> 노드 상단 핀 버튼</li>
                  <li><strong>일괄 고정/해제:</strong> 드래그 선택 → 우클릭 → 선택 노드</li>
                </ul>
              </div>
            </div>
            <div className="help-tip">
              💡 편집 중에는 노드가 이동되지 않습니다. 핀 고정 노드는 자동 정렬에서도 위치가 유지됩니다.
            </div>
            <div className="help-tip">
              ↩️ 상단 “이전상태”는 참여자 구분 없이 마지막 변경을 1단계 되돌립니다.
            </div>
            <div className="help-tip">
              💾 “컬쳐맵 저장/로드”는 세션 전역 공유입니다.
            </div>
          </section>

          <section className="help-modal-section">
            <h3 className="help-modal-section-title">🤖 AI 명령 가이드</h3>
            <div className="help-modal-grid">
              <div className="help-card">
                <h4>노드/연결 생성</h4>
                <ul className="help-list">
                  <li>“행동 노드 2개 만들어줘”</li>
                  <li>“A, B, C 만들고 A-B, B-C 연결해줘”</li>
                </ul>
              </div>
              <div className="help-card">
                <h4>정렬/연결선 정리</h4>
                <ul className="help-list">
                  <li>“자동 정렬해” (노드 위치만)</li>
                  <li>“연결선 다시 정렬해” (핸들 재배치)</li>
                </ul>
              </div>
              <div className="help-card">
                <h4>핀/레이어/뷰포트</h4>
                <ul className="help-list">
                  <li>“이 노드 고정해줘”</li>
                  <li>“선택 노드 전부 고정해줘”</li>
                  <li>“3층 레이어 높이 350으로”</li>
                  <li>“전체 보기로 맞춰줘”</li>
                </ul>
              </div>
              <div className="help-card">
                <h4>되돌리기/스냅샷</h4>
                <ul className="help-list">
                  <li>“이전 상태로 되돌려”</li>
                  <li>“스냅샷 저장해줘”</li>
                  <li>“스냅샷 복원해줘”</li>
                </ul>
              </div>
              <div className="help-card">
                <h4>수정/삭제</h4>
                <ul className="help-list">
                  <li>“노드 X 내용 바꿔줘”</li>
                  <li>“연결선 삭제해줘”</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="help-modal-section">
            <h3 className="help-modal-section-title">🧰 AI 기능 한눈에 보기</h3>
            <div className="help-pill-group">
              <span className="help-pill">노드 생성/수정</span>
              <span className="help-pill">연결선 생성/삭제</span>
              <span className="help-pill">자동 정렬(노드)</span>
              <span className="help-pill">연결선 재정렬</span>
              <span className="help-pill">핀 고정/해제</span>
              <span className="help-pill">선택 노드 일괄 고정</span>
              <span className="help-pill">이전상태(전역 Undo)</span>
              <span className="help-pill">스냅샷 저장/로드(공유)</span>
              <span className="help-pill">레이어 높이 조절</span>
              <span className="help-pill">줌/팬/전체보기</span>
              <span className="help-pill">스타일/가시성 조절</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
