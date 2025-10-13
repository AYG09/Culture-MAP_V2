/**
 * 모바일 디바이스 감지 유틸리티
 */

// Window 인터페이스 확장
interface WindowWithOpera extends Window {
  opera?: string;
  MSStream?: unknown;
}

// Navigator 확장
interface ExtendedNavigator {
  vendor?: string;
  msMaxTouchPoints?: number;
}

/**
 * 현재 디바이스가 모바일인지 확인
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // User Agent 체크
  const nav = navigator as ExtendedNavigator;
  const userAgent = navigator.userAgent || nav.vendor || (window as WindowWithOpera).opera || '';
  
  // 모바일 User Agent 패턴
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // 터치 지원 체크 (hover: none)
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  
  // 화면 크기 체크
  const isSmallScreen = window.innerWidth < 768;
  
  return mobileRegex.test(userAgent) || (isTouchDevice && isSmallScreen);
}

/**
 * 태블릿인지 확인
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as ExtendedNavigator;
  const userAgent = navigator.userAgent || nav.vendor || (window as WindowWithOpera).opera || '';
  
  // iPad 체크
  const isIPad = /iPad/.test(userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Android 태블릿 체크
  const isAndroidTablet = /Android/.test(userAgent) && !/Mobile/.test(userAgent);
  
  return isIPad || isAndroidTablet;
}

/**
 * iOS 디바이스인지 확인
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as ExtendedNavigator;
  const userAgent = navigator.userAgent || nav.vendor || (window as WindowWithOpera).opera || '';
  
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as WindowWithOpera).MSStream;
}

/**
 * Android 디바이스인지 확인
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as ExtendedNavigator;
  const userAgent = navigator.userAgent || nav.vendor || (window as WindowWithOpera).opera || '';
  
  return /Android/.test(userAgent);
}

/**
 * 터치 지원 여부 확인
 */
export function isTouchSupported(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as ExtendedNavigator;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (nav.msMaxTouchPoints !== undefined && nav.msMaxTouchPoints > 0)
  );
}

/**
 * 화면 방향 감지
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'portrait';

  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * 뷰포트 크기 가져오기
 */
export function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

/**
 * 디바이스 정보 가져오기
 */
export function getDeviceInfo() {
  return {
    isMobile: isMobileDevice(),
    isTablet: isTablet(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isTouchSupported: isTouchSupported(),
    orientation: getOrientation(),
    viewport: getViewportSize(),
  };
}
