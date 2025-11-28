/**
 * Firebase Anonymous Authentication 서비스
 * - 앱 시작 시 자동으로 익명 로그인
 * - 사용자 세션 유지
 * - 보안 규칙에서 auth != null 검증 가능
 */

import { 
  signInAnonymously, 
  onAuthStateChanged,
  type User,
  type Auth
} from 'firebase/auth';
import { auth } from '../lib/firebase';

// 인증 상태
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// 인증 상태 변경 콜백 타입
type AuthStateCallback = (state: AuthState) => void;

class AuthService {
  private currentUser: User | null = null;
  private isInitialized: boolean = false;
  private listeners: Set<AuthStateCallback> = new Set();
  private authInstance: Auth;

  constructor() {
    this.authInstance = auth;
    this.setupAuthStateListener();
  }

  /**
   * Firebase Auth 상태 변경 리스너 설정
   */
  private setupAuthStateListener(): void {
    onAuthStateChanged(this.authInstance, (user) => {
      this.currentUser = user;
      this.isInitialized = true;
      
      if (user) {
        console.log('🔐 Auth state: 로그인됨 (UID:', user.uid.substring(0, 8) + '...)');
      } else {
        console.log('🔐 Auth state: 로그아웃됨');
      }

      // 모든 리스너에게 상태 변경 알림
      this.notifyListeners();
    });
  }

  /**
   * 익명 로그인 실행
   * - 이미 로그인된 경우 현재 사용자 반환
   * - 로그인되지 않은 경우 새로 익명 로그인
   */
  async signInAnonymous(): Promise<User | null> {
    try {
      // 이미 로그인된 경우
      if (this.currentUser) {
        console.log('✅ 이미 로그인됨:', this.currentUser.uid.substring(0, 8) + '...');
        return this.currentUser;
      }

      console.log('🔐 익명 로그인 시도 중...');
      const credential = await signInAnonymously(this.authInstance);
      this.currentUser = credential.user;
      
      console.log('✅ 익명 로그인 성공:', credential.user.uid.substring(0, 8) + '...');
      return credential.user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error('❌ 익명 로그인 실패:', errorMessage);
      
      // 리스너에게 에러 알림
      this.notifyListeners(errorMessage);
      return null;
    }
  }

  /**
   * 현재 사용자 가져오기
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * 현재 사용자 UID 가져오기
   */
  getCurrentUserId(): string | null {
    return this.currentUser?.uid || null;
  }

  /**
   * 인증 여부 확인
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * 초기화 완료 여부 확인
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 인증 상태 가져오기
   */
  getAuthState(): AuthState {
    return {
      user: this.currentUser,
      isAuthenticated: this.currentUser !== null,
      isLoading: !this.isInitialized,
      error: null,
    };
  }

  /**
   * 인증 상태 변경 리스너 등록
   */
  onAuthStateChange(callback: AuthStateCallback): () => void {
    this.listeners.add(callback);
    
    // 현재 상태 즉시 전달
    callback(this.getAuthState());
    
    // 구독 해제 함수 반환
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * 모든 리스너에게 상태 변경 알림
   */
  private notifyListeners(error?: string): void {
    const state: AuthState = {
      ...this.getAuthState(),
      error: error || null,
    };

    this.listeners.forEach((callback) => {
      try {
        callback(state);
      } catch (e) {
        console.error('Auth listener error:', e);
      }
    });
  }

  /**
   * 인증이 준비될 때까지 대기
   */
  async waitForAuth(): Promise<User | null> {
    // 이미 초기화되었으면 바로 반환
    if (this.isInitialized) {
      return this.currentUser;
    }

    // 초기화될 때까지 대기
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.authInstance, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * 앱 시작 시 자동 인증
   * - 기존 세션이 있으면 유지
   * - 없으면 익명 로그인
   */
  async initializeAuth(): Promise<User | null> {
    console.log('🔐 Firebase Auth 초기화 중...');
    
    // 기존 인증 상태 확인
    const existingUser = await this.waitForAuth();
    
    if (existingUser) {
      console.log('✅ 기존 세션 복원:', existingUser.uid.substring(0, 8) + '...');
      return existingUser;
    }

    // 익명 로그인 실행
    return this.signInAnonymous();
  }
}

// 싱글톤 인스턴스
const authService = new AuthService();

export default authService;
export type { AuthState };
