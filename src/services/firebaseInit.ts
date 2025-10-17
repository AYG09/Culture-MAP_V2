/**
 * Firebase 초기화 및 설정
 * - 모든 Firebase 서비스 초기화
 * - 환경 변수 기반 설정
 * - 최적화 활성화
 */

import { initializeAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { FirebaseOptions } from 'firebase/app';
import { getApp } from 'firebase/app';
import { getFirebaseOptimizationService } from './FirebaseOptimizationService';

// Firebase 설정 로드
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

interface FirebaseInitConfig {
  enableAuth?: boolean;
  enableAppCheck?: boolean;
  enableOptimization?: boolean;
  useEmulator?: boolean;
}

/**
 * Firebase 초기화
 */
export async function initializeFirebase(
  config: FirebaseInitConfig = {}
): Promise<void> {
  const {
    enableAuth = false,
    enableAppCheck = false,
    enableOptimization = true,
    useEmulator = false,
  } = config;

  try {
    // 최적화 서비스 초기화
    if (enableOptimization) {
      const optimizationService = getFirebaseOptimizationService();
      optimizationService.initialize(firebaseConfig);
      console.log('✅ Firebase 최적화 서비스 활성화됨');
    }

    const app = getApp();

    // Auth 초기화 (필요한 경우)
    if (enableAuth) {
      const auth = initializeAuth(app);

      // 개발 환경에서 Emulator 사용 (선택사항)
      if (useEmulator && !import.meta.env.PROD) {
        try {
          connectAuthEmulator(auth, 'http://localhost:9099');
          console.log('🔧 Auth Emulator 연결됨');
        } catch (error) {
          // Emulator가 실행 중이지 않으면 무시
          console.debug('Auth Emulator 연결 실패 (정상):', error);
        }
      }

      console.log('✅ Firebase Auth 초기화됨');
    }

    // App Check 초기화 (프로덕션 환경)
    if (enableAppCheck && import.meta.env.PROD) {
      const reCaptchaV3Provider = new ReCaptchaV3Provider(
        import.meta.env.VITE_RECAPTCHA_V3_PUBLIC_KEY || ''
      );
      await initializeAppCheck(app, {
        provider: reCaptchaV3Provider,
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ Firebase App Check 활성화됨');
    }

    console.log('✅ Firebase 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase 초기화 실패:', error);
    throw error;
  }
}

/**
 * Firebase 최적화 서비스 조회
 */
export function useFirebaseOptimization() {
  return getFirebaseOptimizationService();
}

export { firebaseConfig };
