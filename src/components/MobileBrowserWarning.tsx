import React, { useState, useEffect } from 'react';
import './MobileBrowserWarning.css';

const MobileBrowserWarning: React.FC = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // 모바일 앱 내 브라우저(WebView) 감지
    const detectInAppBrowser = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      console.log('🔍 User Agent:', navigator.userAgent); // 디버깅용
      
      const isInAppBrowser = 
        userAgent.includes('kakao') ||         // 카카오톡
        userAgent.includes('kakaotalk') ||     // 카카오톡 (다른 표기)
        userAgent.includes('instagram') ||     // 인스타그램
        userAgent.includes('fban') ||          // 페이스북
        userAgent.includes('fbav') ||          // 페이스북 앱
        userAgent.includes('messenger') ||     // 메신저
        userAgent.includes('line') ||          // 라인
        userAgent.includes('micromessenger') || // 위챗
        userAgent.includes('wv') ||            // WebView
        // 추가 패턴들
        (userAgent.includes('mobile') && userAgent.includes('safari') && !userAgent.includes('crios') && !userAgent.includes('fxios'));

      console.log('🚨 In-app browser detected:', isInAppBrowser); // 디버깅용

      if (isInAppBrowser) {
        setCurrentUrl(window.location.href);
        setShowWarning(true);
      }
    };

    detectInAppBrowser();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      alert('URL이 복사되었습니다! 브라우저에 붙여넣기 하세요.');
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      // 수동 선택 방식으로 대체
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('URL이 복사되었습니다! 브라우저에 붙여넣기 하세요.');
    }
  };

  if (!showWarning) return null;

  return (
    <div className="mobile-browser-warning-overlay">
      <div className="mobile-browser-warning">
        <div className="warning-icon">⚠️</div>
        <h2>브라우저 변경 필요</h2>
        <p>
          현재 앱 내 브라우저에서는<br/>
          <strong>구글 보안 정책</strong>으로 인해<br/>
          일부 기능이 제한될 수 있습니다.
        </p>
        
        <div className="solution-steps">
          <h3>해결 방법:</h3>
          <ol>
            <li><strong>Safari</strong> 또는 <strong>Chrome</strong> 브라우저를 열어주세요</li>
            <li>아래 버튼으로 URL을 복사하세요</li>
            <li>브라우저 주소창에 붙여넣기 하세요</li>
          </ol>
        </div>

        <div className="action-buttons">
          <button onClick={copyToClipboard} className="copy-btn">
            📋 URL 복사하기
          </button>
          <button onClick={() => setShowWarning(false)} className="continue-btn">
            그래도 계속하기
          </button>
        </div>

        <div className="browser-info">
          <small>
            권장 브라우저: Safari, Chrome, Firefox, Edge<br/>
            현재 브라우저: {navigator.userAgent.includes('kakao') ? '카카오톡' : 
                        navigator.userAgent.includes('instagram') ? '인스타그램' : 
                        navigator.userAgent.includes('fban') ? '페이스북' : '앱 내 브라우저'}
          </small>
        </div>
      </div>
    </div>
  );
};

export default MobileBrowserWarning;