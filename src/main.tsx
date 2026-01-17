import React from 'react';
import ReactDOM from 'react-dom/client';
import MultiUserApp from './components/MultiUserApp.tsx';
import './index.css';
import 'react-quill-new/dist/quill.snow.css'; // React Quill New 스타일
import ErrorBoundary from './components/ErrorBoundary.tsx';
import liveblocksService from './services/LiveblocksService';
import { aiService } from './services/AIService';

// Liveblocks 앱 초기화
async function initializeApp() {
  console.log('🔗 Liveblocks 웹서비스 초기화...');

  // Liveblocks 클라이언트 초기화
  try {
    const publicKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;
    if (publicKey) {
      liveblocksService.initialize(publicKey);
      console.log('✅ Liveblocks 준비 완료');
    } else {
      console.warn('⚠️ Liveblocks API 키가 설정되지 않음 - 협업 기능 비활성화');
    }
  } catch (error) {
    console.error('❌ Liveblocks 초기화 오류:', error);
  }

  try {
    aiService.initializeFromStorage();
    console.log('✅ AI 설정/학술 PDF 캐시 복원 완료');
  } catch (error) {
    console.error('❌ AI 설정 캐시 복원 오류:', error);
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
