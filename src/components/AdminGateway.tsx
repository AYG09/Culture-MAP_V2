// src/components/AdminGateway.tsx - 관리자 패널 (2컬럼 레이아웃)
import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Trash2, Users, Clock, Key, Save, Eye, EyeOff, Cloud, AlertTriangle, Building2, Edit3, Check, X, Shield, Plus, ChevronDown, ChevronRight, FolderInput, Lock, LockOpen } from 'lucide-react';
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

  // 마스터키 관리
  const [masterKey, setMasterKey] = useState('');
  const [newMasterKey, setNewMasterKey] = useState('');
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [savingMasterKey, setSavingMasterKey] = useState(false);
  const [masterKeyMessage, setMasterKeyMessage] = useState('');

  // 기업 비밀번호 관리
  const [orgPasswords, setOrgPasswords] = useState<Record<string, string>>({});
  const [editingOrgPw, setEditingOrgPw] = useState<string | null>(null);
  const [editingOrgPwValue, setEditingOrgPwValue] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPw, setNewOrgPw] = useState('');
  const [savingOrgPw, setSavingOrgPw] = useState(false);

  // 아코디언 상태
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedPwOrgs, setExpandedPwOrgs] = useState<Set<string>>(new Set());
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // 세션 이름 편집
  const [editingSessionName, setEditingSessionName] = useState<string | null>(null);
  const [editingSessionNameValue, setEditingSessionNameValue] = useState('');

  // 이동 드롭다운 상태
  const [showMoveDropdown, setShowMoveDropdown] = useState<string | null>(null);

  // 세션별 커스텀 진입 코드 (별칭) 관리
  const [sessionAliases, setSessionAliases] = useState<Record<string, string>>({}); // { code: alias } 형태로 변환해서 사용
  const [editingSessionAlias, setEditingSessionAlias] = useState<string | null>(null);
  const [editingSessionAliasValue, setEditingSessionAliasValue] = useState('');
  const [savingSessionAlias, setSavingSessionAlias] = useState(false);

  // 기존 조직 목록 (자동완성용)
  const existingOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    sessions.forEach(s => {
      if (s.organization) orgs.add(s.organization);
    });
    return Array.from(orgs).sort();
  }, [sessions]);

  // 조직별 세션 그룹화
  const organizationGroups = useMemo(() => {
    const groups: Record<string, SessionInfo[]> = {};
    sessions.forEach(s => {
      const org = s.organization || '미지정';
      if (!groups[org]) groups[org] = [];
      groups[org].push(s);
    });
    // 정렬: 미지정은 마지막
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '미지정') return 1;
      if (b === '미지정') return -1;
      return a.localeCompare(b, 'ko');
    });
    return sortedKeys.map(org => ({ org, sessions: groups[org] }));
  }, [sessions]);

  // 아코디언 토글
  const toggleOrgAccordion = (org: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(org)) next.delete(org);
      else next.add(org);
      return next;
    });
  };

  const togglePwOrgAccordion = (org: string) => {
    setExpandedPwOrgs(prev => {
      const next = new Set(prev);
      if (next.has(org)) next.delete(org);
      else next.add(org);
      return next;
    });
  };

  // 세션 이름 편집 시작
  const startEditSessionName = (session: SessionInfo) => {
    setEditingSessionName(session.code);
    setEditingSessionNameValue(session.name || '');
  };

  // 세션 이름 저장
  const saveSessionName = async (code: string) => {
    try {
      await liveblocksService.updateSessionName(code, editingSessionNameValue);
      setEditingSessionName(null);
      setEditingSessionNameValue('');
      await loadSessions();
    } catch (err) {
      console.error('세션 이름 변경 실패:', err);
      setError('세션 이름 변경에 실패했습니다.');
    }
  };

  // 세션 기업 이동
  const moveSessionToOrg = async (code: string, targetOrg: string) => {
    try {
      await liveblocksService.updateSessionOrganization(code, targetOrg === '미지정' ? '' : targetOrg);
      setShowMoveDropdown(null);
      await loadSessions();
    } catch (err) {
      console.error('세션 이동 실패:', err);
      setError('세션 이동에 실패했습니다.');
    }
  };

  // 초기 로드
  useEffect(() => {
    loadSessions();
    loadHostPassword();
    loadCloudRooms();
    loadMasterKey();
    loadOrgPasswords();
    loadSessionAliases();
  }, []);

  // 마스터키 로드
  const loadMasterKey = async () => {
    try {
      const key = await liveblocksService.getMasterKey();
      setMasterKey(key);
    } catch (err) {
      console.error('마스터키 로드 실패:', err);
    }
  };

  // 마스터키 저장
  const saveMasterKeyHandler = async () => {
    if (!newMasterKey.trim()) {
      setMasterKeyMessage('❌ 새 마스터키를 입력하세요.');
      return;
    }
    setSavingMasterKey(true);
    setMasterKeyMessage('');
    try {
      await liveblocksService.setMasterKey(newMasterKey.trim());
      setMasterKey(newMasterKey.trim());
      setNewMasterKey('');
      setMasterKeyMessage('✅ 마스터키가 변경되었습니다!');
      setTimeout(() => setMasterKeyMessage(''), 5000);
    } catch (err) {
      console.error('마스터키 저장 실패:', err);
      setMasterKeyMessage('❌ 저장 실패. 다시 시도해주세요.');
    } finally {
      setSavingMasterKey(false);
    }
  };

  // 기업 비밀번호 목록 로드
  const loadOrgPasswords = async () => {
    try {
      const passwords = await liveblocksService.getAllOrganizationPasswords();
      setOrgPasswords(passwords);
    } catch (err) {
      console.error('기업 비밀번호 로드 실패:', err);
    }
  };

  // 기업 비밀번호 저장
  const saveOrgPassword = async (org: string, password: string) => {
    setSavingOrgPw(true);
    try {
      await liveblocksService.setOrganizationPassword(org, password);
      setOrgPasswords(prev => ({ ...prev, [org]: password }));
      setEditingOrgPw(null);
      setEditingOrgPwValue('');
    } catch (err) {
      console.error('기업 비밀번호 저장 실패:', err);
      setError('기업 비밀번호 저장에 실패했습니다.');
    } finally {
      setSavingOrgPw(false);
    }
  };

  // 새 기업 비밀번호 추가
  const addNewOrgPassword = async () => {
    if (!newOrgName.trim() || !newOrgPw.trim()) {
      setError('기업명과 비밀번호를 모두 입력하세요.');
      return;
    }
    // '미지정'은 빈 문자열로 저장
    const orgKey = newOrgName.trim() === '미지정' ? '' : newOrgName.trim();
    await saveOrgPassword(orgKey, newOrgPw.trim());
    setNewOrgName('');
    setNewOrgPw('');
  };

  // 기업 비밀번호 삭제
  const deleteOrgPassword = async (org: string) => {
    if (!window.confirm(`"${org}" 기업의 비밀번호를 삭제하시겠습니까?`)) return;
    try {
      await liveblocksService.deleteOrganizationPassword(org);
      setOrgPasswords(prev => {
        const updated = { ...prev };
        delete updated[org];
        return updated;
      });
    } catch (err) {
      console.error('기업 비밀번호 삭제 실패:', err);
    }
  };

  // 세션 커스텀 진입 코드(별칭) 목록 로드
  const loadSessionAliases = async () => {
    try {
      const aliases = await liveblocksService.getAllSessionAliases();
      // { alias: code } → { code: alias } 변환
      const codeToAlias: Record<string, string> = {};
      for (const [alias, code] of Object.entries(aliases)) {
        codeToAlias[code] = alias;
      }
      setSessionAliases(codeToAlias);
    } catch (err) {
      console.error('세션 별칭 로드 실패:', err);
    }
  };

  // 세션 커스텀 진입 코드 저장
  const saveSessionAlias = async (code: string, alias: string) => {
    setSavingSessionAlias(true);
    try {
      const result = await liveblocksService.setSessionAlias(code, alias);
      if (result.success) {
        if (alias.trim()) {
          setSessionAliases(prev => ({ ...prev, [code]: alias.toUpperCase() }));
        } else {
          setSessionAliases(prev => {
            const updated = { ...prev };
            delete updated[code];
            return updated;
          });
        }
        setEditingSessionAlias(null);
        setEditingSessionAliasValue('');
      } else {
        setError(result.error || '커스텀 코드 저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('세션 별칭 저장 실패:', err);
      setError('커스텀 코드 저장에 실패했습니다.');
    } finally {
      setSavingSessionAlias(false);
    }
  };

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

  // 세션 목록 로드 (클라우드 룸과 동기화)
  const loadSessions = async () => {
    setLoading(true);
    try {
      // 1. 레지스트리에서 세션 목록 가져오기
      const registrySessions = await liveblocksService.getSessionRegistry();
      
      // 2. 클라우드 룸 목록도 가져와서 동기화
      let cloudRoomIds: Set<string> = new Set();
      try {
        const rooms = await liveblocksAdminService.listRooms();
        const cultureMapRooms = liveblocksAdminService.filterCultureMapRooms(rooms);
        cloudRoomIds = new Set(cultureMapRooms.map(r => {
          // culturemap-v2-CODE 형식에서 CODE 추출
          const match = r.id.match(/^culturemap-v2-(.+)$/);
          return match ? match[1] : r.id;
        }));
      } catch (cloudErr) {
        console.warn('클라우드 룸 목록 조회 실패 (동기화 건너뜀):', cloudErr);
      }
      
      // 3. 클라우드에 존재하는 세션만 필터링 (동기화)
      const syncedSessions = cloudRoomIds.size > 0
        ? registrySessions.filter(s => cloudRoomIds.has(s.code))
        : registrySessions; // 클라우드 조회 실패시 전체 표시
      
      // 4. 클라우드에 없는 레지스트리 항목 자동 정리
      if (cloudRoomIds.size > 0) {
        const orphanCodes = registrySessions
          .filter(s => !cloudRoomIds.has(s.code))
          .map(s => s.code);
        
        if (orphanCodes.length > 0) {
          console.log(`🧹 고아 레지스트리 ${orphanCodes.length}개 정리:`, orphanCodes);
          for (const code of orphanCodes) {
            await liveblocksService.unregisterSession(code);
          }
        }
      }
      
      const formattedSessions = syncedSessions.map((session) => ({
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

  // 조직 내 세션 전체 선택/해제
  const toggleSelectOrgSessions = (org: string) => {
    const orgSessions = sessions.filter(s => (s.organization || '미지정') === org);
    const orgCodes = orgSessions.map(s => s.code);
    const allSelected = orgCodes.every(code => selectedSessions.has(code));
    
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (allSelected) {
        orgCodes.forEach(code => next.delete(code));
      } else {
        orgCodes.forEach(code => next.add(code));
      }
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

      {/* 2컬럼 그리드 레이아웃 */}
      <div className="admin-panels-grid">
        {/* 왼쪽 패널: 비밀번호 관리 */}
        <div className="admin-panel">
          <div className="panel-title">
            <Key size={18} />
            <h3>비밀번호 관리</h3>
          </div>

          {/* 호스트 비밀번호 */}
          <section className="admin-section">
            <h3><Key size={18} /> 호스트 비밀번호</h3>
            <p className="section-description">
              새 세션 생성 시 필요한 비밀번호입니다.
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
              <button onClick={saveHostPassword} disabled={saving} className="save-btn">
                <Save size={16} />
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
            {saveMessage && <p className="save-message">{saveMessage}</p>}
          </section>

          {/* 마스터키 */}
          <section className="admin-section">
            <h3><Shield size={18} /> 마스터키</h3>
            <p className="section-description">
              모든 기업 폴더에 접근 가능한 마스터키. 기본값: <code>welcome09@!</code>
            </p>
            <div className="password-form">
              <div className="password-input-group">
                <input
                  type={showMasterKey ? 'text' : 'password'}
                  value={masterKey}
                  readOnly
                  placeholder="현재 마스터키"
                  className="password-input"
                  style={{ backgroundColor: '#f1f5f9' }}
                />
                <button
                  type="button"
                  className="toggle-visibility-btn"
                  onClick={() => setShowMasterKey(!showMasterKey)}
                >
                  {showMasterKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="password-form" style={{ marginTop: '0.75rem' }}>
              <div className="password-input-group">
                <input
                  type="text"
                  value={newMasterKey}
                  onChange={(e) => setNewMasterKey(e.target.value)}
                  placeholder="새 마스터키 입력"
                  className="password-input"
                />
              </div>
              <button onClick={saveMasterKeyHandler} disabled={savingMasterKey} className="save-btn">
                <Save size={16} />
                {savingMasterKey ? '저장 중...' : '변경'}
              </button>
            </div>
            {masterKeyMessage && <p className="save-message">{masterKeyMessage}</p>}
          </section>

          {/* 기업 폴더 비밀번호 */}
          <section className="admin-section">
            <h3><Building2 size={18} /> 기업 폴더 비밀번호</h3>
            <p className="section-description">
              각 기업 폴더 접근 시 필요한 비밀번호입니다.
            </p>

            <div className="org-password-list">
              {Object.entries(orgPasswords).length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem' }}>
                  <p>설정된 기업 비밀번호가 없습니다.</p>
                </div>
              ) : (
                Object.entries(orgPasswords).map(([org, pw]) => (
                  <div key={org || '__empty__'} className="org-password-item">
                    <div className="org-password-info">
                      <span className="org-name">{org || '미지정'}</span>
                      {editingOrgPw === org ? (
                        <div className="org-pw-edit-form">
                          <input
                            type="text"
                            value={editingOrgPwValue}
                            onChange={(e) => setEditingOrgPwValue(e.target.value)}
                            placeholder="새 비밀번호"
                            autoFocus
                          />
                          <button
                            onClick={() => saveOrgPassword(org, editingOrgPwValue)}
                            disabled={savingOrgPw}
                            className="save-org-btn"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => { setEditingOrgPw(null); setEditingOrgPwValue(''); }}
                            className="cancel-org-btn"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="org-pw-masked">{'•'.repeat(pw.length)}</span>
                      )}
                    </div>
                    <div className="org-password-actions">
                      {editingOrgPw !== org && (
                        <>
                          <button
                            onClick={() => { setEditingOrgPw(org); setEditingOrgPwValue(pw); }}
                            className="edit-org-btn"
                            title="수정"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => deleteOrgPassword(org)}
                            className="delete-org-btn"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="add-org-password-form">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="기업명 (미지정 포함)"
                list="existing-orgs"
              />
              <datalist id="existing-orgs">
                <option value="미지정" />
                {existingOrganizations.filter(org => org !== '미지정').map(org => (
                  <option key={org} value={org} />
                ))}
              </datalist>
              <input
                type="text"
                value={newOrgPw}
                onChange={(e) => setNewOrgPw(e.target.value)}
                placeholder="비밀번호"
              />
              <button
                onClick={addNewOrgPassword}
                disabled={savingOrgPw || !newOrgName.trim() || !newOrgPw.trim()}
                className="add-org-btn"
              >
                <Plus size={16} />
                추가
              </button>
            </div>
          </section>
        </div>

        {/* 오른쪽 패널: 세션 관리 */}
        <div className="admin-panel">
          <div className="panel-title">
            <Users size={18} />
            <h3>세션 관리 ({sessions.length}개)</h3>
            <div className="section-actions" style={{ marginLeft: 'auto' }}>
              <button onClick={loadSessions} className="refresh-btn" disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              </button>
              {sessions.length > 0 && (
                <button onClick={handleClearAllSessions} className="clear-all-btn">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <section className="admin-section">
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
                    전체 ({selectedSessions.size}/{sessions.length})
                  </label>
                  {selectedSessions.size > 0 && (
                    <div className="bulk-migration-form">
                      <input
                        type="text"
                        value={bulkOrg}
                        onChange={(e) => setBulkOrg(e.target.value)}
                        placeholder="조직명"
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
                        <FolderInput size={14} />
                        {migratingOrg ? '이동 중...' : '이동'}
                      </button>
                    </div>
                  )}
                </div>

                {/* 조직별 아코디언 */}
                <div className="org-groups">
                  {organizationGroups.map(({ org, sessions: orgSessions }) => (
                    <div key={org} className="org-group">
                      <div
                        className={`accordion-header ${expandedOrgs.has(org) ? 'expanded' : ''}`}
                        onClick={() => toggleOrgAccordion(org)}
                      >
                        <div className="accordion-title">
                          <Building2 size={14} />
                          <span>{org}</span>
                          <span className="accordion-badge">{orgSessions.length}</span>
                        </div>
                        <div className="accordion-icon" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label
                            className="select-all-label"
                            onClick={(e) => { e.stopPropagation(); toggleSelectOrgSessions(org); }}
                            style={{ fontSize: '0.75rem' }}
                          >
                            <input
                              type="checkbox"
                              checked={orgSessions.every(s => selectedSessions.has(s.code))}
                              onChange={() => {}}
                              style={{ width: '14px', height: '14px' }}
                            />
                          </label>
                          {expandedOrgs.has(org) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>
                      <div className={`accordion-content ${expandedOrgs.has(org) ? '' : 'collapsed'}`}>
                        <div className="org-sessions-list">
                          {orgSessions.map((session) => (
                            <div key={session.code} className={`session-card-compact ${selectedSessions.has(session.code) ? 'selected' : ''}`}>
                              <label className="session-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedSessions.has(session.code)}
                                  onChange={() => toggleSessionSelection(session.code)}
                                />
                              </label>
                              {editingSessionName === session.code ? (
                                <div className="session-edit-inline">
                                  <input
                                    type="text"
                                    value={editingSessionNameValue}
                                    onChange={(e) => setEditingSessionNameValue(e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => saveSessionName(session.code)} className="save-org-btn" title="저장">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => setEditingSessionName(null)} className="cancel-org-btn" title="취소">
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="session-info">
                                    <div className="session-name">
                                      {session.name || '이름 없음'}
                                    </div>
                                    <div className="session-code">
                                      {sessionAliases[session.code] || session.code}
                                      {sessionAliases[session.code] && (
                                        <span style={{ color: '#94a3b8', marginLeft: '4px', fontSize: '0.75rem' }}>
                                          ({session.code})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="session-actions">
                                    {editingSessionAlias === session.code ? (
                                      <div className="session-edit-inline" style={{ marginRight: '0.5rem' }}>
                                        <input
                                          type="text"
                                          value={editingSessionAliasValue}
                                          onChange={(e) => setEditingSessionAliasValue(e.target.value.toUpperCase())}
                                          placeholder="커스텀 코드 (빈값=원래코드)"
                                          style={{ width: '130px', fontSize: '0.8rem' }}
                                          autoFocus
                                          title={`기억하기 쉬운 커스텀 진입 코드를 설정합니다 (원본: ${session.code})`}
                                        />
                                        <button
                                          onClick={() => saveSessionAlias(session.code, editingSessionAliasValue)}
                                          disabled={savingSessionAlias}
                                          className="save-org-btn"
                                          title="저장"
                                        >
                                          <Check size={12} />
                                        </button>
                                        <button
                                          onClick={() => { setEditingSessionAlias(null); setEditingSessionAliasValue(''); }}
                                          className="cancel-org-btn"
                                          title="취소"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        className={`session-action-btn lock ${sessionAliases[session.code] ? 'active' : ''}`}
                                        onClick={() => {
                                          setEditingSessionAlias(session.code);
                                          setEditingSessionAliasValue(sessionAliases[session.code] || '');
                                        }}
                                        title={sessionAliases[session.code] ? `커스텀 코드: ${sessionAliases[session.code]}` : '커스텀 진입 코드 설정'}
                                      >
                                        <Key size={14} />
                                      </button>
                                    )}
                                    <button
                                      className="session-action-btn edit"
                                      onClick={() => startEditSessionName(session)}
                                      title="이름 편집"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <div className="move-dropdown">
                                      <button
                                        className="session-action-btn move"
                                        onClick={() => setShowMoveDropdown(showMoveDropdown === session.code ? null : session.code)}
                                        title="기업 이동"
                                      >
                                        <FolderInput size={14} />
                                      </button>
                                      {showMoveDropdown === session.code && (
                                        <div className="move-dropdown-menu">
                                          {['미지정', ...existingOrganizations].map(targetOrg => (
                                            <button
                                              key={targetOrg}
                                              className={`move-dropdown-item ${(session.organization || '미지정') === targetOrg ? 'current' : ''}`}
                                              onClick={() => moveSessionToOrg(session.code, targetOrg)}
                                            >
                                              {targetOrg}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      className="session-action-btn delete"
                                      onClick={() => handleDeleteSession(session.code, session.name)}
                                      title="삭제"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* 고급 설정 (클라우드 룸 관리) - 아코디언 */}
      <section className="admin-section admin-full-width">
        <div
          className={`accordion-header ${showAdvancedSettings ? 'expanded' : ''}`}
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
        >
          <div className="accordion-title">
            <Cloud size={18} />
            <span>고급 설정: 클라우드 룸 관리</span>
            <span className="accordion-badge">{cloudRooms.length}</span>
          </div>
          <div className="accordion-icon">
            {showAdvancedSettings ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        
        <div className={`accordion-content ${showAdvancedSettings ? '' : 'collapsed'}`}>
          <div className="section-header" style={{ marginBottom: '0.75rem' }}>
            <p className="section-description" style={{ margin: 0 }}>
              <AlertTriangle size={14} /> Liveblocks 서버의 실제 룸입니다. (Secret Key 필요)
            </p>
            <div className="section-actions">
              <button onClick={loadCloudRooms} className="refresh-btn" disabled={loadingRooms}>
                <RefreshCw size={16} className={loadingRooms ? 'spinning' : ''} />
              </button>
              {selectedRooms.size > 0 && (
                <button onClick={handleDeleteSelectedRooms} className="clear-all-btn" disabled={deletingRooms}>
                  <Trash2 size={16} />
                  {deletingRooms ? '삭제 중...' : `${selectedRooms.size}개 삭제`}
                </button>
              )}
            </div>
          </div>

          {loadingRooms ? (
            <div className="loading-state">
              <RefreshCw size={24} className="spinning" />
              <p>클라우드 룸 로딩 중...</p>
            </div>
          ) : cloudRooms.length === 0 ? (
            <div className="empty-state">
              <p>클라우드 룸이 없거나 API 키가 설정되지 않았습니다.</p>
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
        </div>
      </section>

      {/* 안내 */}
      <div className="admin-footer">
        <p>💡 <strong>팁:</strong> 호스트 비밀번호는 클라우드에 저장되어 모든 사용자가 공유합니다. 강사에게 이 비밀번호를 알려주세요.</p>
      </div>
    </div>
  );
};

export default AdminGateway;
