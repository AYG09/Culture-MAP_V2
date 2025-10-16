// src/services/GatewayAdminService.ts
import { database } from '../lib/firebase';
import {
  ref,
  push,
  set,
  onValue,
  off,
  remove,
  update,
  get,
} from 'firebase/database';
import type { DatabaseReference } from 'firebase/database';

// 비밀번호 타입: 워크샵, 컨설팅, 관리자
export type PasswordType = 'admin' | 'workshop' | 'consulting';

export interface GatewayPassword {
  id: string;
  password: string;
  type: PasswordType;  // 변경: 'admin' | 'session' → PasswordType
  sessionCode?: string;
  description?: string;
  createdAt: number;
  expiresAt: number;
  maxUses?: number;
  usedCount: number;
  status: 'active' | 'expired' | 'exhausted';
}

export interface SessionInfo {
  code: string;
  host: string;
  createdAt: number;
  passwordId: string;
  isActive: boolean;
}

class GatewayAdminService {
  private passwordsRef: DatabaseReference;
  private sessionsRef: DatabaseReference;

  constructor() {
    this.passwordsRef = ref(database, 'gateway/passwords');
    this.sessionsRef = ref(database, 'gateway/sessions');
    console.log('🔐 Gateway Admin Service initialized');
  }

  /**
   * 임시 비밀번호 생성
   */
  async createPassword(options: {
    password: string;
    type?: PasswordType;  // 변경: 'admin' | 'session' → PasswordType
    sessionCode?: string;
    description?: string;
    expireHours?: number;
    maxUses?: number;
  }): Promise<{ id: string; password: GatewayPassword }> {
    const {
      password,
      type = 'admin',
      sessionCode,
      description,
      expireHours = 24,
      maxUses,
    } = options;

    const newPasswordRef = push(this.passwordsRef);
    const passwordId = newPasswordRef.key!;

    const now = Date.now();
    const expiresAt = now + expireHours * 60 * 60 * 1000;

    const passwordData: Omit<GatewayPassword, 'id'> = {
      password,
      type,
      ...(sessionCode && { sessionCode }), // sessionCode가 있을 때만 포함
      ...(description && { description }), // description이 있을 때만 포함
      createdAt: now,
      expiresAt,
      ...(maxUses && { maxUses }), // maxUses가 있을 때만 포함
      usedCount: 0,
      status: 'active',
    };

    await set(newPasswordRef, passwordData);

    console.log('✅ Password created:', passwordId);
    return {
      id: passwordId,
      password: { id: passwordId, ...passwordData },
    };
  }

  /**
   * 세션 코드로 자동 비밀번호 생성
   */
  async createSessionPassword(sessionCode: string, expireHours = 24): Promise<string> {
    const result = await this.createPassword({
      password: sessionCode,
      type: 'workshop',  // 변경: 'session' → 'workshop' (기본 모드)
      sessionCode,
      description: `세션 ${sessionCode} 자동 생성 비밀번호`,
      expireHours,
    });

    console.log(`🔑 Session password created for: ${sessionCode}`);
    return result.id;
  }

  /**
   * 비밀번호 검증
   */
  async validatePassword(inputPassword: string): Promise<{
    isValid: boolean;
    isAdmin: boolean;
    passwordId?: string;
    passwordType?: PasswordType;  // 추가: 비밀번호 타입 반환
  }> {
    // 관리자 비밀번호 확인
    const adminPassword = import.meta.env.VITE_GATEWAY_ADMIN_PASSWORD || 'WINTER09@!';
    if (inputPassword === adminPassword) {
      return { isValid: true, isAdmin: true, passwordType: 'admin' };
    }

    // 임시 비밀번호 확인
    const snapshot = await get(this.passwordsRef);
    if (!snapshot.exists()) {
      return { isValid: false, isAdmin: false };
    }

    const passwords = snapshot.val() as Record<string, Omit<GatewayPassword, 'id'>>;
    const now = Date.now();

    for (const [id, pwd] of Object.entries(passwords)) {
      if (pwd.password === inputPassword) {
        // 만료 확인
        if (pwd.expiresAt < now) {
          await this.updatePasswordStatus(id, 'expired');
          return { isValid: false, isAdmin: false };
        }

        // 사용 횟수 확인
        if (pwd.maxUses && pwd.usedCount >= pwd.maxUses) {
          await this.updatePasswordStatus(id, 'exhausted');
          return { isValid: false, isAdmin: false };
        }

        // 사용 횟수 증가
        await this.incrementPasswordUsage(id);

        return { 
          isValid: true, 
          isAdmin: false, 
          passwordId: id,
          passwordType: pwd.type,  // 추가: 비밀번호 타입 반환
        };
      }
    }

    return { isValid: false, isAdmin: false };
  }

  /**
   * 비밀번호 사용 횟수 증가
   */
  private async incrementPasswordUsage(passwordId: string): Promise<void> {
    const passwordRef = ref(database, `gateway/passwords/${passwordId}`);
    const snapshot = await get(passwordRef);

    if (snapshot.exists()) {
      const pwd = snapshot.val() as Omit<GatewayPassword, 'id'>;
      const newUsedCount = pwd.usedCount + 1;

      const updates: Partial<GatewayPassword> = {
        usedCount: newUsedCount,
      };

      // 최대 사용 횟수에 도달하면 상태 변경
      if (pwd.maxUses && newUsedCount >= pwd.maxUses) {
        updates.status = 'exhausted';
      }

      await update(passwordRef, updates);
    }
  }

  /**
   * 비밀번호 상태 업데이트
   */
  private async updatePasswordStatus(
    passwordId: string,
    status: 'active' | 'expired' | 'exhausted'
  ): Promise<void> {
    const passwordRef = ref(database, `gateway/passwords/${passwordId}`);
    await update(passwordRef, { status });
  }

  /**
   * 모든 비밀번호 가져오기
   */
  async getAllPasswords(): Promise<GatewayPassword[]> {
    const snapshot = await get(this.passwordsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const passwords = snapshot.val() as Record<string, Omit<GatewayPassword, 'id'>>;
    const now = Date.now();

    // 배열로 변환하고 만료된 비밀번호 상태 업데이트
    const result: GatewayPassword[] = [];

    for (const [id, pwd] of Object.entries(passwords)) {
      const password: GatewayPassword = { id, ...pwd };

      // 만료 확인
      if (password.status === 'active' && password.expiresAt < now) {
        password.status = 'expired';
        await this.updatePasswordStatus(id, 'expired');
      }

      result.push(password);
    }

    // 최신순 정렬
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 비밀번호 삭제
   */
  async deletePassword(passwordId: string): Promise<void> {
    const passwordRef = ref(database, `gateway/passwords/${passwordId}`);
    await remove(passwordRef);
    console.log('🗑️ Password deleted:', passwordId);
  }

  /**
   * 세션 코드로 비밀번호 삭제
   */
  async deletePasswordBySessionCode(sessionCode: string): Promise<void> {
    const snapshot = await get(this.passwordsRef);

    if (!snapshot.exists()) {
      return;
    }

    const passwords = snapshot.val() as Record<string, Omit<GatewayPassword, 'id'>>;

    for (const [id, pwd] of Object.entries(passwords)) {
      if (pwd.sessionCode === sessionCode) {
        await this.deletePassword(id);
        console.log(`🗑️ Session password deleted for: ${sessionCode}`);
      }
    }
  }

  /**
   * 비밀번호 변경 실시간 리스닝
   */
  onPasswordsChange(callback: (passwords: GatewayPassword[]) => void): () => void {
    const unsubscribe = onValue(this.passwordsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const passwords = snapshot.val() as Record<string, Omit<GatewayPassword, 'id'>>;
      const now = Date.now();

      const result: GatewayPassword[] = [];

      for (const [id, pwd] of Object.entries(passwords)) {
        const password: GatewayPassword = { id, ...pwd };

        // 만료 확인
        if (password.status === 'active' && password.expiresAt < now) {
          password.status = 'expired';
          await this.updatePasswordStatus(id, 'expired');
        }

        result.push(password);
      }

      // 최신순 정렬
      callback(result.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => off(this.passwordsRef, 'value', unsubscribe);
  }

  /**
   * 세션 정보 등록
   */
  async registerSession(
    sessionCode: string,
    host: string,
    passwordId: string
  ): Promise<void> {
    const sessionRef = ref(database, `gateway/sessions/${sessionCode}`);

    const sessionData: Omit<SessionInfo, 'code'> = {
      host,
      createdAt: Date.now(),
      passwordId,
      isActive: true,
    };

    await set(sessionRef, sessionData);
    console.log('📝 Session registered:', sessionCode);
  }

  /**
   * 세션 종료
   */
  async endSession(sessionCode: string): Promise<void> {
    const sessionRef = ref(database, `gateway/sessions/${sessionCode}`);
    const snapshot = await get(sessionRef);

    if (snapshot.exists()) {
      const session = snapshot.val() as Omit<SessionInfo, 'code'>;

      // 세션 비활성화
      await update(sessionRef, { isActive: false });

      // 연동된 비밀번호 삭제
      if (session.passwordId) {
        await this.deletePassword(session.passwordId);
      }

      console.log('🔚 Session ended:', sessionCode);
    }
  }

  /**
   * 모든 세션 가져오기
   */
  async getAllSessions(): Promise<(SessionInfo & { code: string })[]> {
    const snapshot = await get(this.sessionsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const sessions = snapshot.val() as Record<string, Omit<SessionInfo, 'code'>>;

    return Object.entries(sessions).map(([code, session]) => ({
      code,
      ...session,
    }));
  }

  /**
   * 랜덤 비밀번호 생성 유틸리티
   */
  generateRandomPassword(length = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

// 싱글톤 인스턴스 생성
const gatewayAdminService = new GatewayAdminService();
export default gatewayAdminService;
