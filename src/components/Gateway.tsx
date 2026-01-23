// src/components/Gateway.tsx - 새로운 UI/UX
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Search, Plus, Users, Clock, Settings, LogIn, X } from 'lucide-react';
import liveblocksService from '../services/LiveblocksService';
import AdminGateway from './AdminGateway';
import './ModalBase.css';
import './Gateway.css';

interface SessionInfo {
  code: string;
  name: string;
  userCount: number;
  lastActivity: string;
  isActive: boolean;
}

interface GatewayProps {
  children: ReactNode;
  onAuthenticated?: (sessionCode: string) => void;
}

const Gateway = ({ children, onAuthenticated }: GatewayProps) => {
  const LAST_SESSION_STORAGE_KEY = 'culture-map-last-session';
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 입력 상태
  const [newSessionName, setNewSessionName] = useState('');
  const [hostPassword, setHostPassword] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const persistLastSession = useCallback((code: string, isHost: boolean) => {
    localStorage.setItem(
      LAST_SESSION_STORAGE_KEY,
      JSON.stringify({ code, isHost })
    );
  }, []);

  const clearLastSession = useCallback(() => {
    localStorage.removeItem(LAST_SESSION_STORAGE_KEY);
  }, []);

  const handleDevModeAutoJoin = useCallback(async () => {
    try {
      await liveblocksService.joinSession('DEV-LOCAL', true, '개발 모드', 'workshop');
      setIsAuth(true);
      if (onAuthenticated) onAuthenticated('DEV-LOCAL');
    } catch (e) {
      console.error('Dev mode auto-join failed:', e);
    }
    setIsLoading(false);
  }, [onAuthenticated]);

  const loadSessions = useCallback(async () => {
    try {
      // Liveblocks 세션 레지스트리에서 로드
      const isDev = import.meta.env.VITE_APP_ENV === 'development';
      let registrySessions = await liveblocksService.getSessionRegistry();

      if (isDev && registrySessions.length === 0) {
        await liveblocksService.registerSession('DEV-LOCAL', '개발 모드', 'workshop');
        registrySessions = await liveblocksService.getSessionRegistry();
      }

      const formattedSessions = registrySessions.map(s => ({
        code: s.code,
        name: s.name,
        userCount: 0,
        lastActivity: new Date(s.createdAt).toLocaleString('ko-KR'),
        isActive: true
      }));
      setSessions(formattedSessions);
      console.log('📋 세션 레지스트리 로드:', formattedSessions.length, '개');
    } catch (err) {
      console.error('세션 레지스트리 로드 실패:', err);
      // 폴백: localStorage에서 로드
      const stored = localStorage.getItem('culture-map-sessions');
      if (stored) {
        try {
          setSessions(JSON.parse(stored));
        } catch {
          setSessions([]);
        }
      }
    }
  }, [setSessions]);

  // 초기화
  useEffect(() => {
    const init = async () => {
      const skipGate = import.meta.env.VITE_SKIP_GATE;
      console.log('🚪 [Gateway] VITE_SKIP_GATE 값:', skipGate, '타입:', typeof skipGate);

      if (skipGate === 'true') {
        console.log('🚪 [Gateway] 개발 모드 - 자동 연결');
        await handleDevModeAutoJoin();
        persistLastSession('DEV-LOCAL', true);
      } else {
        const stored = localStorage.getItem(LAST_SESSION_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as { code: string; isHost?: boolean };
            if (parsed.code) {
              console.log('🔁 [Gateway] 마지막 세션 자동 재접속 시도:', parsed.code);
              await liveblocksService.joinSession(parsed.code, parsed.isHost ?? false);
              setIsAuth(true);
              if (onAuthenticated) onAuthenticated(parsed.code);
              setIsLoading(false);
              return;
            }
          } catch {
            clearLastSession();
          }
        }

        console.log('🚪 [Gateway] 일반 모드 - 세션 목록 로드');
        await loadSessions();
        setIsLoading(false);
      }
    };
    init();
  }, [clearLastSession, handleDevModeAutoJoin, onAuthenticated, persistLastSession, loadSessions]);

  const saveSession = (session: SessionInfo) => {
    const updated = [...sessions.filter(s => s.code !== session.code), session];
    setSessions(updated);
    localStorage.setItem('culture-map-sessions', JSON.stringify(updated));
  };

  // 새 세션 생성
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 호스트 비밀번호 검증 (Liveblocks 설정 Room에서 가져옴)
      const isValid = await liveblocksService.validateHostPassword(hostPassword);

      if (!isValid) {
        setError('잘못된 호스트 비밀번호입니다. 관리자에게 문의하세요.');
        setIsSubmitting(false);
        return;
      }

      const code = await liveblocksService.createSession(newSessionName || '새 세션', 'workshop');

      persistLastSession(code, true);

      saveSession({
        code,
        name: newSessionName || '새 세션',
        userCount: 1,
        lastActivity: '방금 전',
        isActive: true,
      });

      setIsAuth(true);
      setShowCreateModal(false);
      if (onAuthenticated) onAuthenticated(code);
    } catch (err) {
      console.error('Session creation failed:', err);
      setError('세션 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 세션 입장
  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const code = sessionCode.toUpperCase();
      await liveblocksService.joinSession(code, false);
      persistLastSession(code, false);
      setIsAuth(true);
      setShowJoinModal(false);
      if (onAuthenticated) onAuthenticated(code);
    } catch (err) {
      console.error('Session join failed:', err);
      setError('세션 입장에 실패했습니다. 코드를 확인해주세요.');
      clearLastSession();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자 인증
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 환경변수에서 관리자 비밀번호 가져와서 비교
      const envAdminPassword = import.meta.env.VITE_GATEWAY_ADMIN_PASSWORD || 'admin';

      if (adminPassword === envAdminPassword) {
        setShowAdminModal(false);
        setShowAdminPanel(true);
        setAdminPassword(''); // 초기화
      } else {
        setError('관리자 비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setError('인증에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 필터링된 세션 목록
  const filteredSessions = sessions.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="gateway-container">
        <div className="gateway-loading">
          <div className="loading-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (showAdminPanel) {
    return <AdminGateway onBack={() => setShowAdminPanel(false)} />;
  }

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <div className="gateway-container">
      <div className="gateway-main">
        {/* 헤더 */}
        <div className="gateway-header">
          <div className="gateway-title-section">
            <h1 className="gateway-title">🏢 조직문화 분석기</h1>
            <p className="gateway-subtitle">Culture-MAP</p>
          </div>
          <button
            className="admin-icon-btn"
            onClick={() => {
              setError('');
              setShowAdminModal(true);
            }}
            title="관리자"
          >
            <Settings size={20} />
          </button>
        </div>

        {/* 액션 버튼들 */}
        <div className="gateway-actions">
          <button
            className="create-session-btn"
            onClick={() => {
              setError('');
              setShowCreateModal(true);
            }}
          >
            <Plus size={20} />
            새 세션 만들기
          </button>
          <button
            className="join-session-btn"
            onClick={() => {
              setError('');
              setShowJoinModal(true);
            }}
          >
            <LogIn size={20} />
            세션 코드로 입장
          </button>
        </div>

        {/* 세션 검색 */}
        <div className="session-search">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="세션 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* 세션 목록 */}
        <div className="session-list">
          <h3 className="session-list-title">📋 진행 중인 세션</h3>
          {filteredSessions.length === 0 ? (
            <div className="no-sessions">
              <p>진행 중인 세션이 없습니다.</p>
              <p className="hint">새 세션을 만들거나 세션 코드로 입장하세요.</p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div key={session.code} className="session-item">
                <div className="session-info">
                  <div className="session-name">
                    <span className={`status-dot ${session.isActive ? 'active' : ''}`}></span>
                    {session.name}
                  </div>
                  <div className="session-meta">
                    <span className="session-code">{session.code}</span>
                    <span className="session-users"><Users size={14} /> {session.userCount}명</span>
                    <span className="session-time"><Clock size={14} /> {session.lastActivity}</span>
                  </div>
                </div>
                <button
                  className="session-join-btn"
                  onClick={() => {
                    setSessionCode(session.code);
                    setError('');
                    setShowJoinModal(true);
                  }}
                >
                  입장
                </button>
              </div>
            ))
          )}
        </div>

        <div className="gateway-footer">
          <p>💡 세션에 입장하여 조직문화 맵을 함께 만들어보세요!</p>
        </div>
      </div>

      {/* 새 세션 만들기 모달 */}
      {showCreateModal && (
        <div className="cm-modal-overlay gateway-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="cm-modal gateway-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header gateway-modal-header">
              <h3 className="cm-modal-title">✨ 새 세션 만들기</h3>
              <button className="cm-modal-close gateway-modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSession}>
              <div className="form-group">
                <label>세션 이름</label>
                <input type="text" value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} placeholder="예: 1조 토론방" autoFocus />
              </div>
              <div className="form-group">
                <label>호스트 비밀번호</label>
                <input type="password" value={hostPassword} onChange={(e) => setHostPassword(e.target.value)} placeholder="할당받은 비밀번호 입력" required />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? '생성 중...' : '세션 생성'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 세션 입장 모달 */}
      {showJoinModal && (
        <div className="cm-modal-overlay gateway-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="cm-modal gateway-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header gateway-modal-header">
              <h3 className="cm-modal-title">🚀 세션 입장</h3>
              <button className="cm-modal-close gateway-modal-close" onClick={() => setShowJoinModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleJoinSession}>
              <div className="form-group">
                <label>세션 코드</label>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="6자리 코드 입력"
                  maxLength={20}
                  autoFocus
                  style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.5rem' }}
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowJoinModal(false)}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || sessionCode.length < 3}>{isSubmitting ? '입장 중...' : '입장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 관리자 인증 모달 */}
      {showAdminModal && (
        <div className="cm-modal-overlay gateway-modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="cm-modal gateway-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header gateway-modal-header">
              <h3 className="cm-modal-title">🔧 관리자 인증</h3>
              <button className="cm-modal-close gateway-modal-close" onClick={() => setShowAdminModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdminAuth}>
              <div className="form-group">
                <label>관리자 비밀번호</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="관리자 비밀번호 입력" autoFocus required />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAdminModal(false)}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? '인증 중...' : '인증'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gateway;
