// src/components/AdminGateway.tsx - 단순화된 관리자 패널
import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Trash2, Users, Clock, Key, Save, Eye, EyeOff, Cloud, AlertTriangle, Building2, Edit3, Check, X } from 'lucide-react';
import liveblocksService from '../services/LiveblocksService';
import liveblocksAdminService from '../services/LiveblocksAdminService';
import type { LiveblocksRoom } from '../services/LiveblocksAdminService';
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
  organization?: string;
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

  // Liveblocks 클라우드 룸 관리
  const [cloudRooms, setCloudRooms] = useState<LiveblocksRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [deletingRooms, setDeletingRooms] = useState(false);

  // 조직 마이그레이션
  const [editingOrgCode, setEditingOrgCode] = useState<string | null>(null);
  const [editingOrgValue, setEditingOrgValue] = useState('');
  const [bulkOrg, setBulkOrg] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [migratingOrg, setMigratingOrg] = useState(false);

  // 기존 조직 목록 (자동완성용)
  const existingOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    sessions.forEach(s => {
      if (s.organization) orgs.add(s.organization);
    });
    return Array.from(orgs).sort();
  }, [sessions]);

  // 초기 로드
  useEffect(() => {
    loadSessions();
    loadHostPassword();
    loadCloudRooms();
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
      const registrySessions = await liveblocksService.getSessionRegistry();
      const formattedSessions = registrySessions.map((session) => ({
        code: session.code,
        name: session.name,
        userCount: 0,
        lastActivity: new Date(session.createdAt).toLocaleString('ko-KR'),
        createdAt: new Date(session.createdAt).toISOString(),
        type: session.type,
        organization: session.organization || ''
      }));
      setSessions(formattedSessions);
      setError('');
    } catch (err) {
      try {
        const stored = localStorage.getItem('culture-map-sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSessions(parsed);
        } else {
          setSessions([]);
        }
        setError('');
      } catch (fallbackError) {
        setError(fallbackError instanceof Error ? fallbackError.message : '세션 목록을 불러올 수 없습니다.');
      }
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
      await liveblocksService.unregisterSession(code);

      const stored = localStorage.getItem('culture-map-sessions');
      if (stored) {
        const sessions = JSON.parse(stored) as SessionInfo[];
        const updated = sessions.filter((session) => session.code !== code);
        localStorage.setItem('culture-map-sessions', JSON.stringify(updated));
      }

      const lastSession = localStorage.getItem('culture-map-last-session');
      if (lastSession) {
        try {
          const parsed = JSON.parse(lastSession) as { code?: string };
          if (parsed.code === code) {
            localStorage.removeItem('culture-map-last-session');
          }
        } catch {
          localStorage.removeItem('culture-map-last-session');
        }
      }

      // 목록 새로고침
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 삭제에 실패했습니다.');
    }
  };

  // 모든 세션 삭제
  const handleClearAllSessions = async () => {
    if (!window.confirm('모든 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const codes = sessions.map((session) => session.code);
      await Promise.all(codes.map((code) => liveblocksService.unregisterSession(code)));
    } catch (err) {
      console.warn('⚠️ 레지스트리 전체 삭제 중 일부 실패:', err);
    }

    localStorage.removeItem('culture-map-sessions');
    localStorage.removeItem('culture-map-last-session');
    await loadSessions();
  };

  // 단일 세션 조직 수정 시작
  const startEditOrg = (session: SessionInfo) => {
    setEditingOrgCode(session.code);
    setEditingOrgValue(session.organization || '');
  };

  // 단일 세션 조직 저장
  const saveEditOrg = async () => {
    if (!editingOrgCode) return;
    try {
      await liveblocksService.updateSessionOrganization(editingOrgCode, editingOrgValue);
      setEditingOrgCode(null);
      setEditingOrgValue('');
      await loadSessions();
    } catch (err) {
      console.error('조직 업데이트 실패:', err);
      setError('조직 업데이트에 실패했습니다.');
    }
  };

  // 조직 수정 취소
  const cancelEditOrg = () => {
    setEditingOrgCode(null);
    setEditingOrgValue('');
  };

  // 세션 선택 토글
  const toggleSessionSelection = (code: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // 전체 세션 선택/해제
  const toggleSelectAllSessions = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.code)));
    }
  };

  // 선택된 세션 일괄 조직 마이그레이션
  const handleBulkMigration = async () => {
    if (selectedSessions.size === 0 || !bulkOrg.trim()) {
      setError('세션을 선택하고 조직명을 입력하세요.');
      return;
    }
    if (!window.confirm(`선택된 ${selectedSessions.size}개 세션을 "${bulkOrg}" 조직으로 마이그레이션하시겠습니까?`)) {
      return;
    }

    setMigratingOrg(true);
    try {
      await liveblocksService.bulkUpdateSessionOrganization(
        Array.from(selectedSessions),
        bulkOrg.trim()
      );
      setSelectedSessions(new Set());
      setBulkOrg('');
      await loadSessions();
    } catch (err) {
      console.error('일괄 마이그레이션 실패:', err);
      setError('일괄 마이그레이션에 실패했습니다.');
    } finally {
      setMigratingOrg(false);
    }
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

  // 클라우드 룸 목록 로드
  const loadCloudRooms = async () => {
    setLoadingRooms(true);
    try {
      const rooms = await liveblocksAdminService.listRooms();
      const cultureMapRooms = liveblocksAdminService.filterCultureMapRooms(rooms);
      setCloudRooms(cultureMapRooms);
    } catch (err) {
      console.error('클라우드 룸 로드 실패:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // 클라우드 룸 선택 토글
  const toggleRoomSelection = (roomId: string) => {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedRooms.size === cloudRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(cloudRooms.map(r => r.id)));
    }
  };

  // 선택된 룸 삭제
  const handleDeleteSelectedRooms = async () => {
    if (selectedRooms.size === 0) return;
    if (!window.confirm(`선택된 ${selectedRooms.size}개의 룸을 삭제하시겠습니까?`)) return;

    setDeletingRooms(true);
    try {
      const results = await liveblocksAdminService.deleteRooms(Array.from(selectedRooms));
      const successCount = results.filter(r => r.success).length;
      alert(`${successCount}/${selectedRooms.size}개 룸 삭제 완료`);
      setSelectedRooms(new Set());
      await loadCloudRooms();
    } catch (err) {
      setError('룸 삭제 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setDeletingRooms(false);
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
          <>
            {/* 일괄 마이그레이션 도구 */}
            <div className="bulk-migration-bar">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={selectedSessions.size === sessions.length && sessions.length > 0}
                  onChange={toggleSelectAllSessions}
                />
                전체 선택 ({selectedSessions.size}/{sessions.length})
              </label>
              {selectedSessions.size > 0 && (
                <div className="bulk-migration-form">
                  <input
                    type="text"
                    value={bulkOrg}
                    onChange={(e) => setBulkOrg(e.target.value)}
                    placeholder="조직명 입력"
                    list="admin-org-suggestions"
                  />
                  <datalist id="admin-org-suggestions">
                    {existingOrganizations.map(org => (
                      <option key={org} value={org} />
                    ))}
                  </datalist>
                  <button
                    onClick={handleBulkMigration}
                    disabled={migratingOrg || !bulkOrg.trim()}
                    className="migrate-btn"
                  >
                    <Building2 size={14} />
                    {migratingOrg ? '이동 중...' : '일괄 이동'}
                  </button>
                </div>
              )}
            </div>

            <div className="sessions-list">
              {sessions.map((session) => (
                <div key={session.code} className={`session-card ${selectedSessions.has(session.code) ? 'selected' : ''}`}>
                  <label className="session-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.code)}
                      onChange={() => toggleSessionSelection(session.code)}
                    />
                  </label>
                  <div className="session-main">
                    <div className="session-name-row">
                      <span className="session-name">{session.name || '이름 없음'}</span>
                      <code className="session-code">{session.code}</code>
                    </div>
                    <div className="session-org-row">
                      {editingOrgCode === session.code ? (
                        <div className="org-edit-form">
                          <input
                            type="text"
                            value={editingOrgValue}
                            onChange={(e) => setEditingOrgValue(e.target.value)}
                            placeholder="조직명"
                            list="admin-org-suggestions"
                            autoFocus
                          />
                          <button onClick={saveEditOrg} className="save-org-btn" title="저장">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEditOrg} className="cancel-org-btn" title="취소">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="org-display">
                          <Building2 size={12} />
                          <span className={session.organization ? '' : 'no-org'}>
                            {session.organization || '미지정'}
                          </span>
                          <button
                            onClick={() => startEditOrg(session)}
                            className="edit-org-btn"
                            title="조직 수정"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                      )}
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
          </>
        )}
      </section>

      {/* 클라우드 룸 관리 섹션 */}
      <section className="admin-section">
        <div className="section-header">
          <h3><Cloud size={18} /> 클라우드 룸 관리 ({cloudRooms.length}개)</h3>
          <div className="section-actions">
            <button onClick={loadCloudRooms} className="refresh-btn" disabled={loadingRooms}>
              <RefreshCw size={16} className={loadingRooms ? 'spinning' : ''} />
              새로고침
            </button>
            {selectedRooms.size > 0 && (
              <button onClick={handleDeleteSelectedRooms} className="clear-all-btn" disabled={deletingRooms}>
                <Trash2 size={16} />
                {deletingRooms ? '삭제 중...' : `${selectedRooms.size}개 삭제`}
              </button>
            )}
          </div>
        </div>

        <p className="section-description">
          <AlertTriangle size={14} /> Liveblocks 서버에 저장된 실제 룸입니다.
          불필요한 룸을 삭제하여 정리하세요. (Secret Key 필요)
        </p>

        {loadingRooms ? (
          <div className="loading-state">
            <RefreshCw size={24} className="spinning" />
            <p>클라우드 룸 로딩 중...</p>
          </div>
        ) : cloudRooms.length === 0 ? (
          <div className="empty-state">
            <p>클라우드 룸이 없거나 API 키가 설정되지 않았습니다.</p>
            <p className="hint">Vercel 환경변수에 LIVEBLOCKS_SECRET_KEY를 설정하세요.</p>
          </div>
        ) : (
          <>
            <div className="select-all-row">
              <label>
                <input
                  type="checkbox"
                  checked={selectedRooms.size === cloudRooms.length && cloudRooms.length > 0}
                  onChange={toggleSelectAll}
                />
                전체 선택
              </label>
              <span className="room-count">{selectedRooms.size}개 선택됨</span>
            </div>
            <div className="cloud-rooms-list">
              {cloudRooms.map((room) => (
                <div key={room.id} className={`cloud-room-card ${selectedRooms.has(room.id) ? 'selected' : ''}`}>
                  <label className="room-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedRooms.has(room.id)}
                      onChange={() => toggleRoomSelection(room.id)}
                    />
                    <code className="room-id">{room.id}</code>
                  </label>
                  <span className="room-date">{formatTime(room.lastConnectionAt)}</span>
                </div>
              ))}
            </div>
          </>
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
