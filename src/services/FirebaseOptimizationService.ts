/**
 * Firebase 최적화 서비스
 * - Realtime Database 연결 최적화
 * - 쿼리 성능 개선
 * - 캐싱 및 동기화 최적화
 * - 보안 규칙 준수
 */

import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { initializeApp, getApp } from 'firebase/app';
import type { Database, Query, Unsubscribe } from 'firebase/database';
import {
  getDatabase,
  ref,
  query,
  orderByChild,
  limitToFirst,
  limitToLast,
  onValue,
  get,
  set,
  update,
  remove,
} from 'firebase/database';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

interface QueryConfig {
  path: string;
  orderBy?: string;
  limit?: number;
  reverse?: boolean;
  cache?: boolean;
  cacheTTL?: number; // milliseconds
}

interface OptimizationStats {
  cacheHits: number;
  cacheMisses: number;
  queriesExecuted: number;
  averageQueryTime: number;
  activeSubscriptions: number;
}

class FirebaseOptimizationService {
  private app: FirebaseApp | null = null;
  private database: Database | null = null;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private subscriptions: Map<string, Unsubscribe> = new Map();
  private stats: OptimizationStats = {
    cacheHits: 0,
    cacheMisses: 0,
    queriesExecuted: 0,
    averageQueryTime: 0,
    activeSubscriptions: 0,
  };

  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5분
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Firebase 초기화
   */
  initialize(config: FirebaseOptions): void {
    try {
      this.app = getApp();
    } catch {
      this.app = initializeApp(config);
    }

    this.database = getDatabase(this.app!);

    // 오프라인 영속성 활성화
    if (this.database) {
      const infoConnected = ref(this.database, '.info/connected');
      onValue(infoConnected, (snapshot: unknown) => {
        const data = snapshot as { val: () => boolean };
        if (data.val() === true) {
          console.log('✅ Firebase 연결됨');
        } else {
          console.log('⚠️ Firebase 오프라인 모드');
        }
      });
    }
  }

  /**
   * 최적화된 쿼리 실행
   */
  async queryOptimized<T>(config: QueryConfig): Promise<T | null> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(config);

    // 캐시 확인
    if (config.cache !== false) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;
    }

    try {
      const queryRef = this.buildQuery(config);
      const snapshot = await get(queryRef);
      const data = snapshot.val() as T | null;

      // 캐시에 저장
      if (config.cache !== false && data !== null) {
        this.setCache(
          cacheKey,
          data,
          config.cacheTTL || this.DEFAULT_CACHE_TTL
        );
      }

      this.stats.queriesExecuted++;
      const queryTime = performance.now() - startTime;
      this.updateAverageQueryTime(queryTime);

      return data;
    } catch (error) {
      console.error('❌ Firebase 쿼리 오류:', error);
      throw error;
    }
  }

  /**
   * 실시간 구독
   */
  subscribe<T>(
    config: QueryConfig,
    callback: (data: T | null) => void,
    onError?: (error: Error) => void
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const queryRef = this.buildQuery(config);

    const unsubscribe = onValue(
      queryRef,
      (snapshot) => {
        const data = snapshot.val() as T | null;
        callback(data);

        // 캐시 업데이트
        if (config.cache !== false) {
          const cacheKey = this.generateCacheKey(config);
          if (data !== null) {
            this.setCache(
              cacheKey,
              data,
              config.cacheTTL || this.DEFAULT_CACHE_TTL
            );
          }
        }
      },
      (error) => {
        console.error('❌ 구독 오류:', error);
        if (onError) onError(error as Error);
      }
    );

    this.subscriptions.set(subscriptionId, unsubscribe);
    this.stats.activeSubscriptions++;

    return subscriptionId;
  }

  /**
   * 구독 해제
   */
  unsubscribe(subscriptionId: string): void {
    const unsubscribe = this.subscriptions.get(subscriptionId);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(subscriptionId);
      this.stats.activeSubscriptions--;
    }
  }

  /**
   * 데이터 저장 (배치 작업 지원)
   */
  async setData(path: string, data: unknown): Promise<void> {
    try {
      await set(ref(this.database!, path), data);
      this.invalidateCache(path);
    } catch (error) {
      console.error('❌ 데이터 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 데이터 업데이트 (부분 업데이트)
   */
  async updateData(path: string, updates: Record<string, unknown>): Promise<void> {
    try {
      await update(ref(this.database!, path), updates);
      this.invalidateCache(path);
    } catch (error) {
      console.error('❌ 데이터 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 데이터 삭제
   */
  async deleteData(path: string): Promise<void> {
    try {
      await remove(ref(this.database!, path));
      this.invalidateCache(path);
    } catch (error) {
      console.error('❌ 데이터 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 배치 쓰기 작업
   */
  async batchWrite(updates: Record<string, unknown>): Promise<void> {
    try {
      const updateObj = updates;
      await update(ref(this.database!), updateObj);
      this.clearCache();
    } catch (error) {
      console.error('❌ 배치 쓰기 실패:', error);
      throw error;
    }
  }

  /**
   * 성능 통계 조회
   */
  getStats(): OptimizationStats {
    return { ...this.stats };
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 모든 구독 해제
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    this.stats.activeSubscriptions = 0;
  }

  // Private 메서드들

  private buildQuery(config: QueryConfig): Query | ReturnType<typeof ref> {
    const dbRef = ref(this.database!, config.path);

    if (config.orderBy) {
      let queryRef = query(dbRef, orderByChild(config.orderBy));

      if (config.limit) {
        if (config.reverse) {
          queryRef = query(
            dbRef,
            orderByChild(config.orderBy),
            limitToLast(config.limit)
          );
        } else {
          queryRef = query(
            dbRef,
            orderByChild(config.orderBy),
            limitToFirst(config.limit)
          );
        }
      }

      return queryRef;
    }

    return dbRef;
  }

  private generateCacheKey(config: QueryConfig): string {
    const parts = [
      config.path,
      config.orderBy || '',
      config.limit || '',
      config.reverse ? 'desc' : 'asc',
    ];
    return parts.join(':');
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // TTL 확인
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache(
    key: string,
    data: unknown,
    ttl: number = this.DEFAULT_CACHE_TTL
  ): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private invalidateCache(path: string): void {
    // 해당 경로와 관련된 캐시 항목 무효화
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.startsWith(path)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  private updateAverageQueryTime(queryTime: number): void {
    const totalQueries = this.stats.queriesExecuted;
    const currentAverage = this.stats.averageQueryTime;
    this.stats.averageQueryTime =
      (currentAverage * (totalQueries - 1) + queryTime) / totalQueries;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 싱글톤 인스턴스
let instance: FirebaseOptimizationService | null = null;

export function getFirebaseOptimizationService(): FirebaseOptimizationService {
  if (!instance) {
    instance = new FirebaseOptimizationService();
  }
  return instance;
}

export type { QueryConfig, OptimizationStats };
export default FirebaseOptimizationService;
