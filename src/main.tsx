import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import MultiUserApp from './components/MultiUserApp.tsx';
import './index.css';
import './styles/layerSystem.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Firebase 앱 초기화 (SQL.js 불필요)
function initializeApp() {
  console.log('🔥 Firebase 애플리케이션 초기화 시작...');

  // 데이터베이스 초기화 완료 후 React 앱 렌더링
  // 멀티유저 모드 결정 로직
  const urlParams = new URLSearchParams(window.location.search);
  const explicitMultiUser = urlParams.get('multiuser') === 'true';
  const currentHost = window.location.hostname;

  // Firebase 모드에서는 기본적으로 멀티유저 모드, IP 주소로 접속하거나 명시적으로 multiuser=true인 경우도 멀티유저 모드
  const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(currentHost);
  const isFirebaseMode = import.meta.env.MODE === 'firebase';
  const multiUserMode = isFirebaseMode || explicitMultiUser || isIPAddress;

  console.log('🔍 Multi-user mode detection:', {
    currentHost,
    isIPAddress,
    explicitMultiUser,
    isFirebaseMode,
    multiUserMode,
  });

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>{multiUserMode ? <MultiUserApp /> : <App />}</ErrorBoundary>
    </React.StrictMode>
  );
}

// DOM 로딩 완료 후 앱 초기화 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
