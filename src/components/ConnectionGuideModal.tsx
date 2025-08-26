import React, { useState, useEffect } from 'react';
import './ConnectionGuideModal.css';

interface ConnectionGuideModalProps {
  sessionCode: string;
  onClose: () => void;
}

const ConnectionGuideModal: React.FC<ConnectionGuideModalProps> = ({ sessionCode, onClose }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [networkUrl, setNetworkUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 네트워크 접근 가능한 URL 생성
  useEffect(() => {
    const generateNetworkUrl = async () => {
      const currentHost = window.location.hostname;
      const currentPort = window.location.port;
      const currentPath = window.location.pathname;

      // Firebase 모드가 아닌 경우에만 서버에서 네트워크 정보 가져오기 시도
      const isFirebaseMode = import.meta.env.MODE === 'firebase';
      if (!isFirebaseMode) {
        try {
          const response = await fetch('/api/network-info');
          if (response.ok) {
            const data = await response.json();
            console.log('서버에서 네트워크 정보 받음:', data);
            setNetworkUrl(data.multiuserUrl);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.log('서버 API 호출 실패, 클라이언트에서 IP 감지 시도:', error);
        }
      }

      // Firebase 모드에서는 간단한 URL 처리, 그 외에는 클라이언트에서 IP 감지
      if (isFirebaseMode) {
        // Firebase 모드에서는 현재 URL 기반으로 간단하게 처리
        setNetworkUrl(`${window.location.origin}${currentPath}?multiuser=true`);
      } else if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        // WebRTC를 사용해 로컬 IP 감지 시도
        try {
          const localIp = await getLocalIP();
          if (localIp && localIp !== '127.0.0.1') {
            setNetworkUrl(`http://${localIp}:${currentPort}${currentPath}?multiuser=true`);
          } else {
            setNetworkUrl(`${window.location.origin}${currentPath}?multiuser=true`);
          }
        } catch (error) {
          console.error('로컬 IP 감지 실패:', error);
          setNetworkUrl(`${window.location.origin}${currentPath}?multiuser=true`);
        }
      } else {
        // 이미 IP 주소인 경우
        setNetworkUrl(`${window.location.origin}${currentPath}?multiuser=true`);
      }

      setIsLoading(false);
    };

    generateNetworkUrl();
  }, []);

  // WebRTC를 사용한 로컬 IP 감지
  const getLocalIP = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pc.createDataChannel('');

      pc.onicecandidate = event => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (match) {
            const ip = match[0];
            if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
              pc.close();
              resolve(ip);
            }
          }
        }
      };

      pc.createOffer().then(offer => pc.setLocalDescription(offer));

      // 5초 후 타임아웃
      setTimeout(() => {
        pc.close();
        reject(new Error('IP 감지 타임아웃'));
      }, 5000);
    });
  };

  const qrCodeUrl = networkUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(networkUrl)}`
    : '';

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      // 폴백: 텍스트 선택
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    }
  };

  return (
    <div className="connection-guide-overlay">
      <div className="connection-guide-modal">
        <div className="modal-header">
          <h2>🤝 접속 안내</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="connection-section">
            <h3>📱 QR코드로 접속</h3>
            <div className="qr-section">
              {isLoading ? (
                <div className="loading">🔄 QR코드 생성 중...</div>
              ) : qrCodeUrl ? (
                <>
                  <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
                  <p>스마트폰으로 QR코드를 스캔하세요</p>
                  {(networkUrl.includes('localhost') || networkUrl.includes('127.0.0.1')) && (
                    <p className="warning-text">
                      ⚠️ QR코드가 localhost 주소를 포함합니다. 모바일에서 접속이 안될 수 있습니다.
                    </p>
                  )}
                </>
              ) : (
                <div className="error">QR코드 생성 실패</div>
              )}
            </div>
          </div>

          <div className="connection-section">
            <h3>🌐 사이트 주소</h3>
            <div className="url-section">
              {isLoading ? (
                <div className="loading">🔄 네트워크 주소를 확인하는 중...</div>
              ) : (
                <>
                  <div className="url-input-group">
                    <input type="text" value={networkUrl} readOnly className="url-input" />
                    <button
                      onClick={() => copyToClipboard(networkUrl, 'url')}
                      className={`copy-btn ${copiedUrl ? 'copied' : ''}`}
                    >
                      {copiedUrl ? '✅ 복사됨!' : '📋 복사'}
                    </button>
                  </div>
                  <p className="help-text">
                    {networkUrl.includes('localhost') || networkUrl.includes('127.0.0.1')
                      ? '⚠️ 모바일 접속이 어려울 수 있습니다. QR코드를 사용하거나 세션 코드로 접속해보세요.'
                      : '위 주소를 공유하여 동료들을 초대하세요'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="connection-section">
            <h3>🔑 세션 코드</h3>
            <div className="session-code-section">
              <div className="code-display">
                <span className="session-code-large">{sessionCode}</span>
                <button
                  onClick={() => copyToClipboard(sessionCode, 'code')}
                  className={`copy-btn ${copiedCode ? 'copied' : ''}`}
                >
                  {copiedCode ? '✅ 복사됨!' : '📋 복사'}
                </button>
              </div>
              <p className="help-text">동료들이 이 코드를 입력하여 참가할 수 있습니다</p>
            </div>
          </div>

          <div className="connection-info">
            <div className="info-box">
              <h4>💡 접속 방법</h4>
              <ol>
                <li>동료들에게 위 사이트 주소를 공유하거나</li>
                <li>QR코드를 스캔하도록 하거나</li>
                <li>세션 코드를 알려주세요</li>
              </ol>
              <p>
                <strong>주의:</strong> 모든 참가자는 동일한 WiFi 네트워크에 연결되어 있어야 합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionGuideModal;
