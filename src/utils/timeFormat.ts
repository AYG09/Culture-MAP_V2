// src/utils/timeFormat.ts

/**
 * 타임스탬프를 상대적 시간 문자열로 변환
 * @param timestamp - Unix timestamp (밀리초)
 * @returns 상대적 시간 문자열 (예: '5분 전', '2시간 전', '어제')
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return '방금 전';
  } else if (minutes < 60) {
    return `${minutes}분 전`;
  } else if (hours < 24) {
    return `${hours}시간 전`;
  } else if (days === 1) {
    return '어제';
  } else if (days < 7) {
    return `${days}일 전`;
  } else {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  }
};

/**
 * 타임스탬프를 절대 시간 문자열로 변환
 * @param timestamp - Unix timestamp (밀리초)
 * @returns 날짜/시간 문자열
 */
export const formatAbsoluteTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
