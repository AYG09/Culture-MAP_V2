// src/components/AdminGateway.tsx
import { useState, useEffect } from 'react';
import gatewayAdminService, { type GatewayPassword, type PasswordType } from '../services/GatewayAdminService';
import FirebaseMultiUserService, { type SessionMetadata } from '../services/FirebaseMultiUserService';
import './AdminGateway.css';

interface AdminGatewayProps {
  onBack: () => void;
}

type TabType = 'passwords' | 'sessions';

const AdminGateway = ({ onBack }: AdminGatewayProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('passwords');
  const [passwords, setPasswords] = useState<GatewayPassword[]>([]);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // 새 비밀번호 폼 상태
  const [newPassword, setNewPassword] = useState({
    password: '',
    description: '',
    type: 'workshop' as PasswordType,  // 초기값: 워크샵 모드 (사용자가 명시적으로 선택하도록 유도)
    expireHours: 24,
    maxUses: '',
    autoGenerate: false,
  });

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadPasswords();
    loadSessions();

    // 실시간 업데이트 리스닝
    const unsubscribe = gatewayAdminService.onPasswordsChange((updatedPasswords) => {
      setPasswords(updatedPasswords);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 임시 비밀번호 목록 로드
  const loadPasswords = async () => {
    setLoading(true);
    try {
      const allPasswords = await gatewayAdminService.getAllPasswords();
      setPasswords(allPasswords);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 세션 목록 로드
  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await FirebaseMultiUserService.getActiveSessions(100);  // 최대 100개
      setSessions(allSessions);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 세션 삭제
  const handleDeleteSession = async (code: string) => {
    if (!window.confirm(`세션 "${code}"를 삭제하시겠습니까?\n(해당 세션의 비밀번호도 함께 삭제됩니다)`)) {
      return;
    }

    try {
      // 1. 세션 코드와 연결된 비밀번호 먼저 삭제
      await gatewayAdminService.deletePasswordBySessionCode(code);
      
      // 2. 세션 삭제
      await FirebaseMultiUserService.deleteSession(code);
      
      // 3. 목록 새로고침
      await loadSessions();
      await loadPasswords();
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 삭제에 실패했습니다.');
    }
  };

  // 새 비밀번호 생성
  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const passwordToUse = newPassword.autoGenerate
        ? gatewayAdminService.generateRandomPassword()
        : newPassword.password;

      if (!passwordToUse) {
        setError('비밀번호를 입력하거나 자동 생성을 선택하세요.');
        setCreating(false);
        return;
      }

      await gatewayAdminService.createPassword({
        password: passwordToUse,
        type: newPassword.type,  // 추가: 비밀번호 타입
        description: newPassword.description || undefined,
        expireHours: newPassword.expireHours,
        maxUses: newPassword.maxUses ? parseInt(newPassword.maxUses) : undefined,
      });

      setShowCreateForm(false);
      resetForm();
      alert(`비밀번호가 생성되었습니다: ${passwordToUse}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  // 비밀번호 삭제
  const handleDeletePassword = async (id: string, password: string) => {
    if (!window.confirm(`비밀번호 "${password}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await gatewayAdminService.deletePassword(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 삭제에 실패했습니다.');
    }
  };

  // 폼 리셋
  const resetForm = () => {
    setNewPassword({
      password: '',
      description: '',
      type: 'workshop' as PasswordType,  // 추가: 기본값
      expireHours: 24,
      maxUses: '',
      autoGenerate: false,
    });
  };

  // 자동 생성 토글
  const handleAutoGenerateToggle = () => {
    const autoGenerate = !newPassword.autoGenerate;
    setNewPassword({
      ...newPassword,
      autoGenerate,
      password: autoGenerate ? gatewayAdminService.generateRandomPassword() : '',
    });
  };

  // 비밀번호 복사
  const handleCopyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      alert('비밀번호가 복사되었습니다!');
    } catch {
      alert('복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  // 시간 포맷팅
  const formatTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = expiresAt - now;

    if (diff <= 0) return '만료됨';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}일 ${hours % 24}시간`;
    }

    return `${hours}시간 ${minutes}분`;
  };

  // 사용 정보 포맷팅
  const formatUsageInfo = (pwd: GatewayPassword): string => {
    if (pwd.maxUses) {
      return `${pwd.usedCount}/${pwd.maxUses}회`;
    }
    return `${pwd.usedCount}회`;
  };

  return (
    <div className="admin-gateway-container">
      <div className="admin-header">
        <div>
          <h2>🔐 Gateway 관리자 패널</h2>
          <p>임시 비밀번호와 세션을 생성하고 관리할 수 있습니다.</p>
        </div>
        <button onClick={onBack} className="back-btn">
          ← 뒤로 가기
        </button>
      </div>

      {error && (
        <div className="admin-error-message">
          {error}
          <button onClick={() => setError('')} className="error-close">
            ×
          </button>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'passwords' ? 'active' : ''}`}
          onClick={() => setActiveTab('passwords')}
        >
          🔑 비밀번호 관리
        </button>
        <button
          className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          📂 세션 관리
        </button>
      </div>

      {/* 비밀번호 관리 탭 */}
      {activeTab === 'passwords' && (
        <>
          {/* 새 비밀번호 생성 버튼 */}
          <div className="admin-actions">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="create-password-btn"
            >
              {showCreateForm ? '취소' : '✨ 새 비밀번호 생성'}
            </button>
            <button onClick={loadPasswords} className="refresh-btn" disabled={loading}>
              {loading ? '🔄 새로고침 중...' : '🔄 새로고침'}
            </button>
          </div>

          {/* 비밀번호 생성 폼 */}
          {showCreateForm && (
        <div className="create-form-container">
          <h3>새 임시 비밀번호 생성</h3>
          <form onSubmit={handleCreatePassword} className="create-form">
            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newPassword.autoGenerate}
                    onChange={handleAutoGenerateToggle}
                  />
                  자동 생성
                </label>
              </div>
            </div>

            {!newPassword.autoGenerate ? (
              <div className="form-group">
                <label>비밀번호:</label>
                <input
                  type="text"
                  value={newPassword.password}
                  onChange={(e) => setNewPassword({ ...newPassword, password: e.target.value })}
                  placeholder="비밀번호 입력"
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label>생성된 비밀번호:</label>
                <div className="generated-password">
                  <code>{newPassword.password}</code>
                  <button
                    type="button"
                    onClick={() =>
                      setNewPassword({
                        ...newPassword,
                        password: gatewayAdminService.generateRandomPassword(),
                      })
                    }
                    className="regenerate-btn"
                  >
                    🔄 다시 생성
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>설명:</label>
              <input
                type="text"
                value={newPassword.description}
                onChange={(e) => setNewPassword({ ...newPassword, description: e.target.value })}
                placeholder="비밀번호 용도 설명 (선택사항)"
              />
            </div>

            {/* 비밀번호 타입 선택 - 필수 선택 사항 */}
            <div className="password-type-selector">
              <h4>📌 비밀번호 타입 <span className="required">*</span></h4>
              <p className="type-description">생성할 비밀번호의 용도를 선택하세요. 각 타입은 다른 권한을 가집니다.</p>
              <div className="mode-options">
                <label className={newPassword.type === 'workshop' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="passwordType"
                    value="workshop"
                    checked={newPassword.type === 'workshop'}
                    onChange={() => setNewPassword({ ...newPassword, type: 'workshop' })}
                  />
                  <span className="type-label">🎓 워크샵 모드</span>
                  <span className="type-detail">포스트잇 기반 분석, 3단계 프롬프트</span>
                </label>

                <label className={newPassword.type === 'consulting' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="passwordType"
                    value="consulting"
                    checked={newPassword.type === 'consulting'}
                    onChange={() => setNewPassword({ ...newPassword, type: 'consulting' })}
                  />
                  <span className="type-label">💼 컨설팅 모드</span>
                  <span className="type-detail">인터뷰 기반 분석, 6단계 프롬프트</span>
                </label>

                <label className={newPassword.type === 'admin' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="passwordType"
                    value="admin"
                    checked={newPassword.type === 'admin'}
                    onChange={() => setNewPassword({ ...newPassword, type: 'admin' })}
                  />
                  <span className="type-label">🔑 관리자 모드</span>
                  <span className="type-detail">어드민 패널 접근 권한</span>
                </label>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>유효 시간 (시간):</label>
                <input
                  type="number"
                  value={newPassword.expireHours}
                  onChange={(e) =>
                    setNewPassword({ ...newPassword, expireHours: parseInt(e.target.value) })
                  }
                  min="1"
                  max="8760"
                />
              </div>
              <div className="form-group">
                <label>최대 사용 횟수:</label>
                <input
                  type="number"
                  value={newPassword.maxUses}
                  onChange={(e) => setNewPassword({ ...newPassword, maxUses: e.target.value })}
                  placeholder="무제한"
                  min="1"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={creating} className="submit-btn">
                {creating ? '⏳ 생성 중...' : '✅ 생성'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                className="cancel-btn"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 비밀번호 목록 */}
      <div className="passwords-container">
        <h3>📋 임시 비밀번호 목록 ({passwords.length}개)</h3>

        {loading ? (
          <div className="loading">⏳ 비밀번호 목록을 불러오는 중...</div>
        ) : passwords.length === 0 ? (
          <div className="no-passwords">등록된 임시 비밀번호가 없습니다.</div>
        ) : (
          <div className="passwords-list">
            {passwords.map((pwd) => (
              <div key={pwd.id} className={`password-item ${pwd.status}`}>
                <div className="password-header">
                  <div className="password-main">
                    <code
                      className="password-text"
                      onClick={() => handleCopyPassword(pwd.password)}
                      title="클릭하여 복사"
                    >
                      {pwd.password}
                    </code>
                    <span className={`status-badge ${pwd.status}`}>
                      {pwd.status === 'active' ? '✅ 활성' : pwd.status === 'expired' ? '⏰ 만료' : '🚫 소진'}
                    </span>
                    <span className={`type-badge type-${pwd.type}`}>
                      {pwd.type === 'workshop' ? '🎓 워크샵' : 
                       pwd.type === 'consulting' ? '� 컨설팅' : '🔑 관리자'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeletePassword(pwd.id, pwd.password)}
                    className="delete-btn"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>

                <div className="password-details">
                  {pwd.description && <p className="description">{pwd.description}</p>}
                  {pwd.sessionCode && (
                    <p className="session-code">세션 코드: {pwd.sessionCode}</p>
                  )}
                  <div className="meta-info">
                    <span>🕐 생성: {new Date(pwd.createdAt).toLocaleString()}</span>
                    <span>⏰ 만료: {formatTimeRemaining(pwd.expiresAt)}</span>
                    <span>📊 사용: {formatUsageInfo(pwd)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* 세션 관리 탭 */}
      {activeTab === 'sessions' && (
        <>
          <div className="admin-actions">
            <button onClick={loadSessions} className="refresh-btn" disabled={loading}>
              {loading ? '🔄 새로고침 중...' : '🔄 새로고침'}
            </button>
          </div>

          <div className="sessions-container">
            <h3>📂 활성 세션 목록 ({sessions.length}개)</h3>

            {loading ? (
              <div className="loading">⏳ 세션 목록을 불러오는 중...</div>
            ) : sessions.length === 0 ? (
              <div className="no-sessions">활성 세션이 없습니다.</div>
            ) : (
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div key={session.code} className="session-item">
                    <div className="session-header">
                      <div className="session-main">
                        <code className="session-code-text">{session.code}</code>
                        <span className={`type-badge type-${session.type}`}>
                          {session.type === 'workshop' ? '🎓 워크샵' : '💼 컨설팅'}
                        </span>
                        <span className="user-count">👥 {session.userCount}명</span>
                      </div>
                      <button
                        onClick={() => handleDeleteSession(session.code)}
                        className="delete-btn"
                        title="세션 삭제"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="session-details">
                      <p className="session-name">{session.name}</p>
                      <div className="meta-info">
                        <span>🕐 생성: {new Date(session.createdAt).toLocaleString()}</span>
                        <span>⏰ 마지막 활동: {new Date(session.lastActivity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminGateway;
