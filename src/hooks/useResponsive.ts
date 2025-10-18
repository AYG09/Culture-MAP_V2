import { useState, useEffect } from 'react';

export type ViewMode = 'mobile' | 'tablet' | 'desktop';

export const BREAKPOINTS = {
  mobile: 0,      // 0-767px
  tablet: 768,    // 768-1023px
  desktop: 1024   // 1024px+
} as const;

/**
 * 반응형 뷰 모드 감지 훅
 * 
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export const useResponsive = (): ViewMode => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // SSR 대응: 초기값 설정
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < BREAKPOINTS.tablet) return 'mobile';
    if (width < BREAKPOINTS.desktop) return 'tablet';
    return 'desktop';
  });
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < BREAKPOINTS.tablet) {
        setViewMode('mobile');
      } else if (width < BREAKPOINTS.desktop) {
        setViewMode('tablet');
      } else {
        setViewMode('desktop');
      }
    };
    
    // 초기 실행
    handleResize();
    
    // 리사이즈 이벤트 리스너 등록
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return viewMode;
};

/**
 * 모바일 여부 체크 훅
 */
export const useIsMobile = (): boolean => {
  const viewMode = useResponsive();
  return viewMode === 'mobile';
};

/**
 * 태블릿 여부 체크 훅
 */
export const useIsTablet = (): boolean => {
  const viewMode = useResponsive();
  return viewMode === 'tablet';
};

/**
 * 데스크톱 여부 체크 훅
 */
export const useIsDesktop = (): boolean => {
  const viewMode = useResponsive();
  return viewMode === 'desktop';
};
