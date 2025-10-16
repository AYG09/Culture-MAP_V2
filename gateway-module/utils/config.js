// Gateway 시스템 설정
export const GATEWAY_CONFIG = {
  // 기본 임시 비밀번호 유효 시간 (시간)
  defaultExpireHours: 24,
  
  // 최대 동시 임시 비밀번호 개수
  maxTempPasswords: 20,
  
  // 비밀번호 최소 길이
  minPasswordLength: 6,
  
  // 자동 생성 비밀번호 길이
  autoPasswordLength: 8,
  
  // 세션 만료 시간 (밀리초)
  sessionExpireMs: 24 * 60 * 60 * 1000, // 24시간
  
  // API 기본 경로
  apiBasePath: '/api',
  
  // 로컬 스토리지 키 이름
  authTokenKey: 'gateway-auth-token',
  
  // 관리자 권한 확인 주기 (밀리초)
  adminCheckInterval: 60 * 1000, // 1분
  
  // UI 설정
  ui: {
    title: '접근 인증 필요',
    subtitle: '비밀번호를 입력해주세요',
    adminTitle: '관리자 로그인',
    tempPasswordPlaceholder: '비밀번호 입력',
    loginButtonText: '입장하기',
    
    // 스타일 테마
    theme: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      successColor: '#28a745',
      errorColor: '#dc3545',
      backgroundColor: '#f8f9fa',
    }
  },
  
  // 오류 메시지
  messages: {
    invalidPassword: '잘못된 비밀번호입니다.',
    expiredPassword: '만료된 비밀번호입니다.',
    serverError: '서버 오류가 발생했습니다.',
    networkError: '네트워크 연결을 확인해주세요.',
    accessDenied: '접근이 거부되었습니다.',
    sessionExpired: '세션이 만료되었습니다. 다시 로그인해주세요.',
  },
  
  // 성공 메시지
  successMessages: {
    loginSuccess: '로그인 성공!',
    passwordCreated: '임시 비밀번호가 생성되었습니다.',
    passwordDeleted: '비밀번호가 삭제되었습니다.',
  }
};

// 환경변수에서 설정 가져오기
export const getEnvConfig = () => {
  if (typeof process !== 'undefined' && process.env) {
    return {
      adminPassword: process.env.GATEWAY_ADMIN_PASSWORD,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_ANON_KEY,
      defaultExpireHours: parseInt(process.env.GATEWAY_DEFAULT_EXPIRE_HOURS) || GATEWAY_CONFIG.defaultExpireHours,
    };
  }
  return {};
};

// 런타임 설정 검증
export const validateConfig = () => {
  const env = getEnvConfig();
  const errors = [];
  
  if (!env.adminPassword) {
    errors.push('GATEWAY_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
  }
  
  if (!env.supabaseUrl) {
    errors.push('SUPABASE_URL 환경변수가 설정되지 않았습니다.');
  }
  
  if (!env.supabaseKey) {
    errors.push('SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.');
  }
  
  if (errors.length > 0) {
    console.error('Gateway 설정 오류:', errors);
    return false;
  }
  
  return true;
};

export default GATEWAY_CONFIG;