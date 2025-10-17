import React, { useState, useEffect, useCallback } from 'react';
import App from '../App';
import SessionManager from './SessionManager';
import FirebaseMultiUserService from '../services/FirebaseMultiUserService';

const MultiUserApp: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [showIPAccessNotice, setShowIPAccessNotice] = useState(false);

  const syncSessionStateFromService = useCallback(() => {
    const currentSession = FirebaseMultiUserService.getCurrentSession();

    if (!currentSession) {
      return false;
    }

    setSessionActive(true);
    return true;
  }, []);

  useEffect(() => {
    // 🔥 초기 로드 시 기존 세션 상태 즉시 동기화
    const initialSync = syncSessionStateFromService();
    if (initialSync) {
      console.log('✅ Existing session detected and synced on mount');
    }

    // IP 주소 접속 감지 (안내 메시지용)
    const currentHost = window.location.hostname;
    const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(currentHost);
    const hasExplicitParam =
      new URLSearchParams(window.location.search).get('multiuser') === 'true';

    let noticeTimeout: number | undefined;

    if (isIPAddress && !hasExplicitParam) {
      setShowIPAccessNotice(true);
      // 3초 후 안내 메시지 자동 숨김
      noticeTimeout = window.setTimeout(() => setShowIPAccessNotice(false), 3000);

      // URL에 multiuser=true 파라미터 추가 (브라우저 히스토리에 영향 없이)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('multiuser', 'true');
      window.history.replaceState(null, '', newUrl.toString());
    }

    type UserCountPayload = { userCount: number };
    type GenericEventHandler = (...args: unknown[]) => void;

    const handleSessionData: GenericEventHandler = (...args) => {
      const [data] = args;
      console.log('📦 Received session data:', data);
    };

    const handleUserJoined: GenericEventHandler = (...args) => {
      const [payload] = args;
      const data = (payload as UserCountPayload) ?? { userCount: 0 };
      console.log('👥 User joined - total users:', data.userCount);
      const wasSynced = syncSessionStateFromService();
      if (!wasSynced) {
        console.warn('⚠️ User joined event received but no active session found');
      }
    };

    const handleUserLeft: GenericEventHandler = (...args) => {
      const [payload] = args;
      const data = (payload as UserCountPayload) ?? { userCount: 0 };
      if (!FirebaseMultiUserService.isConnected()) {
        setSessionActive(false);
      }

      console.log('👤 User left - total users:', data.userCount);
    };

    FirebaseMultiUserService.on('session-data', handleSessionData);
    FirebaseMultiUserService.on('user-joined', handleUserJoined);
    FirebaseMultiUserService.on('user-left', handleUserLeft);

    return () => {
      if (noticeTimeout) {
        window.clearTimeout(noticeTimeout);
      }
      FirebaseMultiUserService.off('session-data', handleSessionData);
      FirebaseMultiUserService.off('user-joined', handleUserJoined);
      FirebaseMultiUserService.off('user-left', handleUserLeft);
    };
  }, [syncSessionStateFromService]);

  const handleSessionJoined = (code: string, hostStatus: boolean) => {
    setSessionActive(true);
    syncSessionStateFromService();

    console.log(`🎉 Session joined: ${code} (${hostStatus ? 'Host' : 'Participant'})`);
  };

  return (
    <>
      {/* IP 주소 접속 안내 메시지 */}
      {showIPAccessNotice && (
        <div className="ip-access-notice">
          <div className="notice-content">
            <span>🌐 네트워크를 통한 접속이 감지되었습니다.</span>
            <span>멀티유저 모드로 자동 전환됩니다.</span>
          </div>
        </div>
      )}

      {/* 세션이 비활성화되면 모달로 세션 관리자 표시 */}
      {!sessionActive && <SessionManager onSessionJoined={handleSessionJoined} />}

      {/* 메인 애플리케이션 - 세션 정보를 props로 전달 */}
      <App />
    </>
  );
};

export default MultiUserApp;
