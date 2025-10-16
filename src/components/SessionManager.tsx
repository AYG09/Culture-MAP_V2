import React, { useState, useEffect } from 'react';
import FirebaseMultiUserService, { type SessionMetadata } from '../services/FirebaseMultiUserService';
import type { PasswordType } from '../services/GatewayAdminService';
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
  passwordType = 'workshop'  // 기본값 workshop
}) => {
  const [showModal, setShowModal] = useState(externalShowModal ?? true);
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
  const [activeSessions, setActiveSessions] = useState<SessionMetadata[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
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
      // 자동 참가는 사용자가 명시적으로 버튼을 클릭하도록 유도
    }
  }, [initialSessionCode, currentSession]);

  useEffect(() => {
    // 멀티유저 서비스 이벤트 리스너 등록
    const handleUserJoined = (...args: unknown[]) => {
      const data = args[0] as { userCount: number };
      console.log('👋 User joined:', data);
      setCurrentSession(prev => (prev ? { ...prev, connectedUsers: data.userCount } : null));
    };

    const handleUserLeft = (...args: unknown[]) => {
      const data = args[0] as { userCount: number };
      console.log('👋 User left:', data);
      setCurrentSession(prev => (prev ? { ...prev, connectedUsers: data.userCount } : null));
    };

    const handleError = (...args: unknown[]) => {
      const error = args[0] as { message?: string };
      setError(error.message || 'An error occurred');
    };

    FirebaseMultiUserService.on('user-joined', handleUserJoined);
    FirebaseMultiUserService.on('user-left', handleUserLeft);
    FirebaseMultiUserService.on('error', handleError);

    return () => {
      FirebaseMultiUserService.off('user-joined', handleUserJoined);
      FirebaseMultiUserService.off('user-left', handleUserLeft);
      FirebaseMultiUserService.off('error', handleError);
    };
  }, []);

  // 활성 세션 목록 로드
  useEffect(() => {
    if (!showModal) return;
    
    setIsLoadingSessions(true);
    
    // 실시간 리스너 설정
    const unsubscribe = FirebaseMultiUserService.onActiveSessions(
      (sessions) => {
        setActiveSessions(sessions);
        setIsLoadingSessions(false);
      },
      10
    );

    return () => {
      unsubscribe();
    };
  }, [showModal]);

  const createSession = async () => {
    setIsCreating(true);
    setError('');

    try {
      const name = sessionName.trim() || undefined;
      // passwordType을 sessionType으로 변환 (admin은 consulting으로 처리)
      const sessionType = passwordType === 'admin' ? 'consulting' : passwordType;
      const code = await FirebaseMultiUserService.createSession(name, sessionType);
      FirebaseMultiUserService.joinSession(code, true);

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
      onSessionJoined?.(sessionCode.toUpperCase(), false);
      onClose?.();
    } catch (err) {
      setError('세션 참가에 실패했습니다.');
      console.error('Failed to join session:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const joinActiveSession = async (code: string) => {
    setIsValidating(true);
    setError('');

    try {
      FirebaseMultiUserService.joinSession(code, false);

      const sessionData = {
        code,
        isHost: false,
        connectedUsers: 1,
      };

      setCurrentSession(sessionData);
      setShowModal(false);
      onSessionJoined?.(code, false);
      onClose?.();
    } catch (err) {
      setError('세션 참가에 실패했습니다.');
      console.error('Failed to join session:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // 세션 참가 후에는 모달만 표시 (상단 세션 박스 제거)
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

        {/* 활성 세션 목록 */}
        {activeSessions.length > 0 && (
          <div className="active-sessions">
            <h3>🔥 활성 세션 목록</h3>
            <p className="sessions-subtitle">최근 2시간 이내 활동한 세션</p>
            <div className="sessions-list">
              {isLoadingSessions ? (
                <div className="loading">로딩 중...</div>
              ) : (
                activeSessions.map(session => (
                  <div key={session.code} className="session-item">
                    <div className="session-item-header">
                      <span className="session-item-name">{session.name}</span>
                      <span className="session-item-code">{session.code}</span>
                    </div>
                    <div className="session-item-meta">
                      <span className="session-item-users">👥 {session.userCount}명</span>
                      <span className="session-item-time">
                        {session.lastActivity
                          ? formatRelativeTime(session.lastActivity)
                          : formatRelativeTime(session.createdAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => joinActiveSession(session.code)}
                      className="session-item-join-btn"
                      disabled={isValidating}
                    >
                      참가하기
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="session-info-text">
          <p>
            💡 <strong>팁:</strong> 세션 코드를 공유하면 누구나 참가할 수 있습니다.
          </p>
          <p>🔄 실시간으로 스티키 노트, 분석 데이터, 프로젝트가 동기화됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
