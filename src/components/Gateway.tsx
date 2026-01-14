// src/components/Gateway.tsx
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import gatewayAdminService, { type PasswordType } from '../services/GatewayAdminService';
import AdminGateway from './AdminGateway';
import './Gateway.css';

interface GatewayProps {
  children: ReactNode;
  onAuthenticated?: (isAdmin: boolean, sessionCode?: string, passwordType?: PasswordType) => void;  // 추가: passwordType
}

const Gateway = ({ children, onAuthenticated }: GatewayProps) => {
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기존 인증 토큰 확인
  const checkExistingAuth = useCallback(() => {
    try {
      const storedAuth = localStorage.getItem('gateway-auth-token');

      if (storedAuth) {
        const authData = JSON.parse(storedAuth);

        // 만료 확인 (24시간)
        if (Date.now() > authData.expiresAt) {
          localStorage.removeItem('gateway-auth-token');
        } else {
          setIsAuth(true);
          setIsAdmin(authData.isAdmin);

          // 관리자 인증이 저장되어 있으면 자동으로 패널 표시
          if (authData.isAdmin) {
            setShowAdminPanel(true);
          }

          if (onAuthenticated) {
            onAuthenticated(authData.isAdmin, undefined, authData.passwordType);  // 추가: passwordType 전달
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('gateway-auth-token');
    } finally {
      setIsLoading(false);
    }
  }, [onAuthenticated]);

  // 컴포넌트 마운트시 기존 인증 확인
  useEffect(() => {
    if (import.meta.env.VITE_SKIP_GATE === 'true') {
      setIsAuth(true);
      setIsAdmin(true);
      setIsLoading(false);
      if (onAuthenticated) {
        onAuthenticated(true, undefined, 'workshop');
      }
    } else {
      checkExistingAuth();
    }
  }, [checkExistingAuth, onAuthenticated]);

  // 비밀번호 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 세션 코드 형식 확인 (6자리 영숫자 대문자)
      const sessionCodePattern = /^[A-Z0-9]{6}$/;
      const isSessionCode = sessionCodePattern.test(password.toUpperCase());

      // GatewayAdminService를 통해 비밀번호 검증
      const result = await gatewayAdminService.validatePassword(password);

      if (result.isValid) {
        const authData = {
          token: `gw_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          isAdmin: result.isAdmin,
          passwordType: result.passwordType,  // 추가: 비밀번호 타입
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24시간
        };

        localStorage.setItem('gateway-auth-token', JSON.stringify(authData));

        setIsAuth(true);
        setIsAdmin(result.isAdmin);

        // 관리자 로그인 시 자동으로 관리자 패널 표시
        if (result.isAdmin) {
          setShowAdminPanel(true);
        }

        const sessionCode = isSessionCode ? password.toUpperCase() : undefined;
        setPassword('');

        if (onAuthenticated) {
          onAuthenticated(result.isAdmin, sessionCode, result.passwordType);  // 추가: passwordType 전달
        }

        console.log(
          `✅ Gateway authenticated: ${result.isAdmin ? 'Admin' : 'Temporary Password'} (Type: ${result.passwordType || 'unknown'})${sessionCode ? ` with session code: ${sessionCode}` : ''}`
        );
      } else {
        setError('잘못된 비밀번호입니다. 만료되었거나 사용 횟수가 초과되었을 수 있습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    localStorage.removeItem('gateway-auth-token');
    setIsAuth(false);
    setIsAdmin(false);
    setShowAdminPanel(false);
    setPassword('');
    setError('');
  };

  // 관리자 패널 토글
  const toggleAdminPanel = () => {
    if (isAdmin) {
      setShowAdminPanel(!showAdminPanel);
    }
  };

  // 로딩 중
  if (isLoading && import.meta.env.VITE_SKIP_GATE !== 'true') {
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
  if (!isAuth && import.meta.env.VITE_SKIP_GATE !== 'true') {
    return (
      <div className="gateway-container">
        <div className="gateway-form">
          <div className="gateway-header">
            <h1 className="gateway-title">조직문화 분석 시스템</h1>
            <p className="gateway-subtitle">접근 권한이 필요합니다</p>
          </div>

          <form onSubmit={handleSubmit} className="gateway-login-form">
            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
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
                '입장하기'
              )}
            </button>
          </form>

          <div className="gateway-footer">
            <p className="footer-text">
              🔒 보안된 시스템입니다. 접근 권한이 있는 비밀번호를 입력해주세요.
            </p>
          </div>

          {/* 프로그램 소개 섹션 */}
          <div className="gateway-intro-section">
            <div className="intro-content">
              <h3>🎯 조직문화 분석기란?</h3>
              <p>
                <strong>Dave Gray-Schein 4층위 조직문화 모델</strong>을 기반으로 한 전문적인
                조직문화 분석 도구입니다. 조직의 결과, 행동, 유형적/무형적 요인들을 시각화하여
                문화의 근본 동인을 파악할 수 있습니다.
              </p>

              <h3>📋 주요 기능</h3>
              <ul>
                <li>
                  <strong>컬쳐맵 생성:</strong> AI 분석을 통한 조직문화 요소들의 연결관계 시각화
                </li>
                <li>
                  <strong>워크샵 모드:</strong> 포스트잇 사진 분석으로 실시간 컬쳐맵 생성
                </li>
                <li>
                  <strong>프로페셜 모드:</strong> 단계별 심층 분석 프로세스
                </li>
                <li>
                  <strong>인터랙티브 편집:</strong> 드래그&드롭으로 자유로운 맵 편집
                </li>
                <li>
                  <strong>보고서 생성:</strong> 분석 결과를 전문적인 리포트로 출력
                </li>
              </ul>

              <h3>🚀 활용 방식</h3>
              <ol>
                <li>
                  <strong>데이터 수집:</strong> 조직문화 워크샵, 인터뷰, 설문조사 등
                </li>
                <li>
                  <strong>AI 분석:</strong> 프롬프트 생성기로 LLM에 분석 요청
                </li>
                <li>
                  <strong>맵 생성:</strong> AI 결과를 붙여넣어 컬쳐맵 자동 생성
                </li>
                <li>
                  <strong>맵 편집:</strong> 필요시 노드/연결선 추가, 수정, 삭제
                </li>
                <li>
                  <strong>보고서:</strong> 완성된 맵을 기반으로 전문 보고서 생성
                </li>
              </ol>

              <div className="intro-footer">
                <p>
                  💡 <strong>Tip:</strong> 워크샵 모드에서 포스트잇 사진을 AI에게 보내면 즉시
                  컬쳐맵을 생성할 수 있습니다!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 인증됨 또는 우회 모드 - 일반 사용자 (메인 앱 표시)
  if (import.meta.env.VITE_SKIP_GATE === 'true' || (isAuth && !isAdmin)) {
    return (
      <div className="gateway-authenticated">
        {/* 인증된 사용자를 위한 헤더 */}
        <div className="gateway-auth-header">
          <div className="auth-status">
            <span className="auth-indicator"></span>
            <span className="auth-text">{import.meta.env.VITE_SKIP_GATE === 'true' ? '개발 모드 우회' : '인증됨'}</span>
          </div>
          <div className="auth-actions">
            <button onClick={handleLogout} className="logout-button" title="로그아웃">
              로그아웃
            </button>
          </div>
        </div>

        {/* 메인 애플리케이션 */}
        <div className="gateway-main-content">{children}</div>
      </div>
    );
  }

  // 인증됨 - 관리자인 경우 AdminGateway만 표시 (children 렌더링 안 함)
  if (isAuth && isAdmin) {
    if (showAdminPanel) {
      return <AdminGateway onBack={() => setShowAdminPanel(false)} />;
    }
    // 관리자가 Admin Panel을 닫았을 때
    return (
      <div className="gateway-authenticated">
        <div className="gateway-auth-header">
          <div className="auth-status">
            <span className="auth-indicator"></span>
            <span className="auth-text">인증됨 (관리자)</span>
          </div>
          <div className="auth-actions">
            <button onClick={toggleAdminPanel} className="admin-panel-button" title="관리자 패널">
              🔧 관리자 패널
            </button>
            <button onClick={handleLogout} className="logout-button" title="로그아웃">
              로그아웃
            </button>
          </div>
        </div>
        <div className="gateway-main-content">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>관리자 모드</h2>
            <p>관리자 패널 버튼을 클릭하여 세션을 관리하세요.</p>
          </div>
        </div>
      </div>
    );
  }


  // 여기에 도달하면 안 됨
  return null;
};

export default Gateway;
