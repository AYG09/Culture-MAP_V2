import React, { useState, useEffect } from 'react';
import App from '../App';
import SessionManager from './SessionManager';
import FirebaseMultiUserService from '../services/FirebaseMultiUserService';
import './IPAccessNotice.css';

const MultiUserApp: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [showIPAccessNotice, setShowIPAccessNotice] = useState(false);

  useEffect(() => {
    // IP 주소 접속 감지 (안내 메시지용)
    const currentHost = window.location.hostname;
    const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(currentHost);
    const hasExplicitParam =
      new URLSearchParams(window.location.search).get('multiuser') === 'true';

    if (isIPAddress && !hasExplicitParam) {
      setShowIPAccessNotice(true);
      // 3초 후 안내 메시지 자동 숨김
      setTimeout(() => setShowIPAccessNotice(false), 3000);

      // URL에 multiuser=true 파라미터 추가 (브라우저 히스토리에 영향 없이)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('multiuser', 'true');
      window.history.replaceState(null, '', newUrl.toString());
    }

    // 멀티유저 서비스 이벤트 리스너 등록
    FirebaseMultiUserService.on('session-data', (data: unknown) => {
      console.log('📦 Received session data:', data);
      // 세션 데이터를 받으면 App 컴포넌트에 적용
      // 이 부분은 App 컴포넌트의 상태 관리와 연동해야 합니다.
    });

    // 연결 상태 및 사용자 수 업데이트
    FirebaseMultiUserService.on('user-joined', (data: { userCount: number }) => {
      setConnectedUsers(data.userCount);
      setIsConnected(FirebaseMultiUserService.isConnected());
      console.log('👥 User joined - total users:', data.userCount);
    });

    FirebaseMultiUserService.on('user-left', (data: { userCount: number }) => {
      setConnectedUsers(data.userCount);
      setIsConnected(FirebaseMultiUserService.isConnected());
      console.log('👤 User left - total users:', data.userCount);
    });

    // 연결 상태 변경 감지
    const checkConnectionStatus = () => {
      setIsConnected(FirebaseMultiUserService.isConnected());
    };
    
    // 주기적으로 연결 상태 확인
    const statusInterval = setInterval(checkConnectionStatus, 1000);
    
    // 초기 연결 상태 설정
    checkConnectionStatus();

    FirebaseMultiUserService.on('sticky-note-updated', (note: unknown) => {
      console.log('📝 Sticky note updated:', note);
      // 다른 사용자가 업데이트한 스티키 노트를 반영
    });

    FirebaseMultiUserService.on('sticky-note-deleted', (data: unknown) => {
      console.log('🗑️ Sticky note deleted:', data);
      // 다른 사용자가 삭제한 스티키 노트를 반영
    });

    FirebaseMultiUserService.on('project-data-synced', (data: unknown) => {
      console.log('🔄 Project data synced:', data);
      // 프로젝트 데이터 동기화
    });

    FirebaseMultiUserService.on('analysis-data-updated', (data: unknown) => {
      console.log('📊 Analysis data updated:', data);
      // 분석 데이터 업데이트
    });

    FirebaseMultiUserService.on('workshop-data-updated', (data: unknown) => {
      console.log('👥 Workshop data updated:', data);
      // 워크샵 데이터 업데이트
    });

    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 및 인터벌 정리
      clearInterval(statusInterval);
      FirebaseMultiUserService.off('session-data', () => {});
      FirebaseMultiUserService.off('user-joined', () => {});
      FirebaseMultiUserService.off('user-left', () => {});
      FirebaseMultiUserService.off('sticky-note-updated', () => {});
      FirebaseMultiUserService.off('sticky-note-deleted', () => {});
      FirebaseMultiUserService.off('project-data-synced', () => {});
      FirebaseMultiUserService.off('analysis-data-updated', () => {});
      FirebaseMultiUserService.off('workshop-data-updated', () => {});
    };
  }, []);

  const handleSessionJoined = (code: string, hostStatus: boolean) => {
    setSessionCode(code);
    setIsHost(hostStatus);
    setSessionActive(true);
    setConnectedUsers(1); // 세션 참가 시 최소 1명
    setIsConnected(true);

    console.log(`🎉 Session joined: ${code} (${hostStatus ? 'Host' : 'Participant'})`);
  };

  const handleSessionLeft = () => {
    setSessionActive(false);
    setSessionCode('');
    setIsHost(false);
    setConnectedUsers(1);
    setIsConnected(false);

    console.log('👋 Left session');
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
      <App
        sessionInfo={
          sessionActive
            ? {
                sessionCode,
                isHost,
                connectedUsers,
                isConnected,
                onLeaveSession: handleSessionLeft,
              }
            : null
        }
      />
    </>
  );
};

export default MultiUserApp;
