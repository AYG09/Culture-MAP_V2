import React, { useState, useEffect } from 'react';
import { 
  gatewayFetch, 
  getAuthToken, 
  generateRandomPassword,
  copyToClipboard,
  getErrorMessage,
  isAdmin 
} from '../utils/gateway-utils.js';
import './Gateway.css';

const AdminGateway = () => {
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // 새 비밀번호 폼 상태
  const [newPassword, setNewPassword] = useState({
    password: '',
    description: '',
    expireHours: 24,
    maxUses: '',
    autoGenerate: false
  });

  // 컴포넌트 마운트시 권한 확인 및 데이터 로드
  useEffect(() => {
    if (!isAdmin()) {
      setError('관리자 권한이 필요합니다.');
      return;
    }
    loadPasswords();
  }, []);

  // 임시 비밀번호 목록 로드
  const loadPasswords = async () => {
    setLoading(true);
    try {
      const result = await gatewayFetch('/gateway-admin', {
        method: 'GET'
      });

      if (result.success && result.data.success) {
        setPasswords(result.data.passwords || []);
        setError('');
      } else {
        setError(result.data?.error || '비밀번호 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // 새 비밀번호 생성
  const handleCreatePassword = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload = {
        ...newPassword,
        maxUses: newPassword.maxUses ? parseInt(newPassword.maxUses) : null
      };

      const result = await gatewayFetch('/gateway-admin', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (result.success && result.data.success) {
        await loadPasswords(); // 목록 새로고침
        setShowCreateForm(false);
        resetForm();
        alert(`비밀번호가 생성되었습니다: ${result.data.password.password}`);
      } else {
        setError(result.data?.error || '비밀번호 생성에 실패했습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  // 비밀번호 삭제
  const handleDeletePassword = async (id, password) => {
    if (!confirm(`비밀번호 "${password}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await gatewayFetch(`/gateway-admin?id=${id}`, {
        method: 'DELETE'
      });

      if (result.success && result.data.success) {
        await loadPasswords(); // 목록 새로고침
        alert('비밀번호가 삭제되었습니다.');
      } else {
        setError(result.data?.error || '비밀번호 삭제에 실패했습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  // 폼 리셋
  const resetForm = () => {
    setNewPassword({
      password: '',
      description: '',
      expireHours: 24,
      maxUses: '',
      autoGenerate: false
    });
  };

  // 자동 생성 토글
  const handleAutoGenerateToggle = () => {
    const autoGenerate = !newPassword.autoGenerate;
    setNewPassword({
      ...newPassword,
      autoGenerate,
      password: autoGenerate ? generateRandomPassword() : ''
    });
  };

  // 비밀번호 복사
  const handleCopyPassword = async (password) => {
    const success = await copyToClipboard(password);
    if (success) {
      alert('비밀번호가 복사되었습니다!');
    } else {
      alert('복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  // 권한 없음
  if (!isAdmin()) {
    return (
      <div className="admin-gateway-container">
        <div className="admin-error">
          <h2>접근 권한 없음</h2>
          <p>관리자 권한이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-gateway-container">
      <div className="admin-header">
        <h2>Gateway 관리자 패널</h2>
        <p>임시 비밀번호를 생성하고 관리할 수 있습니다.</p>
      </div>

      {error && (
        <div className="admin-error-message">
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* 새 비밀번호 생성 버튼 */}
      <div className="admin-actions">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="create-password-btn"
        >
          {showCreateForm ? '취소' : '새 비밀번호 생성'}
        </button>
        <button
          onClick={loadPasswords}
          className="refresh-btn"
          disabled={loading}
        >
          {loading ? '새로고침 중...' : '새로고침'}
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

            {!newPassword.autoGenerate && (
              <div className="form-group">
                <label>비밀번호:</label>
                <input
                  type="text"
                  value={newPassword.password}
                  onChange={(e) => setNewPassword({...newPassword, password: e.target.value})}
                  placeholder="비밀번호 입력"
                  required
                />
              </div>
            )}

            {newPassword.autoGenerate && (
              <div className="form-group">
                <label>생성된 비밀번호:</label>
                <div className="generated-password">
                  <code>{newPassword.password}</code>
                  <button
                    type="button"
                    onClick={() => setNewPassword({
                      ...newPassword,
                      password: generateRandomPassword()
                    })}
                    className="regenerate-btn"
                  >
                    다시 생성
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>설명:</label>
              <input
                type="text"
                value={newPassword.description}
                onChange={(e) => setNewPassword({...newPassword, description: e.target.value})}
                placeholder="비밀번호 용도 설명"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>유효 시간 (시간):</label>
                <input
                  type="number"
                  value={newPassword.expireHours}
                  onChange={(e) => setNewPassword({...newPassword, expireHours: parseInt(e.target.value)})}
                  min="1"
                  max="8760"
                />
              </div>
              <div className="form-group">
                <label>최대 사용 횟수:</label>
                <input
                  type="number"
                  value={newPassword.maxUses}
                  onChange={(e) => setNewPassword({...newPassword, maxUses: e.target.value})}
                  placeholder="무제한"
                  min="1"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={creating} className="submit-btn">
                {creating ? '생성 중...' : '생성'}
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
        <h3>임시 비밀번호 목록 ({passwords.length}개)</h3>
        
        {loading ? (
          <div className="loading">비밀번호 목록을 불러오는 중...</div>
        ) : passwords.length === 0 ? (
          <div className="no-passwords">등록된 임시 비밀번호가 없습니다.</div>
        ) : (
          <div className="passwords-list">
            {passwords.map((pwd) => (
              <div key={pwd.id} className={`password-item ${pwd.status}`}>
                <div className="password-header">
                  <div className="password-main">
                    <code className="password-text" onClick={() => handleCopyPassword(pwd.password)}>
                      {pwd.password}
                    </code>
                    <span className={`status-badge ${pwd.status}`}>
                      {pwd.status === 'active' ? '활성' : 
                       pwd.status === 'expired' ? '만료' : '소진'}
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
                  {pwd.description && (
                    <p className="description">{pwd.description}</p>
                  )}
                  <div className="meta-info">
                    <span>생성: {new Date(pwd.created_at).toLocaleString()}</span>
                    <span>만료: {pwd.timeRemaining}</span>
                    <span>사용: {pwd.usageInfo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGateway;