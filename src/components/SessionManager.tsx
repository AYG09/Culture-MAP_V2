import React, { useState, useEffect } from 'react';
import FirebaseMultiUserService from '../services/FirebaseMultiUserService';
import SessionInfoPanel from './SessionInfoPanel';
import './SessionManager.css';

interface SessionManagerProps {
  onSessionJoined: (sessionCode: string, isHost: boolean) => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({ onSessionJoined }) => {
  const [showModal, setShowModal] = useState(true);
  const [sessionCode, setSessionCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [currentSession, setCurrentSession] = useState<unknown>(null);
  const [showConnectionGuide, setShowConnectionGuide] = useState(false);

  useEffect(() => {
    // 멀티유저 서비스 이벤트 리스너 등록
    FirebaseMultiUserService.on('user-joined', (data: unknown) => {
      console.log('👋 User joined:', data);
      setCurrentSession(prev => (prev ? { ...prev, connectedUsers: data.userCount } : null));
    });

    FirebaseMultiUserService.on('user-left', (data: unknown) => {
      console.log('👋 User left:', data);
      setCurrentSession(prev => (prev ? { ...prev, connectedUsers: data.userCount } : null));
    });

    FirebaseMultiUserService.on('error', (error: unknown) => {
      setError(error.message || 'An error occurred');
    });

    return () => {
      FirebaseMultiUserService.off('user-joined', () => {});
      FirebaseMultiUserService.off('user-left', () => {});
      FirebaseMultiUserService.off('error', () => {});
    };
  }, []);

  const createSession = async () => {
    setIsCreating(true);
    setError('');

    try {
      const code = await FirebaseMultiUserService.createSession();
      FirebaseMultiUserService.joinSession(code, true);

      const sessionData = {
        code,
        isHost: true,
        connectedUsers: 1,
      };

      setCurrentSession(sessionData);
      setShowModal(false);
      onSessionJoined(code, true);
    } catch (err) {
      setError('세션 생성에 실패했습니다.');
      console.error('Failed to create session:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const joinSession = async () => {
    if (!sessionCode.trim()) {
      setError('세션 코드를 입력해주세요.');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const isValid = await FirebaseMultiUserService.validateSession(sessionCode.toUpperCase());
      if (!isValid) {
        setError('유효하지 않은 세션 코드입니다.');
        return;
      }

      FirebaseMultiUserService.joinSession(sessionCode.toUpperCase(), false);

      const sessionData = {
        code: sessionCode.toUpperCase(),
        isHost: false,
        connectedUsers: 1,
      };

      setCurrentSession(sessionData);
      setShowModal(false);
      onSessionJoined(sessionCode.toUpperCase(), false);
    } catch (err) {
      setError('세션 참가에 실패했습니다.');
      console.error('Failed to join session:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const leaveSession = () => {
    FirebaseMultiUserService.disconnect();
    setCurrentSession(null);
    setShowModal(true);
    setSessionCode('');
    setError('');
  };

  if (!showModal && currentSession) {
    return (
      <>
        <div className="session-info">
          <div className="session-status">
            <span className="session-code">세션: {currentSession.code}</span>
            <span className="user-count">👥 {currentSession.connectedUsers}명 접속 중</span>
            <span
              className={`connection-status ${FirebaseMultiUserService.isConnected() ? 'connected' : 'disconnected'}`}
            >
              {FirebaseMultiUserService.isConnected() ? '🟢 연결됨' : '🔴 연결 끊어짐'}
            </span>
            <button
              onClick={() => setShowConnectionGuide(true)}
              className="info-btn"
              title="접속 안내 보기"
            >
              📋 접속 안내
            </button>
            <button onClick={leaveSession} className="leave-btn">
              세션 나가기
            </button>
          </div>
        </div>

        {showConnectionGuide && (
          <div className="connection-guide-overlay">
            <SessionInfoPanel
              sessionCode={currentSession.code}
              isHost={currentSession.isHost}
              connectedUsers={currentSession.connectedUsers}
              onClose={() => setShowConnectionGuide(false)}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="session-modal-overlay">
      <div className="session-modal">
        <h2>🤝 멀티유저 세션</h2>
        <p>동료들과 함께 조직문화를 분석하세요!</p>

        {error && <div className="error-message">{error}</div>}

        <div className="session-options">
          <div className="create-session">
            <h3>새 세션 만들기</h3>
            <p>새로운 분석 세션을 시작하고 다른 사용자를 초대하세요.</p>
            <button onClick={createSession} disabled={isCreating} className="create-btn">
              {isCreating ? '생성 중...' : '세션 생성'}
            </button>
          </div>

          <div className="join-session">
            <h3>기존 세션 참가</h3>
            <p>이미 생성된 세션에 참가하세요.</p>
            <div className="input-group">
              <input
                type="text"
                placeholder="세션 코드 입력 (예: ABC123)"
                value={sessionCode}
                onChange={e => setSessionCode(e.target.value.toUpperCase())}
                onKeyPress={e => e.key === 'Enter' && joinSession()}
                maxLength={6}
              />
              <button onClick={joinSession} disabled={isValidating} className="join-btn">
                {isValidating ? '확인 중...' : '참가'}
              </button>
            </div>
          </div>
        </div>

        <div className="session-info-text">
          <p>
            💡 <strong>팁:</strong> 모든 참가자는 동일한 WiFi 네트워크에 연결되어 있어야 합니다.
          </p>
          <p>🔄 실시간으로 스티키 노트, 분석 데이터, 프로젝트가 동기화됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
