import React, { useState, useEffect } from 'react';
import liveblocksService from '../services/LiveblocksService';
import type { PasswordType } from '../services/GatewayAdminService';
import type { SessionType } from '../types/liveblocks';
import { formatRelativeTime } from '../utils/timeFormat';
import './SessionManager.css';

interface SessionManagerProps {
  showModal?: boolean;
  onClose?: () => void;
  initialSessionCode?: string;
  onSessionJoined?: (sessionCode: string, isHost: boolean) => void;
  passwordType?: PasswordType;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  showModal: externalShowModal,
  onClose,
  initialSessionCode,
  onSessionJoined,
  passwordType = 'workshop'
}) => {
  const [showModal, setShowModal] = useState(externalShowModal ?? false);
  const [sessionCode, setSessionCode] = useState(initialSessionCode || '');
  const [isCreating, setIsCreating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [currentSession, setCurrentSession] = useState<{
    code: string;
    isHost: boolean;
    connectedUsers: number;
    name?: string;
  } | null>(null);
  const [sessionName, setSessionName] = useState('');

  // externalShowModal 변경 시 showModal 동기화
  useEffect(() => {
    if (externalShowModal !== undefined) {
      setShowModal(externalShowModal);
    }
  }, [externalShowModal]);

  // initialSessionCode가 있으면 자동으로 입장 시도
  useEffect(() => {
    if (initialSessionCode && !currentSession) {
      setSessionCode(initialSessionCode);
    }
  }, [initialSessionCode, currentSession]);

  useEffect(() => {
    // Liveblocks 서비스 이벤트 리스너 등록
    const handleUserJoined = (data: unknown) => {
      const userData = data as { userId: string; userName?: string };
      console.log('👋 User joined:', userData);
      const session = liveblocksService.getCurrentSession();
      if (session) {
        setCurrentSession(prev => prev ? { ...prev, connectedUsers: session.connectedUsers } : null);
      }
    };

    const handleUserLeft = (data: unknown) => {
      const userData = data as { userId: string };
      console.log('👋 User left:', userData);
      const session = liveblocksService.getCurrentSession();
      if (session) {
        setCurrentSession(prev => prev ? { ...prev, connectedUsers: session.connectedUsers } : null);
      }
    };

    liveblocksService.on('user-joined', handleUserJoined);
    liveblocksService.on('user-left', handleUserLeft);

    return () => {
      liveblocksService.off('user-joined', handleUserJoined);
      liveblocksService.off('user-left', handleUserLeft);
    };
  }, []);

  const createSession = async () => {
    setIsCreating(true);
    setError('');

    try {
      const name = sessionName.trim() || undefined;
      // passwordType을 sessionType으로 변환 (admin은 consulting으로 처리)
      const sessionType: SessionType = passwordType === 'admin' ? 'consulting' : passwordType as SessionType;

      const code = await liveblocksService.createSession(name, sessionType);

      const sessionData = {
        code,
        isHost: true,
        connectedUsers: 1,
        name: name || `세션 ${code}`,
      };

      setCurrentSession(sessionData);
      setShowModal(false);
      onSessionJoined?.(code, true);
      onClose?.();
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
      const upperCode = sessionCode.toUpperCase();
      // validateSession 대신 joinSession을 직접 호출하여 존재 여부 확인 (room 입장 시 실패하면 catch로 이동)
      await liveblocksService.joinSession(upperCode, false);

      const sessionData = {
        code: upperCode,
        isHost: false,
        connectedUsers: 1,
      };

      setCurrentSession(sessionData);
      setShowModal(false);
      onSessionJoined?.(upperCode, false);
      onClose?.();
    } catch (err) {
      setError('세션 참가에 실패했습니다. 코드를 확인해주세요.');
      console.error('Failed to join session:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // 세션 참가 후에는 모달만 표시
  if (!showModal) {
    return null;
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
            <div className="input-group">
              <input
                type="text"
                placeholder="세션 이름 (선택사항)"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                maxLength={50}
                className="session-name-input"
              />
            </div>
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
            💡 <strong>팁:</strong> 세션 코드를 공유하면 누구나 참가할 수 있습니다.
          </p>
          <p>🔄 실시간으로 스티키 노트와 분석 데이터가 동기화됩니다.</p>
          <p>💾 오프라인에서도 작업하고 나중에 동기화할 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
