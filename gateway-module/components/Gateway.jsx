import React, { useState, useEffect } from 'react';
import { GATEWAY_CONFIG } from '../utils/config.js';
import { 
  gatewayFetch, 
  saveAuthToken, 
  getAuthToken, 
  removeAuthToken,
  getErrorMessage,
  isAuthenticated 
} from '../utils/gateway-utils.js';
import './Gateway.css';

const Gateway = ({ children, onAuthenticated }) => {
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 컴포넌트 마운트시 기존 인증 확인
  useEffect(() => {
    checkExistingAuth();
  }, []);

  // 기존 인증 토큰 확인
  const checkExistingAuth = async () => {
    try {
      const authToken = getAuthToken();
      
      if (authToken) {
        setIsAuth(true);
        if (onAuthenticated) {
          onAuthenticated(authToken.isAdmin);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      removeAuthToken();
    } finally {
      setIsLoading(false);
    }
  };

  // 비밀번호 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await gatewayFetch('/gateway-auth', {
        method: 'POST',
        body: JSON.stringify({ password })
      });

      if (result.success && result.data.success) {
        const { sessionToken, isAdmin, expiresAt } = result.data;
        
        // 인증 토큰 저장
        saveAuthToken(sessionToken, isAdmin);
        
        // 성공 처리
        setIsAuth(true);
        setPassword('');
        
        if (onAuthenticated) {
          onAuthenticated(isAdmin);
        }
        
        // 성공 메시지 표시 (선택사항)
        console.log(result.data.message);
        
      } else {
        setError(result.data?.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    removeAuthToken();
    setIsAuth(false);
    setPassword('');
    setError('');
  };

  // 로딩 중
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

  // 인증되지 않음 - 로그인 폼 표시
  if (!isAuth) {
    return (
      <div className="gateway-container">
        <div className="gateway-form">
          <div className="gateway-header">
            <h1 className="gateway-title">
              {GATEWAY_CONFIG.ui.title}
            </h1>
            <p className="gateway-subtitle">
              {GATEWAY_CONFIG.ui.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="gateway-login-form">
            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={GATEWAY_CONFIG.ui.tempPasswordPlaceholder}
                className={`form-input ${error ? 'error' : ''}`}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || !password.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="button-spinner"></span>
                  인증 중...
                </>
              ) : (
                GATEWAY_CONFIG.ui.loginButtonText
              )}
            </button>
          </form>

          <div className="gateway-footer">
            <p className="footer-text">
              접근 권한이 있는 비밀번호를 입력해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 인증됨 - 메인 앱 표시
  return (
    <div className="gateway-authenticated">
      {/* 인증된 사용자를 위한 헤더 (선택사항) */}
      <div className="gateway-auth-header">
        <div className="auth-status">
          <span className="auth-indicator"></span>
          <span className="auth-text">인증됨</span>
        </div>
        <button 
          onClick={handleLogout}
          className="logout-button"
          title="로그아웃"
        >
          로그아웃
        </button>
      </div>
      
      {/* 메인 애플리케이션 */}
      <div className="gateway-main-content">
        {children}
      </div>
    </div>
  );
};

export default Gateway;