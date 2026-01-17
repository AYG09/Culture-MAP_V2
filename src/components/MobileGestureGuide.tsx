import { useState, useEffect } from 'react';
import { isMobileDevice } from '../utils/deviceDetection';
import './ModalBase.css';
import './MobileGestureGuide.css';

/**
 * 모바일 터치 제스처 가이드 컴포넌트
 * 첫 방문 사용자에게 모바일 제스처 사용법 안내
 */
const MobileGestureGuide = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 모바일 디바이스이고 가이드를 보지 않은 경우에만 표시
    const hasSeenGuide = localStorage.getItem('hasSeenMobileGestureGuide');
    if (isMobileDevice() && !hasSeenGuide) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenMobileGestureGuide', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="cm-modal-overlay mobile-gesture-guide-overlay">
      <div className="cm-modal mobile-gesture-guide">
        <button className="cm-modal-close guide-close-button" onClick={handleClose}>
          ✕
        </button>

        <div className="cm-modal-body mobile-gesture-body">
          <h2 className="cm-modal-title">📱 모바일 제스처 가이드</h2>

          <div className="gesture-list">
            <div className="gesture-item">
              <div className="gesture-icon">👆</div>
              <div className="gesture-content">
                <h3>빈 공간 드래그</h3>
                <p>캔버스 이동 (팬)</p>
              </div>
            </div>

            <div className="gesture-item">
              <div className="gesture-icon">🤏</div>
              <div className="gesture-content">
                <h3>두 손가락 핀치</h3>
                <p>확대/축소 (줌)</p>
              </div>
            </div>

            <div className="gesture-item">
              <div className="gesture-icon">➕</div>
              <div className="gesture-content">
                <h3>우측 하단 FAB 버튼</h3>
                <p>새 포스트잇 생성</p>
              </div>
            </div>

            <div className="gesture-item">
              <div className="gesture-icon">✏️</div>
              <div className="gesture-content">
                <h3>포스트잇 더블탭</h3>
                <p>내용 편집 모드 진입</p>
              </div>
            </div>

            <div className="gesture-item">
              <div className="gesture-icon">🎯</div>
              <div className="gesture-content">
                <h3>포스트잇 드래그</h3>
                <p>포스트잇 위치 이동</p>
              </div>
            </div>

            <div className="gesture-item">
              <div className="gesture-icon">☰</div>
              <div className="gesture-content">
                <h3>좌측 상단 햄버거 메뉴</h3>
                <p>세션 관리 및 설정</p>
              </div>
            </div>
          </div>

          <div className="gesture-tips">
            <h3>💡 팁</h3>
            <ul>
              <li>☰ 메뉴에서 세션 정보/연결 가이드 확인</li>
              <li>좌측 하단 컨트롤 패널로 줌 조절</li>
              <li>우측 하단 미니맵으로 전체 구조 파악</li>
              <li>포스트잇을 노드가 아닌 빈 공간에서 드래그하세요</li>
            </ul>
          </div>

          <button className="guide-action-button" onClick={handleClose}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileGestureGuide;
