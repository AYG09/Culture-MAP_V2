// src/components/AdminGateway.tsx - 단순화된 관리자 패널
import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Trash2, Users, Clock, Key, Save, Eye, EyeOff } from 'lucide-react';
import liveblocksService from '../services/LiveblocksService';
import './AdminGateway.css';

interface AdminGatewayProps {
  onBack: () => void;
}

interface SessionInfo {
  code: string;
  name: string;
  userCount: number;
  lastActivity: string;
  createdAt: string;
  type: string;
}

const AdminGateway = ({ onBack }: AdminGatewayProps) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 호스트 비밀번호 설정
  const [hostPassword, setHostPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // 초기 로드
  useEffect(() => {
    loadSessions();
    loadHostPassword();
  }, []);

  // 호스트 비밀번호 로드 (Liveblocks에서)
  const loadHostPassword = async () => {
    try {
      const saved = await liveblocksService.getHostPassword();
      if (saved) {
        setHostPassword(saved);
      }
    } catch (err) {
      console.error('호스트 비밀번호 로드 실패:', err);
    }
  };

  // 호스트 비밀번호 저장 (Liveblocks에)
  const saveHostPassword = async () => {
    if (!hostPassword.trim()) {
      setSaveMessage('❌ 비밀번호를 입력하세요.');
      return;
    }
    
    setSaving(true);
    setSaveMessage('');
    try {
      await liveblocksService.setHostPassword(hostPassword.trim());
      setSaveMessage('✅ 저장되었습니다! (모든 사용자에게 적용됨)');
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      console.error('호스트 비밀번호 저장 실패:', err);
      setSaveMessage('❌ 저장 실패. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 세션 목록 로드
  const loadSessions = async () => {
    setLoading(true);
    try {
      // localStorage에서 세션 목록 가져오기
      const stored = localStorage.getItem('culture-map-sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSessions(parsed);
      } else {
        setSessions([]);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 세션 삭제
  const handleDeleteSession = async (code: string, name: string) => {
    if (!window.confirm(`세션 "${name}" (${code})을(를) 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // Liveblocks에서 세션 삭제 시도
      try {
        await liveblocksService.deleteSession(code);
      } catch {
        // Liveblocks 삭제 실패해도 로컬에서는 삭제
        console.warn('Liveblocks 세션 삭제 실패 (무시)');
      }
      
      // localStorage에서 세션 제거
      const stored = localStorage.getItem('culture-map-sessions');
      if (stored) {
        const sessions = JSON.parse(stored);
        const updated = sessions.filter((s: SessionInfo) => s.code !== code);
        localStorage.setItem('culture-map-sessions', JSON.stringify(updated));
      }
      
      // 목록 새로고침
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 삭제에 실패했습니다.');
    }
  };

  // 모든 세션 삭제
  const handleClearAllSessions = () => {
    if (!window.confirm('모든 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    localStorage.removeItem('culture-map-sessions');
    setSessions([]);
  };

  // 시간 포맷
  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="admin-gateway-container">
      {/* 헤더 */}
      <div className="admin-header">
        <button onClick={onBack} className="back-btn">
          <ArrowLeft size={20} />
          뒤로 가기
        </button>
        <div className="header-title">
          <h2>⚙️ 관리자 설정</h2>
          <p>호스트 비밀번호 및 세션을 관리합니다</p>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* 호스트 비밀번호 설정 섹션 */}
      <section className="admin-section">
        <h3><Key size={18} /> 호스트 비밀번호 설정</h3>
        <p className="section-description">
          새 세션 생성 시 필요한 호스트 비밀번호입니다. 
          이 비밀번호를 아는 사람만 새로운 세션을 만들 수 있습니다.
        </p>
        
        <div className="password-form">
          <div className="password-input-group">
            <input
              type={showPassword ? 'text' : 'password'}
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              placeholder="호스트 비밀번호 입력"
              className="password-input"
            />
            <button 
              type="button" 
              className="toggle-visibility-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button 
            onClick={saveHostPassword} 
            disabled={saving}
            className="save-btn"
          >
            <Save size={16} />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
        {saveMessage && <p className="save-message">{saveMessage}</p>}
      </section>

      {/* 세션 관리 섹션 */}
      <section className="admin-section">
        <div className="section-header">
          <h3><Users size={18} /> 세션 관리 ({sessions.length}개)</h3>
          <div className="section-actions">
            <button onClick={loadSessions} className="refresh-btn" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              새로고침
            </button>
            {sessions.length > 0 && (
              <button onClick={handleClearAllSessions} className="clear-all-btn">
                <Trash2 size={16} />
                전체 삭제
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <RefreshCw size={24} className="spinning" />
            <p>로딩 중...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <p>등록된 세션이 없습니다.</p>
            <p className="hint">Gateway에서 새 세션을 만들면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div key={session.code} className="session-card">
                <div className="session-main">
                  <div className="session-name-row">
                    <span className="session-name">{session.name || '이름 없음'}</span>
                    <code className="session-code">{session.code}</code>
                  </div>
                  <div className="session-meta">
                    <span><Users size={14} /> {session.userCount || 0}명</span>
                    <span><Clock size={14} /> {formatTime(session.lastActivity || session.createdAt)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteSession(session.code, session.name)}
                  className="delete-session-btn"
                  title="세션 삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 안내 */}
      <div className="admin-footer">
        <p>💡 <strong>팁:</strong> 호스트 비밀번호는 클라우드에 저장되어 모든 사용자가 공유합니다. 강사에게 이 비밀번호를 알려주세요.</p>
      </div>
    </div>
  );
};

export default AdminGateway;
