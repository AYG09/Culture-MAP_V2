// src/components/Gateway.tsx - 기업별 폴더 구조 UI
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Search, Plus, Users, Clock, Settings, LogIn, X, Folder, ArrowLeft, Building2 } from 'lucide-react';
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
  organization?: string;
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

  // 폴더 구조 상태
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // 1번 게이트 (기업 폴더 비밀번호)
  const [showOrgPasswordModal, setShowOrgPasswordModal] = useState(false);
  const [pendingOrg, setPendingOrg] = useState<string | null>(null);
  const [orgPassword, setOrgPassword] = useState('');
  const [bypassedByMasterKey, setBypassedByMasterKey] = useState(false);

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 입력 상태
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionCode, setNewSessionCode] = useState('');
  const [newSessionOrg, setNewSessionOrg] = useState('');
  const [hostPassword, setHostPassword] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizeSessionCode = useCallback((code: string) => {
    return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  }, []);

  const isValidSessionCode = useCallback((code: string) => {
    return /^[A-Z0-9-]{3,12}$/.test(code);
  }, []);

  const generateRandomSessionCode = useCallback(() => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }, []);

  const persistLastSession = useCallback((code: string, isHost: boolean) => {
    localStorage.setItem(
      LAST_SESSION_STORAGE_KEY,
      JSON.stringify({ code, isHost })
    );
  }, []);

  const clearLastSession = useCallback(() => {
    localStorage.removeItem(LAST_SESSION_STORAGE_KEY);
  }, []);

  const handleSkipGateAutoJoin = useCallback(async () => {
    try {
      const stored = localStorage.getItem(LAST_SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { code: string; isHost?: boolean };
          if (parsed.code) {
            console.log('🔁 [Gateway] 마지막 세션 자동 재접속 시도:', parsed.code);
            await liveblocksService.joinSession(parsed.code, parsed.isHost ?? false);
            setIsAuth(true);
            if (onAuthenticated) onAuthenticated(parsed.code);
            return;
          }
        } catch {
          clearLastSession();
        }
      }

      const code = await liveblocksService.createSession('새 세션', 'workshop');
      persistLastSession(code, true);
      setIsAuth(true);
      if (onAuthenticated) onAuthenticated(code);
    } catch (e) {
      console.error('Skip gate auto-join failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [clearLastSession, onAuthenticated, persistLastSession]);

  const loadSessions = useCallback(async () => {
    try {
      // Liveblocks 세션 레지스트리에서 로드
      let registrySessions = await liveblocksService.getSessionRegistry();

      const formattedSessions = registrySessions.map(s => ({
        code: s.code,
        name: s.name,
        userCount: 0,
        lastActivity: new Date(s.createdAt).toLocaleString('ko-KR'),
        isActive: true,
        organization: s.organization
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

  // 기업별 그룹화
  const organizationGroups = useMemo(() => {
    const groups: Record<string, SessionInfo[]> = {};
    sessions.forEach(session => {
      const org = session.organization || '미분류';
      if (!groups[org]) {
        groups[org] = [];
      }
      groups[org].push(session);
    });
    // 기업명 정렬 (미분류는 맨 뒤로)
    const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
      if (a === '미분류') return 1;
      if (b === '미분류') return -1;
      return a.localeCompare(b, 'ko');
    });
    return sortedEntries;
  }, [sessions]);

  // 현재 보여줄 세션 (폴더 선택 시 해당 기업만)
  const currentSessions = useMemo(() => {
    if (!selectedOrg) return [];
    return sessions.filter(s => (s.organization || '미분류') === selectedOrg);
  }, [sessions, selectedOrg]);

  // 검색 필터링 (폴더 또는 세션)
  const filteredOrganizations = useMemo(() => {
    if (!searchQuery) return organizationGroups;
    const query = searchQuery.toLowerCase();
    return organizationGroups.filter(([org, orgSessions]) =>
      org.toLowerCase().includes(query) ||
      orgSessions.some(s => s.name.toLowerCase().includes(query))
    );
  }, [organizationGroups, searchQuery]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return currentSessions;
    const query = searchQuery.toLowerCase();
    return currentSessions.filter(s =>
      s.name.toLowerCase().includes(query)
    );
  }, [currentSessions, searchQuery]);

  // 기존 기업 목록 (세션 생성 시 드롭다운용)
  const existingOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    sessions.forEach(s => {
      if (s.organization && s.organization !== '미분류') {
        orgs.add(s.organization);
      }
    });
    return Array.from(orgs).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [sessions]);

  // 초기화
  useEffect(() => {
    const init = async () => {
      const skipGate = import.meta.env.VITE_SKIP_GATE;
      console.log('🚪 [Gateway] VITE_SKIP_GATE 값:', skipGate, '타입:', typeof skipGate);

      if (skipGate === 'true') {
        console.log('🚪 [Gateway] 게이트웨이 스킵 - 자동 연결');
        await handleSkipGateAutoJoin();
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
  }, [clearLastSession, handleSkipGateAutoJoin, onAuthenticated, loadSessions]);

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

      const normalizedCode = newSessionCode ? normalizeSessionCode(newSessionCode) : '';
      if (normalizedCode && !isValidSessionCode(normalizedCode)) {
        setError('세션 코드는 3~12자 영문/숫자/하이픈만 사용할 수 있습니다.');
        setIsSubmitting(false);
        return;
      }

      // 기업명 필수 체크
      const orgName = newSessionOrg.trim();
      if (!orgName) {
        setError('기업명을 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      if (normalizedCode) {
        const registry = await liveblocksService.getSessionRegistry();
        const isDuplicate = registry.some((session) => session.code === normalizedCode);
        if (isDuplicate) {
          setError('이미 사용 중인 세션 코드입니다. 다른 코드를 입력해주세요.');
          setIsSubmitting(false);
          return;
        }
      }

      const code = await liveblocksService.createSession(
        newSessionName || '새 세션',
        'workshop',
        normalizedCode || undefined,
        orgName
      );

      persistLastSession(code, true);

      saveSession({
        code,
        name: newSessionName || '새 세션',
        userCount: 1,
        lastActivity: '방금 전',
        isActive: true,
        organization: orgName,
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

  // 1번 게이트: 기업 폴더 클릭 핸들러
  const handleFolderClick = async (org: string) => {
    // 미분류는 비밀번호 검증 스킵
    if (org === '미분류') {
      setSelectedOrg(org);
      setSearchQuery('');
      return;
    }

    // 이미 마스터키로 통과했으면 바로 진입
    if (bypassedByMasterKey) {
      setSelectedOrg(org);
      setSearchQuery('');
      return;
    }

    // 비밀번호 설정 여부 확인
    const hasPassword = await liveblocksService.getOrganizationPassword(org);
    if (!hasPassword) {
      // 비밀번호 미설정 시 바로 진입
      setSelectedOrg(org);
      setSearchQuery('');
      return;
    }

    // 비밀번호 모달 표시
    setPendingOrg(org);
    setOrgPassword('');
    setError('');
    setShowOrgPasswordModal(true);
  };

  // 1번 게이트: 비밀번호 검증
  const handleOrgPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOrg) return;

    setError('');
    setIsSubmitting(true);

    try {
      // 마스터키 먼저 확인
      const isMasterKey = await liveblocksService.validateMasterKey(orgPassword);
      if (isMasterKey) {
        setBypassedByMasterKey(true);
        setSelectedOrg(pendingOrg);
        setSearchQuery('');
        setShowOrgPasswordModal(false);
        setPendingOrg(null);
        setOrgPassword('');
        return;
      }

      // 기업 비밀번호 확인
      const isValid = await liveblocksService.validateOrganizationPassword(pendingOrg, orgPassword);
      if (isValid) {
        setSelectedOrg(pendingOrg);
        setSearchQuery('');
        setShowOrgPasswordModal(false);
        setPendingOrg(null);
        setOrgPassword('');
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      console.error('Password validation failed:', err);
      setError('비밀번호 검증에 실패했습니다.');
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
              setNewSessionName('');
              setNewSessionCode('');
              setNewSessionOrg('');
              setHostPassword('');
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
            placeholder={selectedOrg ? "세션 검색..." : "기업/세션 검색..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* 폴더/세션 목록 */}
        <div className="session-list">
          {selectedOrg ? (
            // 특정 기업의 세션 목록
            <>
              <div className="folder-header">
                <button className="back-btn" onClick={() => { setSelectedOrg(null); setSearchQuery(''); }}>
                  <ArrowLeft size={18} />
                </button>
                <h3 className="session-list-title">
                  <Building2 size={18} /> {selectedOrg}
                </h3>
              </div>
              {filteredSessions.length === 0 ? (
                <div className="no-sessions">
                  <p>세션이 없습니다.</p>
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
                        <span className="session-time"><Clock size={14} /> {session.lastActivity}</span>
                      </div>
                    </div>
                    <button
                      className="session-join-btn"
                      onClick={async () => {
                        // 마스터키로 바이패스 시 바로 입장
                        if (bypassedByMasterKey) {
                          try {
                            await liveblocksService.joinSession(session.code, false);
                            persistLastSession(session.code, false);
                            setIsAuth(true);
                            if (onAuthenticated) onAuthenticated(session.code);
                          } catch (err) {
                            console.error('Session join failed:', err);
                            setError('세션 입장에 실패했습니다.');
                          }
                          return;
                        }
                        // 일반 사용자는 코드 입력 모달
                        setSessionCode('');
                        setError('');
                        setShowJoinModal(true);
                      }}
                    >
                      {bypassedByMasterKey ? '바로 입장' : '입장'}
                    </button>
                  </div>
                ))
              )}
            </>
          ) : (
            // 기업 폴더 목록
            <>
              <h3 className="session-list-title">📁 기업별 세션</h3>
              {filteredOrganizations.length === 0 ? (
                <div className="no-sessions">
                  <p>등록된 세션이 없습니다.</p>
                  <p className="hint">새 세션을 만들거나 세션 코드로 입장하세요.</p>
                </div>
              ) : (
                filteredOrganizations.map(([org, orgSessions]) => (
                  <div
                    key={org}
                    className="folder-item"
                    onClick={() => handleFolderClick(org)}
                  >
                    <div className="folder-info">
                      <Folder size={24} className="folder-icon" />
                      <div className="folder-details">
                        <span className="folder-name">{org}</span>
                        <span className="folder-count">{orgSessions.length}개 세션</span>
                      </div>
                    </div>
                    <ArrowLeft size={18} className="folder-arrow" style={{ transform: 'rotate(180deg)' }} />
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="gateway-footer">
          <p>💡 세션에 입장하려면 접속 코드가 필요합니다. 관리자에게 문의하세요.</p>
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
                <label>세션 코드 (선택)</label>
                <div className="session-code-row">
                  <input
                    type="text"
                    value={newSessionCode}
                    onChange={(e) => setNewSessionCode(normalizeSessionCode(e.target.value))}
                    placeholder="자동 생성됨"
                    maxLength={12}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    className="session-code-btn"
                    onClick={() => {
                      setError('');
                      setNewSessionCode(generateRandomSessionCode());
                    }}
                  >
                    랜덤
                  </button>
                </div>
                <div className="session-code-help">3~12자 영문/숫자/하이픈 사용 가능. 비워두면 자동 생성됩니다.</div>
              </div>
              <div className="form-group">
                <label>기업명 (필수)</label>
                <div className="org-input-row">
                  <input
                    type="text"
                    value={newSessionOrg}
                    onChange={(e) => setNewSessionOrg(e.target.value)}
                    placeholder="예: 삼양KCI"
                    list="org-suggestions"
                    required
                  />
                  <datalist id="org-suggestions">
                    {existingOrganizations.map(org => (
                      <option key={org} value={org} />
                    ))}
                  </datalist>
                </div>
                <div className="session-code-help">기존 기업명을 선택하거나 새로 입력하세요.</div>
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

      {/* 1번 게이트: 기업 폴더 비밀번호 모달 */}
      {showOrgPasswordModal && (
        <div className="cm-modal-overlay gateway-modal-overlay" onClick={() => setShowOrgPasswordModal(false)}>
          <div className="cm-modal gateway-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header gateway-modal-header">
              <h3 className="cm-modal-title">🔐 {pendingOrg} 접근</h3>
              <button className="cm-modal-close gateway-modal-close" onClick={() => setShowOrgPasswordModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleOrgPasswordSubmit}>
              <div className="form-group">
                <label>비밀번호 또는 마스터키</label>
                <input
                  type="password"
                  value={orgPassword}
                  onChange={(e) => setOrgPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  autoFocus
                  required
                />
                <p className="form-hint">기업 접근 비밀번호 또는 마스터키를 입력하세요.</p>
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowOrgPasswordModal(false)}>취소</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || !orgPassword}>
                  {isSubmitting ? '확인 중...' : '확인'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gateway;
