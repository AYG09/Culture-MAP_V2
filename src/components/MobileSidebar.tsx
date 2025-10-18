import { useState } from 'react';
import './MobileSidebar.css';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function MobileSidebar({ isOpen, onClose, children }: MobileSidebarProps) {
  return (
    <>
      {/* 오버레이 (배경 어둡게) */}
      {isOpen && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={onClose}
        />
      )}

      {/* 슬라이드 사이드바 */}
      <div className={`mobile-sidebar ${isOpen ? 'open' : ''}`}>
        {/* 헤더 */}
        <div className="mobile-sidebar-header">
          <h2>조직문화 분석기</h2>
          <button
            className="mobile-sidebar-close"
            onClick={onClose}
            aria-label="사이드바 닫기"
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="mobile-sidebar-content">
          {children}
        </div>
      </div>
    </>
  );
}
