import React from 'react';
import ReactDOM from 'react-dom/client';
import MultiUserApp from './components/MultiUserApp.tsx';
import './index.css';
import './styles/layerSystem.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Firebase 앱 초기화
function initializeApp() {
  console.log('🔥 Firebase 웹서비스 초기화...');

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
