import { GATEWAY_CONFIG } from './config.js';

// 랜덤 비밀번호 생성
export const generateRandomPassword = (length = GATEWAY_CONFIG.autoPasswordLength) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 현재 시간에서 지정된 시간 후의 Date 객체 반환
export const getExpiryDate = (hours = GATEWAY_CONFIG.defaultExpireHours) => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

// 만료 여부 확인
export const isExpired = (expiryDate) => {
  return new Date() > new Date(expiryDate);
};

// 남은 시간 계산 (시간 단위)
export const getRemainingHours = (expiryDate) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry - now;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
};

// 비밀번호 유효성 검사
export const validatePassword = (password) => {
  if (!password || password.length < GATEWAY_CONFIG.minPasswordLength) {
    return {
      valid: false,
      message: `비밀번호는 최소 ${GATEWAY_CONFIG.minPasswordLength}자 이상이어야 합니다.`
    };
  }
  return { valid: true };
};

// 세션 토큰 생성
export const generateSessionToken = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
};

// 로컬 스토리지에 인증 토큰 저장
export const saveAuthToken = (token, isAdmin = false) => {
  if (typeof localStorage !== 'undefined') {
    const authData = {
      token,
      isAdmin,
      timestamp: Date.now(),
      expiresAt: Date.now() + GATEWAY_CONFIG.sessionExpireMs
    };
    localStorage.setItem(GATEWAY_CONFIG.authTokenKey, JSON.stringify(authData));
  }
};

// 로컬 스토리지에서 인증 토큰 가져오기
export const getAuthToken = () => {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(GATEWAY_CONFIG.authTokenKey);
      if (stored) {
        const authData = JSON.parse(stored);
        
        // 만료 확인
        if (Date.now() > authData.expiresAt) {
          removeAuthToken();
          return null;
        }
        
        return authData;
      }
    } catch (error) {
      console.error('Auth token parse error:', error);
      removeAuthToken();
    }
  }
  return null;
};

// 로컬 스토리지에서 인증 토큰 제거
export const removeAuthToken = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(GATEWAY_CONFIG.authTokenKey);
  }
};

// API 호출 헬퍼
export const gatewayFetch = async (endpoint, options = {}) => {
  const url = `${GATEWAY_CONFIG.apiBasePath}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const authToken = getAuthToken();
  if (authToken) {
    defaultOptions.headers['Authorization'] = `Bearer ${authToken.token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Gateway API Error:', error);
    return { 
      success: false, 
      error: error.message,
      networkError: error.name === 'TypeError' && error.message.includes('fetch')
    };
  }
};

// 현재 사용자가 인증되었는지 확인
export const isAuthenticated = () => {
  const authToken = getAuthToken();
  return authToken !== null;
};

// 현재 사용자가 관리자인지 확인
export const isAdmin = () => {
  const authToken = getAuthToken();
  return authToken && authToken.isAdmin;
};

// 시간 포맷팅 (예: "2시간 30분 후 만료")
export const formatTimeRemaining = (expiryDate) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry - now;
  
  if (diffMs <= 0) {
    return '만료됨';
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후 만료`;
  } else if (minutes > 0) {
    return `${minutes}분 후 만료`;
  } else {
    const seconds = Math.floor(diffMs / 1000);
    return `${seconds}초 후 만료`;
  }
};

// 에러 메시지 표준화
export const getErrorMessage = (error, defaultMessage = GATEWAY_CONFIG.messages.serverError) => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.networkError) {
    return GATEWAY_CONFIG.messages.networkError;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return defaultMessage;
};

// 클립보드에 텍스트 복사
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 폴백 방법
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  } catch (error) {
    console.error('클립보드 복사 실패:', error);
    return false;
  }
};

export default {
  generateRandomPassword,
  getExpiryDate,
  isExpired,
  getRemainingHours,
  validatePassword,
  generateSessionToken,
  saveAuthToken,
  getAuthToken,
  removeAuthToken,
  gatewayFetch,
  isAuthenticated,
  isAdmin,
  formatTimeRemaining,
  getErrorMessage,
  copyToClipboard,
};