import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import liveblocksService from '../services/LiveblocksService';
import './SessionInfoPanel.css';

interface SessionInfoPanelProps {
  sessionCode: string;
  sessionName?: string;
  isHost: boolean;
  connectedUsers: number;
  onClose?: () => void;
  onRoleChanged?: () => void;
}

const SessionInfoPanel: React.FC<SessionInfoPanelProps> = ({
  sessionCode,
  sessionName,
  isHost,
  connectedUsers,
  onClose,
  onRoleChanged,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [localIP, setLocalIP] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(sessionName || `세션 ${sessionCode}`);
  const [localIsHost, setLocalIsHost] = useState(isHost);
  const [hostPasswordInput, setHostPasswordInput] = useState('');
  const [hostClaimMessage, setHostClaimMessage] = useState<string | null>(null);
  const [isClaimingHost, setIsClaimingHost] = useState(false);

  const sessionQuery = `?multiuser=true&session=${sessionCode}`;
  const originUrl = `${window.location.origin}${sessionQuery}`;
  const portSegment = window.location.port ? `:${window.location.port}` : '';
  const networkUrl =
    localIP && localIP !== 'localhost'
      ? `${window.location.protocol}//${localIP}${portSegment}${sessionQuery}`
      : null;

  useEffect(() => {
    generateQRCode();
    getLocalIP();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  useEffect(() => {
    setLocalIsHost(isHost);
  }, [isHost]);

  const generateQRCode = async () => {
    try {
      const qrDataUrl = await QRCode.toDataURL(originUrl, {
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

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      alert(successMessage);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const copySessionCode = () => {
    void copyText(sessionCode, '세션 코드가 복사되었습니다!');
  };

  const copyOriginUrl = () => {
    void copyText(originUrl, '세션 공유 URL이 복사되었습니다!');
  };

  const copyNetworkUrl = () => {
    if (networkUrl) {
      void copyText(networkUrl, '같은 네트워크 접속 URL이 복사되었습니다!');
    }
  };

  const handleSaveSessionName = async () => {
    if (!editedName.trim()) {
      alert('세션 이름을 입력해주세요.');
      return;
    }

    try {
      await liveblocksService.updateSessionName(sessionCode, editedName.trim());
      setIsEditingName(false);
      alert('세션 이름이 변경되었습니다!');
    } catch (error) {
      console.error('세션 이름 변경 실패:', error);
      alert('세션 이름 변경에 실패했습니다.');
    }
  };

  const handleClaimHost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = hostPasswordInput.trim();
    if (!password) {
      setHostClaimMessage('호스트 비밀번호를 입력해주세요.');
      return;
    }

    setIsClaimingHost(true);
    setHostClaimMessage(null);
    try {
      const valid = await liveblocksService.claimHostWithPassword(password);
      if (!valid) {
        setHostClaimMessage('비밀번호가 일치하지 않습니다.');
        return;
      }

      setLocalIsHost(true);
      setHostPasswordInput('');
      setHostClaimMessage('호스트 권한을 획득했습니다.');
      onRoleChanged?.();
    } catch (error) {
      console.error('호스트 권한 획득 실패:', error);
      const message = error instanceof Error ? error.message : '호스트 권한 획득에 실패했습니다.';
      setHostClaimMessage(message);
    } finally {
      setIsClaimingHost(false);
    }
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
        {/* 세션 이름 섹션 */}
        <div className="session-name-section">
          <h4>세션 이름</h4>
          {isEditingName ? (
            <div className="session-name-edit">
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                placeholder="세션 이름을 입력하세요"
                autoFocus
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
              <button onClick={handleSaveSessionName} style={{ padding: '8px 16px' }}>
                💾 저장
              </button>
              <button onClick={() => setIsEditingName(false)} style={{ padding: '8px 16px' }}>
                ✕ 취소
              </button>
            </div>
          ) : (
            <div className="session-name-display">
              <span className="name">{editedName}</span>
              {localIsHost && (
                <button onClick={() => setIsEditingName(true)} className="edit-btn">
                  ✏️ 편집
                </button>
              )}
            </div>
          )}
        </div>

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
              <span className={`role ${localIsHost ? 'host' : 'participant'}`}>
                {localIsHost ? '👑 호스트' : '👤 참가자'}
              </span>
            </p>
            <p>
              <span className="label">접속자:</span>
              <span className="user-count">👥 {connectedUsers}명</span>
            </p>
          </div>
        </div>

        {localIsHost ? (
          <div className="host-claim-section host-owned">
            <h4>🔐 호스트 권한</h4>
            <p className="host-claim-description">
              현재 브라우저는 이 세션의 호스트 권한을 보유하고 있습니다.
            </p>
            {hostClaimMessage && (
              <div className="host-claim-message success">
                {hostClaimMessage}
              </div>
            )}
          </div>
        ) : (
          <div className="host-claim-section">
            <h4>🔐 호스트 권한 획득</h4>
            <p className="host-claim-description">
              관리자 화면에서 설정한 호스트 비밀번호를 입력하면 현재 브라우저가 이 세션의 호스트 권한을 갖습니다.
            </p>
            <form className="host-claim-form" onSubmit={handleClaimHost}>
              <input
                type="password"
                value={hostPasswordInput}
                onChange={(event) => setHostPasswordInput(event.target.value)}
                placeholder="호스트 비밀번호"
                autoComplete="current-password"
                disabled={isClaimingHost}
              />
              <button type="submit" disabled={isClaimingHost}>
                {isClaimingHost ? '확인 중...' : '호스트 되기'}
              </button>
            </form>
            {hostClaimMessage && (
              <div className={`host-claim-message ${localIsHost ? 'success' : 'error'}`}>
                {hostClaimMessage}
              </div>
            )}
          </div>
        )}

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
              <span className="url-label">현재 페이지:</span>
              <div className="url-display">
                <code>{originUrl}</code>
                <button onClick={copyOriginUrl} className="copy-btn-small">
                  📋
                </button>
              </div>
            </div>

            {networkUrl && (
              <div className="url-item">
                <span className="url-label">같은 네트워크:</span>
                <div className="url-display">
                  <code>{networkUrl}</code>
                  <button onClick={copyNetworkUrl} className="copy-btn-small">
                    📋
                  </button>
                </div>
              </div>
            )}

            {localIP === 'localhost' && (
              <p className="manual-tip">
                같은 네트워크 기기에서 접속하려면 위 주소의 <code>localhost</code>를 호스트 컴퓨터의
                IP(예: <code>192.168.0.10</code>)로 바꿔 입력해주세요.
              </p>
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
            <li>
              <strong>링크 공유:</strong> 복사 버튼으로 얻은 URL을 메신저나 이메일로 전달
            </li>
          </ol>

          <div className="tips">
            <h5>💡 팁</h5>
            <ul>
              <li>인터넷 연결만 있으면 전 세계 어디서나 접속 가능합니다</li>
              <li>로컬 네트워크(같은 Wi-Fi)에서는 더 빠른 속도로 접속할 수 있습니다</li>
              <li>세션 코드 또는 URL 공유 시 즉시 참가 가능합니다</li>
              <li>실시간으로 모든 변경사항이 Liveblocks를 통해 동기화됩니다</li>
              <li>편집 중인 포스트잇은 자동으로 잠금되어 충돌을 방지합니다</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionInfoPanel;
