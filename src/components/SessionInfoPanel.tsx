import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import './SessionInfoPanel.css';

interface SessionInfoPanelProps {
  sessionCode: string;
  isHost: boolean;
  connectedUsers: number;
  onClose?: () => void;
}

const SessionInfoPanel: React.FC<SessionInfoPanelProps> = ({
  sessionCode,
  isHost,
  connectedUsers,
  onClose,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [localIP, setLocalIP] = useState<string>('');

  useEffect(() => {
    generateQRCode();
    getLocalIP();
  }, [sessionCode]);

  const generateQRCode = async () => {
    try {
      const url = `${window.location.origin}?multiuser=true&session=${sessionCode}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('QR코드 생성 실패:', error);
    }
  };

  const getLocalIP = () => {
    // 서버에서 사용하는 IP 주소를 가져오기 (간단한 방법)
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      setLocalIP('localhost');
    } else {
      setLocalIP(host);
    }
  };

  const copySessionCode = () => {
    navigator.clipboard.writeText(sessionCode);
    // 간단한 피드백 (실제로는 toast 등을 사용할 수 있음)
    alert('세션 코드가 복사되었습니다!');
  };

  const copyUrl = () => {
    const url = `${window.location.origin}?multiuser=true&session=${sessionCode}`;
    navigator.clipboard.writeText(url);
    alert('접속 URL이 복사되었습니다!');
  };

  return (
    <div className="session-info-panel">
      <div className="session-info-header">
        <h3>🤝 세션 접속 안내</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="session-details">
        <div className="session-code-section">
          <h4>세션 코드</h4>
          <div className="session-code-display">
            <span className="code">{sessionCode}</span>
            <button onClick={copySessionCode} className="copy-btn">
              📋 복사
            </button>
          </div>
        </div>

        <div className="connection-info">
          <div className="status-info">
            <p>
              <span className="label">역할:</span>
              <span className={`role ${isHost ? 'host' : 'participant'}`}>
                {isHost ? '👑 호스트' : '👤 참가자'}
              </span>
            </p>
            <p>
              <span className="label">접속자:</span>
              <span className="user-count">👥 {connectedUsers}명</span>
            </p>
          </div>
        </div>

        <div className="qr-section">
          <h4>📱 모바일 접속용 QR코드</h4>
          {qrCodeUrl && (
            <div className="qr-code-container">
              <img src={qrCodeUrl} alt="세션 접속 QR코드" className="qr-code" />
              <p className="qr-instruction">
                모바일에서 QR코드를 스캔하면 바로 세션에 참가할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        <div className="manual-connection">
          <h4>💻 수동 접속 방법</h4>
          <div className="connection-urls">
            <div className="url-item">
              <span className="url-label">컴퓨터:</span>
              <div className="url-display">
                <code>http://localhost:5178?multiuser=true&session={sessionCode}</code>
                <button onClick={copyUrl} className="copy-btn-small">
                  📋
                </button>
              </div>
            </div>

            {localIP !== 'localhost' && (
              <div className="url-item">
                <span className="url-label">같은 네트워크:</span>
                <div className="url-display">
                  <code>
                    http://{localIP}:5178?multiuser=true&session={sessionCode}
                  </code>
                  <button onClick={copyUrl} className="copy-btn-small">
                    📋
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="instructions">
          <h4>📋 참가 방법</h4>
          <ol>
            <li>
              <strong>QR코드 스캔:</strong> 모바일에서 위 QR코드를 스캔
            </li>
            <li>
              <strong>URL 직접 입력:</strong> 위 주소를 브라우저에 직접 입력
            </li>
            <li>
              <strong>세션 코드 입력:</strong> 메인 화면에서 "{sessionCode}" 입력
            </li>
          </ol>

          <div className="tips">
            <h5>💡 팁</h5>
            <ul>
              <li>모든 기기가 같은 Wi-Fi에 연결되어 있어야 합니다</li>
              <li>세션은 2시간 후 자동으로 만료됩니다</li>
              <li>실시간으로 모든 변경사항이 동기화됩니다</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionInfoPanel;
