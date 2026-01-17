import './ModalBase.css';
import './HelpModal.css';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal = ({ onClose }: HelpModalProps) => {
  return (
    <div className="cm-modal-overlay help-modal-overlay" onClick={onClose}>
      <div className="cm-modal help-modal" onClick={e => e.stopPropagation()}>
        <div className="cm-modal-header help-modal-header">
          <h2 className="cm-modal-title">컬처 맵 사용 가이드</h2>
          <button onClick={onClose} className="cm-modal-close help-modal-close">
            &times;
          </button>
        </div>
        <div className="cm-modal-body help-modal-body">
          <h3>기본 조작</h3>
          <ul>
            <li>
              <strong>맵 이동:</strong> 맵의 빈 공간을 마우스 오른쪽 버튼으로 클릭 & 드래그
            </li>
            <li>
              <strong>노트(포스트잇) 이동:</strong> 노트를 마우스 왼쪽 버튼으로 클릭 & 드래그
            </li>
            <li>
              <strong>노트 크기 조절:</strong> 노트 우측 하단 핸들을 클릭 & 드래그
            </li>
          </ul>

          <h3>포스트잇 생성 및 편집</h3>
          <ul>
            <li>
              <strong>포스트잇 생성:</strong> 맵의 빈 공간을 마우스 오른쪽 버튼으로 더블클릭 →
              포스트잇 종류 선택
            </li>
            <li>
              <strong>포스트잇 편집:</strong> 포스트잇을 우클릭 → '편집' 메뉴 클릭
            </li>
            <li>
              <strong>편집 모드 조작:</strong>
              <ul>
                <li>
                  <code>Enter</code> 키: 변경사항 저장
                </li>
                <li>
                  <code>Escape</code> 키: 편집 취소
                </li>
                <li>저장/취소 버튼 클릭 가능</li>
              </ul>
            </li>
            <li>
              <strong>유형/무형 포스트잇:</strong> 내용 외에 개념, 출처, 분류 정보도 편집 가능
            </li>
          </ul>

          <h3>다중 선택</h3>
          <ul>
            <li>
              <strong>영역으로 선택:</strong> 맵의 빈 공간을 마우스 왼쪽 버튼으로 클릭 & 드래그
            </li>
            <li>
              <strong>개별 추가/해제:</strong> <code>Shift</code> 키를 누른 채 노트를 클릭
            </li>
            <li>
              <strong>그룹 이동:</strong> 선택된 노트 중 하나를 잡고 드래그
            </li>
          </ul>

          <h3>연결선 관리 (우클릭 메뉴)</h3>
          <ul>
            <li>
              <strong>연결 시작:</strong> 노트 우클릭 → '연결 시작' 클릭 → 다른 노트 클릭
            </li>
            <li>
              <strong>연결선 종류 변경:</strong> 연결선 우클릭 → '점선/실선으로 전환' 클릭
            </li>
            <li>
              <strong>연결선 삭제:</strong> 연결선 우클릭 → '연결선 삭제' 클릭
            </li>
          </ul>

          <h3>노트 관리 (우클릭 메뉴)</h3>
          <ul>
            <li>
              <strong>감성(색상) 변경:</strong> 노트 우클릭 → '색상 전환' 클릭 (긍정-부정-중립 순환)
            </li>
            <li>
              <strong>노트 삭제:</strong> 노트 우클릭 → '삭제' 클릭
            </li>
          </ul>

          <h3>데이터 관리</h3>
          <ul>
            <li>
              <strong>맵 생성/수정:</strong> 좌측 패널에 AI 분석 결과 붙여넣기 → '맵 그리기' 버튼
              클릭
            </li>
            <li>
              <strong>전체 삭제:</strong> 좌측 패널의 '전체 삭제' 버튼 클릭
            </li>
            <li>
              <strong>이미지로 저장:</strong> 상단 헤더의 '맵 이미지로 저장' 버튼 클릭 (실제 컨텐츠
              영역만 캡처)
            </li>
          </ul>

          <h3>팁</h3>
          <ul>
            <li>
              <strong>패닝 후 컨텍스트 메뉴:</strong> 맵을 드래그한 직후에는 우클릭 메뉴가 나타나지
              않습니다
            </li>
            <li>
              <strong>포스트잇 종류:</strong> 기본, 유형요인, 무형요인 포스트잇은 각각 다른 색상과
              추가 정보를 가집니다
            </li>
            <li>
              <strong>편집 중 이동 방지:</strong> 편집 모드 중에는 포스트잇이 이동되지 않습니다
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
