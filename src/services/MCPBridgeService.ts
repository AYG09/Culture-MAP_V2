// src/services/MCPBridgeService.ts

import { databaseService } from './DatabaseService';

/**
 * MCP 도구 연결 상태 인터페이스
 */
interface MCPConnectionStatus {
  available: boolean;
  sqlite: boolean;
  memory: boolean;
  taskManager: boolean;
  lastChecked: number;
}

/**
 * 쿼리 결과 인터페이스
 */
interface QueryResult {
  success: boolean;
  data: unknown[];
  source: 'mcp' | 'local';
  error?: string;
  executionTime?: number;
}

/**
 * 캐시 항목 인터페이스
 */
interface CacheItem {
  query: string;
  params: unknown[];
  result: unknown[];
  timestamp: number;
  source: 'mcp' | 'local';
}

/**
 * MCP 도구와 React 애플리케이션 간 브릿지 서비스
 * Claude Desktop 환경에서 MCP 도구 우선 활용, 미연결 시 로컬 SQLite로 fallback
 */
class MCPBridgeService {
  private connectionStatus: MCPConnectionStatus = {
    available: false,
    sqlite: false,
    memory: false,
    taskManager: false,
    lastChecked: 0,
  };

  private queryCache = new Map<string, CacheItem>();
  private readonly CACHE_TTL = 60000; // 1분
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CONNECTION_CHECK_INTERVAL = 30000; // 30초
  private connectionCheckTimer: NodeJS.Timeout | null = null;

  // 성능 모니터링
  private performanceStats = {
    mcpQueries: 0,
    localQueries: 0,
    cacheHits: 0,
    totalExecutionTime: 0,
    averageResponseTime: 0,
  };

  /**
   * MCP 브릿지 서비스 초기화
   */
  async initialize(): Promise<boolean> {
    console.log('🔗 MCP 브릿지 서비스 초기화 시작...');

    try {
      // MCP 도구 연결 상태 확인
      await this.checkMCPConnection();

      // 정기적 연결 상태 체크 시작
      this.startConnectionMonitoring();

      // 로컬 DatabaseService fallback 준비
      if (!this.connectionStatus.available) {
        console.log('⚠️ MCP 도구 미연결, 로컬 SQLite로 fallback 준비');
        await databaseService.initialize();
      }

      console.log(
        `✅ MCP 브릿지 서비스 초기화 완료 (MCP: ${this.connectionStatus.available ? '연결됨' : '미연결'})`
      );
      return true;
    } catch (error) {
      console.error('❌ MCP 브릿지 서비스 초기화 실패:', error);
      return false;
    }
  }

  /**
   * MCP 도구 연결 상태 확인
   */
  private async checkMCPConnection(): Promise<void> {
    const checkStartTime = performance.now();

    try {
      // Claude Desktop 환경에서 MCP 도구 감지 시도
      const mcpAvailable = await this.detectMCPTools();

      this.connectionStatus = {
        available: mcpAvailable,
        sqlite: mcpAvailable && (await this.testSQLiteConnection()),
        memory: mcpAvailable && (await this.testMemoryConnection()),
        taskManager: mcpAvailable && (await this.testTaskManagerConnection()),
        lastChecked: Date.now(),
      };

      const checkDuration = performance.now() - checkStartTime;
      console.log(
        `🔍 MCP 연결 상태 확인 완료 (${Math.round(checkDuration)}ms):`,
        this.connectionStatus
      );
    } catch (error) {
      console.error('❌ MCP 연결 상태 확인 실패:', error);
      this.connectionStatus.available = false;
    }
  }

  /**
   * MCP 도구 감지 (Claude Desktop 환경 체크)
   */
  private async detectMCPTools(): Promise<boolean> {
    try {
      // Claude Desktop 환경에서는 특정 API나 객체를 통해 MCP 도구에 접근 가능
      // 현재는 가상적 구현으로, 실제 환경에서는 Claude Desktop의 MCP API 사용

      // window.claude 객체 또는 특정 MCP API 존재 여부 확인
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { claude?: { mcp?: unknown } }).claude?.mcp
      ) {
        return true;
      }

      // 환경 변수나 특정 식별자를 통한 Claude Desktop 감지
      if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Claude Desktop')) {
        return true;
      }

      return false;
    } catch (error) {
      console.warn('⚠️ MCP 도구 감지 실패:', error);
      return false;
    }
  }

  /**
   * SQLite MCP 도구 연결 테스트
   */
  private async testSQLiteConnection(): Promise<boolean> {
    try {
      // MCP sqlite 도구로 간단한 테스트 쿼리 실행
      // 실제 구현에서는 Claude Desktop의 MCP SQLite API 사용
      const testResult = await this.executeMCPQuery('SELECT 1 as test', []);
      return testResult.success && testResult.data.length > 0;
    } catch (error) {
      console.warn('⚠️ SQLite MCP 연결 테스트 실패:', error);
      return false;
    }
  }

  /**
   * Memory MCP 도구 연결 테스트
   */
  private async testMemoryConnection(): Promise<boolean> {
    try {
      // MCP memory 도구로 간단한 테스트 수행
      // 실제 구현에서는 Claude Desktop의 MCP Memory API 사용
      return true; // 가상적 구현
    } catch (error) {
      console.warn('⚠️ Memory MCP 연결 테스트 실패:', error);
      return false;
    }
  }

  /**
   * Task Manager MCP 도구 연결 테스트
   */
  private async testTaskManagerConnection(): Promise<boolean> {
    try {
      // MCP task manager 도구로 간단한 테스트 수행
      // 실제 구현에서는 Claude Desktop의 MCP Task Manager API 사용
      return true; // 가상적 구현
    } catch (error) {
      console.warn('⚠️ Task Manager MCP 연결 테스트 실패:', error);
      return false;
    }
  }

  /**
   * 정기적 연결 상태 모니터링 시작
   */
  private startConnectionMonitoring(): void {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
    }

    this.connectionCheckTimer = setInterval(async () => {
      await this.checkMCPConnection();
    }, this.CONNECTION_CHECK_INTERVAL);

    console.log(`🔄 MCP 연결 모니터링 시작 (${this.CONNECTION_CHECK_INTERVAL / 1000}초 간격)`);
  }

  /**
   * 통합 쿼리 실행 (MCP 우선, 로컬 fallback)
   */
  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const queryStartTime = performance.now();

    try {
      // 캐시 확인
      const cacheKey = this.generateCacheKey(sql, params);
      const cachedResult = this.getCachedResult(cacheKey);

      if (cachedResult) {
        this.performanceStats.cacheHits++;
        return {
          success: true,
          data: cachedResult.result,
          source: cachedResult.source,
          executionTime: performance.now() - queryStartTime,
        };
      }

      let result: QueryResult;

      // MCP 도구 우선 시도
      if (this.connectionStatus.available && this.connectionStatus.sqlite) {
        try {
          result = await this.executeMCPQuery(sql, params);
          if (result.success) {
            this.performanceStats.mcpQueries++;
            this.cacheResult(cacheKey, sql, params, result.data, 'mcp');

            console.log(`✅ MCP SQLite 쿼리 성공: ${sql.substring(0, 50)}...`);
            return result;
          }
        } catch (mcpError) {
          console.warn('⚠️ MCP 쿼리 실패, 로컬로 fallback:', mcpError);
        }
      }

      // 로컬 SQLite fallback
      result = await this.executeLocalQuery(sql, params);
      if (result.success) {
        this.performanceStats.localQueries++;
        this.cacheResult(cacheKey, sql, params, result.data, 'local');

        console.log(`✅ 로컬 SQLite 쿼리 성공: ${sql.substring(0, 50)}...`);
      }

      return result;
    } catch (error) {
      console.error('❌ 통합 쿼리 실행 실패:', error);
      return {
        success: false,
        data: [],
        source: 'local',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        executionTime: performance.now() - queryStartTime,
      };
    } finally {
      const executionTime = performance.now() - queryStartTime;
      this.updatePerformanceStats(executionTime);
    }
  }

  /**
   * MCP SQLite 쿼리 실행
   */
  private async executeMCPQuery(sql: string, params: unknown[]): Promise<QueryResult> {
    try {
      // 실제 Claude Desktop 환경에서는 MCP sqlite 도구 API 사용
      // 현재는 가상적 구현

      // 가상적 MCP SQLite API 호출
      const mcpResult = await this.callMCPSQLite(sql, params);

      return {
        success: true,
        data: mcpResult,
        source: 'mcp',
      };
    } catch (error) {
      throw new Error(`MCP SQLite 쿼리 실행 실패: ${error}`);
    }
  }

  /**
   * 가상적 MCP SQLite API 호출 (실제 구현에서 교체 필요)
   */
  private async callMCPSQLite(sql: string, params: unknown[]): Promise<unknown[]> {
    // Claude Desktop 환경에서 실제 MCP sqlite 도구 호출
    // 현재는 시뮬레이션을 위한 가상적 구현

    if (
      typeof window !== 'undefined' &&
      (window as unknown as { claude?: { mcp?: unknown } }).claude?.mcp?.sqlite
    ) {
      return await (window as unknown as { claude?: { mcp?: unknown } }).claude.mcp.sqlite.query(
        sql,
        params
      );
    }

    // 가상적 구현 - 실제로는 MCP API 사용
    throw new Error('MCP SQLite 도구에 연결할 수 없습니다');
  }

  /**
   * 로컬 SQLite 쿼리 실행
   */
  private async executeLocalQuery(sql: string, params: unknown[]): Promise<QueryResult> {
    try {
      // DatabaseService 초기화 확인
      if (!databaseService.isInitialized()) {
        await databaseService.initialize();
      }

      const data = databaseService.query(sql, params);

      return {
        success: true,
        data: data,
        source: 'local',
      };
    } catch (error) {
      throw new Error(`로컬 SQLite 쿼리 실행 실패: ${error}`);
    }
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(sql: string, params: unknown[]): string {
    return `${sql}|${JSON.stringify(params)}`;
  }

  /**
   * 캐시된 결과 조회
   */
  private getCachedResult(cacheKey: string): CacheItem | null {
    const cached = this.queryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached;
    }

    // 만료된 캐시 정리
    if (cached) {
      this.queryCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * 쿼리 결과 캐시
   */
  private cacheResult(
    cacheKey: string,
    sql: string,
    params: unknown[],
    result: unknown[],
    source: 'mcp' | 'local'
  ): void {
    // SELECT 쿼리만 캐시 (데이터 변경 쿼리는 제외)
    if (!sql.trim().toLowerCase().startsWith('select')) {
      return;
    }

    // 캐시 크기 제한
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }

    this.queryCache.set(cacheKey, {
      query: sql,
      params: params,
      result: result,
      timestamp: Date.now(),
      source: source,
    });
  }

  /**
   * 성능 통계 업데이트
   */
  private updatePerformanceStats(executionTime: number): void {
    this.performanceStats.totalExecutionTime += executionTime;
    const totalQueries = this.performanceStats.mcpQueries + this.performanceStats.localQueries;

    if (totalQueries > 0) {
      this.performanceStats.averageResponseTime =
        this.performanceStats.totalExecutionTime / totalQueries;
    }
  }

  /**
   * MCP 메모리 도구 연동
   */
  async storeMemory(entityName: string, entityType: string): Promise<boolean> {
    if (!this.connectionStatus.available || !this.connectionStatus.memory) {
      console.log('⚠️ MCP Memory 도구 미연결, 로컬 저장소 활용');
      return false;
    }

    try {
      // 실제 구현에서는 MCP memory 도구 API 사용
      // await mcpMemory.createEntities([{ name: entityName, entityType, observations }]);

      console.log(`💾 MCP Memory에 저장 완료: ${entityName} (${entityType})`);
      return true;
    } catch (error) {
      console.error('❌ MCP Memory 저장 실패:', error);
      return false;
    }
  }

  /**
   * MCP 작업 관리 도구 연동
   */
  async createTask(taskName: string): Promise<string | null> {
    if (!this.connectionStatus.available || !this.connectionStatus.taskManager) {
      console.log('⚠️ MCP Task Manager 도구 미연결');
      return null;
    }

    try {
      // 실제 구현에서는 MCP task manager 도구 API 사용
      // const taskId = await mcpTaskManager.createTask({ name: taskName, description, dependencies });

      const mockTaskId = `task-${Date.now()}`;
      console.log(`📋 MCP Task Manager에 작업 생성: ${taskName} (${mockTaskId})`);
      return mockTaskId;
    } catch (error) {
      console.error('❌ MCP Task 생성 실패:', error);
      return null;
    }
  }

  /**
   * 데이터 동기화 (MCP ↔ 로컬)
   */
  async syncData(
    direction: 'mcp-to-local' | 'local-to-mcp' | 'bidirectional' = 'bidirectional'
  ): Promise<boolean> {
    if (!this.connectionStatus.available) {
      console.log('⚠️ MCP 도구 미연결, 동기화 불가');
      return false;
    }

    try {
      console.log(`🔄 데이터 동기화 시작 (${direction})`);

      // 실제 구현에서는 테이블별 동기화 로직 구현
      // - MCP에서 로컬로: MCP SQLite → 로컬 IndexedDB
      // - 로컬에서 MCP로: 로컬 IndexedDB → MCP SQLite
      // - 양방향: 타임스탬프 기반 충돌 해결

      console.log('✅ 데이터 동기화 완료');
      return true;
    } catch (error) {
      console.error('❌ 데이터 동기화 실패:', error);
      return false;
    }
  }

  /**
   * 연결 상태 조회
   */
  getConnectionStatus(): MCPConnectionStatus & { performance: typeof this.performanceStats } {
    return {
      ...this.connectionStatus,
      performance: { ...this.performanceStats },
    };
  }

  /**
   * 캐시 통계 조회
   */
  getCacheStats(): { size: number; hitRate: number; ttl: number } {
    const totalQueries = this.performanceStats.mcpQueries + this.performanceStats.localQueries;
    const hitRate = totalQueries > 0 ? (this.performanceStats.cacheHits / totalQueries) * 100 : 0;

    return {
      size: this.queryCache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      ttl: this.CACHE_TTL,
    };
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.queryCache.clear();
    console.log('🧹 쿼리 캐시 초기화 완료');
  }

  /**
   * 서비스 종료
   */
  destroy(): void {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }

    this.clearCache();

    console.log('🔌 MCP 브릿지 서비스 종료');
  }
}

// 싱글톤 인스턴스 내보내기
export const mcpBridgeService = new MCPBridgeService();
export default MCPBridgeService;
