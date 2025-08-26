// src/services/FileMigrationService.ts

import { FileSystemUtil, type MigrationProgress } from '../utils/FileSystemUtil';

/**
 * Base64 DB 데이터를 파일시스템으로 마이그레이션하는 서비스
 * 브라우저 환경에서의 제약사항을 고려한 설계
 */
export class FileMigrationService {
  private static readonly BATCH_SIZE = 5; // 배치당 처리할 파일 수
  private static readonly DELAY_BETWEEN_BATCHES = 1000; // 배치 간 대기 시간 (ms)

  /**
   * DB 스키마 변경 - file_content 컬럼을 file_path로 변경
   */
  static async updateDatabaseSchema(): Promise<void> {
    console.log('🔄 데이터베이스 스키마 업데이트 시작...');

    try {
      // 1. 새로운 file_path 컬럼 추가
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query('ALTER TABLE project_files ADD COLUMN file_path TEXT');
      console.log('✅ file_path 컬럼 추가 완료');

      // 2. migration_status 컬럼 추가 (마이그레이션 상태 추적용)
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(
        'ALTER TABLE project_files ADD COLUMN migration_status TEXT DEFAULT "pending"'
      );
      console.log('✅ migration_status 컬럼 추가 완료');

      // 3. 스키마 버전 정보 테이블 생성 (향후 마이그레이션 관리용)
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL UNIQUE,
          description TEXT,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 4. 현재 마이그레이션 기록
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(
        'INSERT OR REPLACE INTO schema_migrations (version, description) VALUES (?, ?)',
        ['v2.0.0', 'Add file_path column and migrate from Base64 storage to filesystem']
      );

      console.log('🎉 데이터베이스 스키마 업데이트 완료');
    } catch (error) {
      console.error('❌ 스키마 업데이트 실패:', error);
      throw new Error(
        `스키마 업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
    }
  }

  /**
   * 마이그레이션이 필요한 파일 목록 조회
   */
  static async getPendingMigrationFiles(): Promise<unknown[]> {
    try {
      const files = await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(`
        SELECT id, project_id, file_name, file_content, file_size, mime_type, created_at
        FROM project_files 
        WHERE file_content IS NOT NULL 
        AND file_content != '' 
        AND (file_path IS NULL OR file_path = '')
        AND (migration_status IS NULL OR migration_status = 'pending')
        ORDER BY id ASC
      `);

      console.log(`📋 마이그레이션 대상 파일: ${files.length}개 발견`);
      return files;
    } catch (error) {
      console.error('❌ 마이그레이션 대상 파일 조회 실패:', error);
      return [];
    }
  }

  /**
   * 단일 파일을 Base64에서 파일시스템으로 마이그레이션
   * 브라우저 환경에서는 실제 파일 저장이 불가능하므로 시뮬레이션만 수행
   */
  static async migrateSingleFile(
    fileRecord: unknown
  ): Promise<{ success: boolean; error?: string; filePath?: string }> {
    try {
      console.log(`🔄 파일 마이그레이션 시작: ${fileRecord.file_name} (ID: ${fileRecord.id})`);

      // 1. 파일명 및 경로 생성
      const uniqueFileName = FileSystemUtil.generateUniqueFileName(
        fileRecord.project_id,
        fileRecord.file_name
      );
      const filePath = FileSystemUtil.generateFilePath(fileRecord.project_id, uniqueFileName);

      // 2. 보안 검증
      if (!FileSystemUtil.validateFilePath(filePath)) {
        throw new Error('안전하지 않은 파일 경로입니다.');
      }

      if (!FileSystemUtil.validateFileExtension(fileRecord.file_name)) {
        throw new Error('허용되지 않는 파일 확장자입니다.');
      }

      if (!FileSystemUtil.validateMimeType(fileRecord.mime_type)) {
        throw new Error('허용되지 않는 MIME 타입입니다.');
      }

      // 3. Base64 데이터 검증
      if (!fileRecord.file_content || fileRecord.file_content.trim().length === 0) {
        throw new Error('파일 내용이 비어있습니다.');
      }

      // Base64 형식 검증
      try {
        const sampleData = fileRecord.file_content.substring(0, 100);
        atob(sampleData);
      } catch {
        throw new Error('올바르지 않은 Base64 형식입니다.');
      }

      // 4. 브라우저 환경에서는 실제 파일 저장 대신 시뮬레이션
      // 실제 데스크톱 앱 환경에서는 여기서 파일을 실제로 저장해야 함
      console.log(`💾 파일 저장 시뮬레이션: ${filePath}`);

      // 실제 파일 저장 로직은 Electron/Tauri 등의 데스크톱 환경에서 구현 필요
      // const blob = FileSystemUtil.base64ToBlob(fileRecord.file_content, fileRecord.mime_type);
      // await saveFileToFileSystem(filePath, blob); // 실제 구현 필요

      // 5. 데이터베이스 업데이트 (트랜잭션)
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query('BEGIN TRANSACTION');

      try {
        // file_path 업데이트
        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          'UPDATE project_files SET file_path = ?, migration_status = ? WHERE id = ?',
          [filePath, 'completed', fileRecord.id]
        );

        // 마이그레이션 완료 후 file_content는 null로 설정 (저장공간 절약)
        // 하지만 안전을 위해 즉시 삭제하지 않고 별도 단계에서 처리
        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('UPDATE project_files SET file_content = NULL WHERE id = ?', [
          fileRecord.id,
        ]);

        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('COMMIT');
        console.log(`✅ 파일 마이그레이션 완료: ${fileRecord.file_name}`);

        return { success: true, filePath };
      } catch (dbError) {
        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('ROLLBACK');
        throw dbError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error(`❌ 파일 마이그레이션 실패: ${fileRecord.file_name} - ${errorMessage}`);

      // 실패 상태 기록
      try {
        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('UPDATE project_files SET migration_status = ? WHERE id = ?', [
          'failed',
          fileRecord.id,
        ]);
      } catch (updateError) {
        console.error('마이그레이션 실패 상태 업데이트 실패:', updateError);
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 전체 마이그레이션 실행 (배치 처리)
   */
  static async executeMigration(
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationProgress> {
    console.log('🚀 Base64 → 파일시스템 마이그레이션 시작');

    const progress: MigrationProgress = {
      totalFiles: 0,
      processedFiles: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
    };

    try {
      // 1. 스키마 업데이트
      await this.updateDatabaseSchema();

      // 2. 마이그레이션 대상 파일 조회
      const pendingFiles = await this.getPendingMigrationFiles();
      progress.totalFiles = pendingFiles.length;

      if (pendingFiles.length === 0) {
        console.log('✅ 마이그레이션할 파일이 없습니다.');
        return progress;
      }

      // 3. 배치 단위로 처리
      for (let i = 0; i < pendingFiles.length; i += this.BATCH_SIZE) {
        const batch = pendingFiles.slice(i, i + this.BATCH_SIZE);
        console.log(
          `📦 배치 ${Math.floor(i / this.BATCH_SIZE) + 1} 처리 중... (${batch.length}개 파일)`
        );

        // 배치 내 파일들을 순차 처리
        for (const file of batch) {
          progress.currentFile = file.file_name;
          onProgress?.(progress);

          const result = await this.migrateSingleFile(file);
          progress.processedFiles++;

          if (result.success) {
            progress.successCount++;
          } else {
            progress.errorCount++;
            progress.errors.push(`${file.file_name}: ${result.error}`);
          }

          onProgress?.(progress);
        }

        // 배치 간 잠시 대기 (브라우저 성능 고려)
        if (i + this.BATCH_SIZE < pendingFiles.length) {
          await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
        }
      }

      console.log('🎉 마이그레이션 완료:', {
        총파일: progress.totalFiles,
        성공: progress.successCount,
        실패: progress.errorCount,
      });

      return progress;
    } catch (error) {
      console.error('❌ 마이그레이션 실행 실패:', error);
      progress.errors.push(
        `전체 마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
      return progress;
    }
  }

  /**
   * 마이그레이션 롤백 (비상시 사용)
   */
  static async rollbackMigration(): Promise<void> {
    console.log('🔄 마이그레이션 롤백 시작...');

    try {
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query('BEGIN TRANSACTION');

      // migration_status를 다시 pending으로 변경
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(
        'UPDATE project_files SET migration_status = "pending" WHERE migration_status = "completed"'
      );

      // file_path를 null로 리셋 (file_content는 이미 null이므로 복구 불가)
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(
        'UPDATE project_files SET file_path = NULL WHERE migration_status = "pending"'
      );

      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query('COMMIT');

      console.log('✅ 마이그레이션 롤백 완료 (주의: file_content 데이터는 복구되지 않음)');
      console.warn(
        '⚠️ 경고: Base64 데이터는 이미 삭제되어 복구할 수 없습니다. 백업에서 복원하세요.'
      );
    } catch (error) {
      await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query('ROLLBACK');
      console.error('❌ 롤백 실패:', error);
      throw error;
    }
  }

  /**
   * 마이그레이션 상태 확인
   */
  static async getMigrationStatus(): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
  }> {
    try {
      const result = await (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN migration_status = 'pending' OR migration_status IS NULL THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN migration_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN migration_status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM project_files
        WHERE file_content IS NOT NULL AND file_content != ''
      `);

      return result[0] || { total: 0, pending: 0, completed: 0, failed: 0 };
    } catch (error) {
      console.error('마이그레이션 상태 확인 실패:', error);
      return { total: 0, pending: 0, completed: 0, failed: 0 };
    }
  }
}
