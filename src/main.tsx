import React from 'react';
import ReactDOM from 'react-dom/client';
import MultiUserApp from './components/MultiUserApp.tsx';
import './index.css';
import 'react-quill-new/dist/quill.snow.css'; // React Quill New 스타일
import ErrorBoundary from './components/ErrorBoundary.tsx';
import authService from './services/AuthService';

// Firebase 앱 초기화 (Auth 포함)
async function initializeApp() {
  console.log('🔥 Firebase 웹서비스 초기화...');
  
  // 익명 인증 초기화 (보안 규칙 충족을 위해 필수)
  try {
    const user = await authService.initializeAuth();
    if (user) {
      console.log('✅ Firebase Auth 준비 완료');
    } else {
      console.warn('⚠️ Firebase Auth 초기화 실패 - 일부 기능이 제한될 수 있습니다');
    }
  } catch (error) {
    console.error('❌ Firebase Auth 오류:', error);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <MultiUserApp />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

// DOM 로딩 완료 후 앱 초기화 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
