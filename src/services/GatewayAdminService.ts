// src/services/GatewayAdminService.ts
// Firebase 대신 localStorage를 사용하는 간소화된 버전

// 비밀번호 타입: 워크샵, 컨설팅, 관리자
export type PasswordType = 'admin' | 'workshop' | 'consulting';

export interface GatewayPassword {
  id: string;
  password: string;
  type: PasswordType;
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

const STORAGE_KEY_PASSWORDS = 'gateway_passwords';
const STORAGE_KEY_SESSIONS = 'gateway_sessions';

class GatewayAdminService {
  constructor() {
    console.log('🔐 Gateway Admin Service initialized (localStorage mode)');
  }

  private getPasswords(): Record<string, Omit<GatewayPassword, 'id'>> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PASSWORDS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private savePasswords(passwords: Record<string, Omit<GatewayPassword, 'id'>>): void {
    localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(passwords));
  }

  private getSessions(): Record<string, Omit<SessionInfo, 'code'>> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SESSIONS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveSessions(sessions: Record<string, Omit<SessionInfo, 'code'>>): void {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  }

  /**
   * 임시 비밀번호 생성
   */
  async createPassword(options: {
    password: string;
    type?: PasswordType;
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

    const passwordId = `pwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const expiresAt = now + expireHours * 60 * 60 * 1000;

    const passwordData: Omit<GatewayPassword, 'id'> = {
      password,
      type,
      ...(sessionCode && { sessionCode }),
      ...(description && { description }),
      createdAt: now,
      expiresAt,
      ...(maxUses && { maxUses }),
      usedCount: 0,
      status: 'active',
    };

    const passwords = this.getPasswords();
    passwords[passwordId] = passwordData;
    this.savePasswords(passwords);

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
      type: 'workshop',
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
    passwordType?: PasswordType;
  }> {
    // 관리자 비밀번호 확인
    const adminPassword = import.meta.env.VITE_GATEWAY_ADMIN_PASSWORD || 'excadmin';
    if (inputPassword === adminPassword) {
      return { isValid: true, isAdmin: true, passwordType: 'admin' };
    }

    // 임시 비밀번호 확인
    const passwords = this.getPasswords();
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

        const isAdmin = pwd.type === 'admin';

        return {
          isValid: true,
          isAdmin,
          passwordId: id,
          passwordType: pwd.type,
        };
      }
    }

    return { isValid: false, isAdmin: false };
  }

  /**
   * 비밀번호 사용 횟수 증가
   */
  private async incrementPasswordUsage(passwordId: string): Promise<void> {
    const passwords = this.getPasswords();
    const pwd = passwords[passwordId];

    if (pwd) {
      pwd.usedCount += 1;

      if (pwd.maxUses && pwd.usedCount >= pwd.maxUses) {
        pwd.status = 'exhausted';
      }

      passwords[passwordId] = pwd;
      this.savePasswords(passwords);
    }
  }

  /**
   * 비밀번호 상태 업데이트
   */
  private async updatePasswordStatus(
    passwordId: string,
    status: 'active' | 'expired' | 'exhausted'
  ): Promise<void> {
    const passwords = this.getPasswords();
    if (passwords[passwordId]) {
      passwords[passwordId].status = status;
      this.savePasswords(passwords);
    }
  }

  /**
   * 모든 비밀번호 가져오기
   */
  async getAllPasswords(): Promise<GatewayPassword[]> {
    const passwords = this.getPasswords();
    const now = Date.now();
    const result: GatewayPassword[] = [];

    for (const [id, pwd] of Object.entries(passwords)) {
      const password: GatewayPassword = { id, ...pwd };

      if (password.status === 'active' && password.expiresAt < now) {
        password.status = 'expired';
        await this.updatePasswordStatus(id, 'expired');
      }

      result.push(password);
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 비밀번호 삭제
   */
  async deletePassword(passwordId: string): Promise<void> {
    const passwords = this.getPasswords();
    delete passwords[passwordId];
    this.savePasswords(passwords);
    console.log('🗑️ Password deleted:', passwordId);
  }

  /**
   * 비밀번호 변경 리스닝 (폴링 방식으로 시뮬레이션)
   */
  onPasswordsChange(callback: (passwords: GatewayPassword[]) => void): () => void {
    const checkPasswords = async () => {
      const passwords = await this.getAllPasswords();
      callback(passwords);
    };

    // 초기 호출
    void checkPasswords();

    // 5초마다 폴링
    const intervalId = setInterval(checkPasswords, 5000);

    return () => clearInterval(intervalId);
  }

  /**
   * 세션 정보 등록
   */
  async registerSession(
    sessionCode: string,
    host: string,
    passwordId: string
  ): Promise<void> {
    const sessions = this.getSessions();

    sessions[sessionCode] = {
      host,
      createdAt: Date.now(),
      passwordId,
      isActive: true,
    };

    this.saveSessions(sessions);
    console.log('📝 Session registered:', sessionCode);
  }

  /**
   * 세션 종료
   */
  async endSession(sessionCode: string): Promise<void> {
    const sessions = this.getSessions();
    const session = sessions[sessionCode];

    if (session) {
      session.isActive = false;
      sessions[sessionCode] = session;
      this.saveSessions(sessions);

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
    const sessions = this.getSessions();

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
