import { useState, useEffect } from 'react';
import { isMobileDevice } from '../utils/deviceDetection';
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
    <div className="mobile-gesture-guide-overlay">
      <div className="mobile-gesture-guide">
        <button className="guide-close-button" onClick={handleClose}>
          ✕
        </button>
        
        <h2>📱 모바일 제스처 가이드</h2>
        
        <div className="gesture-list">
          <div className="gesture-item">
            <div className="gesture-icon">👆</div>
            <div className="gesture-content">
              <h3>한 손가락 드래그</h3>
              <p>캔버스 이동 (팬)</p>
            </div>
          </div>

          <div className="gesture-item">
            <div className="gesture-icon">🤏</div>
            <div className="gesture-content">
              <h3>핀치 제스처</h3>
              <p>확대/축소 (줌)</p>
            </div>
          </div>

          <div className="gesture-item">
            <div className="gesture-icon">👇</div>
            <div className="gesture-content">
              <h3>노드 탭</h3>
              <p>노드 선택</p>
            </div>
          </div>

          <div className="gesture-item">
            <div className="gesture-icon">✌️</div>
            <div className="gesture-content">
              <h3>노드 더블탭</h3>
              <p>편집 모드 진입</p>
            </div>
          </div>

          <div className="gesture-item">
            <div className="gesture-icon">👆</div>
            <div className="gesture-content">
              <h3>노드 드래그</h3>
              <p>노드 위치 이동</p>
            </div>
          </div>

          <div className="gesture-item">
            <div className="gesture-icon">🔗</div>
            <div className="gesture-content">
              <h3>핸들 연결</h3>
              <p>핸들을 드래그하여 노드 연결</p>
            </div>
          </div>
        </div>

        <div className="gesture-tips">
          <h3>💡 팁</h3>
          <ul>
            <li>좌측 상단 🔄 버튼으로 자동 정렬</li>
            <li>우측 하단 컨트롤 패널로 줌 조절</li>
            <li>미니맵으로 전체 구조 파악</li>
          </ul>
        </div>

        <button className="guide-action-button" onClick={handleClose}>
          시작하기
        </button>
      </div>
    </div>
  );
};

export default MobileGestureGuide;
