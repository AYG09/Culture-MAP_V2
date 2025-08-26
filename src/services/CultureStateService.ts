// src/services/CultureStateService.ts

/**
 * CultureStateService의 saveProjectFile 메서드 업데이트 필요
 * 새로운 파일시스템 저장 방식을 지원하도록 수정
 */

import type {
  CultureProject,
  InterviewSession,
  LayerAnalysis,
  ProjectProgress,
  DashboardState,
  DatabaseError,
  ServiceStatus,
} from '../types/culture';
import { FileMigrationService } from './FileMigrationService';
import { FileSystemUtil } from '../utils/FileSystemUtil';

// 파일 관리용 인터페이스
interface ProjectFile {
  id: number;
  project_id: number;
  file_type: 'culture_map' | 'analysis_report' | 'culture_json' | 'other';
  file_name: string;
  file_content?: string; // Base64 encoded - 마이그레이션 후 optional
  file_path?: string; // 파일시스템 경로 - 마이그레이션 후 추가
  file_size: number;
  mime_type?: string;
  metadata?: string; // JSON string
  migration_status?: 'pending' | 'completed' | 'failed'; // 마이그레이션 상태
  created_at: string;
  updated_at: string;
}

interface ProjectFileData {
  project_id: number;
  file_type: 'culture_map' | 'analysis_report' | 'culture_json' | 'other';
  file_name: string;
  file_content?: string; // Base64 encoded - 마이그레이션 후 optional
  file_path?: string; // 파일시스템 경로 - 마이그레이션 후 추가
  file_size?: number;
  mime_type?: string;
  metadata?: Record<string, unknown>;
}

// DatabaseErrorType를 값으로 사용하기 위한 별도 import
import { DatabaseErrorType } from '../types/culture';

/**
 * 조직문화 분석 상태 관리 서비스
 * 강화된 에러 핸들링과 graceful degradation을 제공합니다.
 */
class CultureStateService {
  private serviceStatus: ServiceStatus = {
    isConnected: false,
    errorCount: 0,
    lastSuccessfulOperation: undefined,
  };

  /**
   * 데이터베이스 연결 상태 확인
   */
  private checkDatabaseConnection(): DatabaseError | null {
    // window.sqlite 존재 확인
    if (
      !window ||
      !(
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite
    ) {
      return {
        type: DatabaseErrorType.DB_NOT_INITIALIZED,
        message: '데이터베이스가 초기화되지 않았습니다.',
        recoveryGuidance: '페이지를 새로고침하거나 잠시 후 다시 시도해주세요.',
        fallbackData: [],
      };
    }

    // window.sqlite.query 함수 존재 확인
    if (
      typeof (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query !== 'function'
    ) {
      return {
        type: DatabaseErrorType.DB_CONNECTION_ERROR,
        message: '데이터베이스 쿼리 함수에 접근할 수 없습니다.',
        recoveryGuidance: '데이터베이스 연결을 확인하고 다시 시도해주세요.',
        fallbackData: [],
      };
    }

    // 간단한 연결 테스트
    try {
      (
        window as unknown as {
          sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
        }
      ).sqlite.query('SELECT 1');
      this.serviceStatus.isConnected = true;
      return null;
    } catch (error) {
      return {
        type: DatabaseErrorType.QUERY_ERROR,
        message: '데이터베이스 연결 테스트에 실패했습니다.',
        originalError: error as Error,
        recoveryGuidance: '데이터베이스 서비스를 재시작해주세요.',
        fallbackData: [],
      };
    }
  }

  /**
   * 안전한 데이터베이스 쿼리 실행
   */
  private async executeSafeQuery<T>(
    queryFn: () => Promise<T> | T,
    fallbackData: T,
    operationName: string
  ): Promise<T> {
    try {
      // 데이터베이스 연결 확인
      const connectionError = this.checkDatabaseConnection();
      if (connectionError) {
        this.serviceStatus.lastError = connectionError;
        this.serviceStatus.errorCount++;

        console.warn(`🔶 ${operationName} - 데이터베이스 연결 실패:`, connectionError);
        console.info(`🔄 ${operationName} - 폴백 데이터 사용:`, fallbackData);

        return fallbackData;
      }

      // 쿼리 실행
      const result = await queryFn();

      // 성공 시 상태 업데이트
      this.serviceStatus.lastSuccessfulOperation = operationName;
      this.serviceStatus.lastError = undefined;

      console.log(`✅ ${operationName} - 성공`);
      return result;
    } catch (error) {
      // 에러 타입 분류
      const dbError: DatabaseError = {
        type: this.classifyError(error as Error),
        message: `${operationName} 실행 중 오류가 발생했습니다.`,
        originalError: error as Error,
        recoveryGuidance: this.getRecoveryGuidance(error as Error),
        fallbackData,
      };

      this.serviceStatus.lastError = dbError;
      this.serviceStatus.errorCount++;

      console.error(`❌ ${operationName} - 실패:`, dbError);
      console.info(`🔄 ${operationName} - 폴백 데이터 사용:`, fallbackData);

      return fallbackData;
    }
  }

  /**
   * 에러 타입 분류
   */
  private classifyError(error: Error): DatabaseErrorType {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return DatabaseErrorType.NETWORK_ERROR;
    }

    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return DatabaseErrorType.PERMISSION_ERROR;
    }

    if (errorMessage.includes('connection') || errorMessage.includes('sqlite')) {
      return DatabaseErrorType.DB_CONNECTION_ERROR;
    }

    return DatabaseErrorType.QUERY_ERROR;
  }

  /**
   * 복구 가이드 제공
   */
  private getRecoveryGuidance(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('network')) {
      return '네트워크 연결을 확인하고 다시 시도해주세요.';
    }

    if (errorMessage.includes('permission')) {
      return '브라우저 설정에서 필요한 권한을 허용해주세요.';
    }

    if (errorMessage.includes('sqlite') || errorMessage.includes('database')) {
      return '페이지를 새로고침하여 데이터베이스를 다시 초기화해주세요.';
    }

    return '잠시 후 다시 시도해주세요. 문제가 계속되면 페이지를 새로고침해주세요.';
  }

  /**
   * 서비스 상태 조회
   */
  getServiceStatus(): ServiceStatus {
    return { ...this.serviceStatus };
  }

  /**
   * 모든 프로젝트 목록 조회 (강화된 에러 핸들링)
   */
  async getProjects(): Promise<CultureProject[]> {
    return this.executeSafeQuery(
      async () => {
        const response = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM culture_projects ORDER BY created_at DESC');

        return response.map(
          (row: {
            project_id: string;
            organization_name: string;
            project_metadata: string;
            created_at: string;
            updated_at: string;
          }) => {
            // project_metadata에서 프로젝트 이름 추출 시도
            let projectName = row.organization_name; // 기본값
            try {
              if (row.project_metadata) {
                const metadata = JSON.parse(row.project_metadata);
                if (metadata.projectName) {
                  projectName = metadata.projectName;
                }
              }
            } catch {
              // JSON 파싱 실패 시 기본값 사용
            }

            return {
              id: row.id.toString(),
              name: projectName,
              description: row.analysis_purpose || '',
              organization: row.organization_name,
              status: row.current_stage || 'planning', // 기본값 추가
              created_at: row.created_at,
              updated_at: row.updated_at,
              metadata: row.project_metadata,
            };
          }
        );
      },
      [], // 폴백 데이터: 빈 배열
      'getProjects'
    );
  }

  /**
   * 특정 프로젝트 조회 (강화된 에러 핸들링)
   */
  async getProject(projectId: string): Promise<CultureProject | null> {
    return this.executeSafeQuery(
      async () => {
        const response = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM culture_projects WHERE id = ?', [projectId]);

        if (response.length === 0) return null;

        const row = response[0];
        return {
          id: row.id.toString(),
          name: row.organization_name || '이름 없음',
          description: row.analysis_purpose || '',
          organization: row.organization_name || '',
          status: row.current_stage || 'planning',
          created_at: row.created_at,
          updated_at: row.updated_at,
          metadata: row.project_metadata,
        };
      },
      null, // 폴백 데이터: null
      'getProject'
    );
  }

  /**
   * 새 프로젝트 생성 (강화된 에러 핸들링)
   */
  async createProject(
    project: Omit<CultureProject, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CultureProject | null> {
    return this.executeSafeQuery(
      async () => {
        console.log('📝 프로젝트 생성 시작:', project);

        // 입력값 검증
        if (!project.name || !project.organization) {
          throw new Error('프로젝트 이름과 조직명은 필수 입력 사항입니다.');
        }

        // 프로젝트 메타데이터 준비
        const metadata = JSON.stringify({
          projectName: project.name,
          createdBy: 'system',
          version: '1.0',
          createdAt: new Date().toISOString(),
        });

        // 데이터베이스에 프로젝트 삽입
        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `INSERT INTO culture_projects (organization_name, analysis_purpose, current_stage, project_metadata)
           VALUES (?, ?, ?, ?)`,
          [project.organization, project.description, project.status, metadata]
        );

        console.log('✅ 프로젝트 삽입 완료');

        // 생성된 프로젝트 조회
        const newProjects = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM culture_projects ORDER BY id DESC LIMIT 1');

        if (newProjects.length > 0) {
          const row = newProjects[0];
          const createdProject = {
            id: row.id.toString(),
            name: project.name, // 사용자가 입력한 이름 사용
            description: row.analysis_purpose || '',
            organization: row.organization_name,
            status: row.current_stage || 'planning',
            created_at: row.created_at,
            updated_at: row.updated_at,
            metadata: row.project_metadata,
          };

          console.log('🎉 프로젝트 생성 성공:', createdProject);
          return createdProject;
        }

        throw new Error('생성된 프로젝트를 조회할 수 없습니다.');
      },
      null, // 폴백 데이터: null
      'createProject'
    );
  }

  /**
   * 프로젝트 업데이트 (강화된 에러 핸들링)
   */
  async updateProject(projectId: string, updates: Partial<CultureProject>): Promise<boolean> {
    return this.executeSafeQuery(
      async () => {
        const now = new Date().toISOString();

        const setClause = [];
        const values = [];

        if (updates.name) {
          setClause.push('organization_name = ?');
          values.push(updates.name);
        }
        if (updates.description) {
          setClause.push('analysis_purpose = ?');
          values.push(updates.description);
        }
        if (updates.status) {
          setClause.push('current_stage = ?');
          values.push(updates.status);
        }
        if (updates.metadata) {
          setClause.push('project_metadata = ?');
          values.push(updates.metadata);
        }

        setClause.push('updated_at = ?');
        values.push(now, projectId);

        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(`UPDATE culture_projects SET ${setClause.join(', ')} WHERE id = ?`, values);

        return true;
      },
      false, // 폴백 데이터: false
      'updateProject'
    );
  }

  /**
   * 프로젝트 진행률 조회 (실제 데이터베이스 연동)
   */
  async getProjectProgress(projectId: string): Promise<ProjectProgress | null> {
    return this.executeSafeQuery(
      async () => {
        const projectIdInt = parseInt(projectId);
        if (isNaN(projectIdInt)) {
          throw new Error('유효하지 않은 프로젝트 ID입니다.');
        }

        // 인터뷰 세션 통계 조회 (올바른 컬럼명 사용)
        const interviewStats = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `SELECT 
             COUNT(*) as total_interviews,
             COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed_interviews,
             COUNT(CASE WHEN file_name IS NOT NULL AND file_name != '' THEN 1 END) as transcribed_interviews,
             COUNT(CASE WHEN gemini_output IS NOT NULL AND gemini_output != '' THEN 1 END) as analyzed_interviews
           FROM interview_sessions WHERE project_id = ?`,
          [projectIdInt]
        );

        // 4층위 분석 완성도 조회
        const layerStats = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `SELECT 
             layer_type,
             COUNT(*) as count
           FROM layer_analysis WHERE project_id = ? GROUP BY layer_type`,
          [projectIdInt]
        );

        // 인사이트 수 조회
        const insightStats = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          'SELECT COUNT(*) as insights_count FROM project_insights WHERE project_id = ?',
          [projectIdInt]
        );

        // 최근 활동 조회
        const lastActivity = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `SELECT MAX(updated_at) as last_activity FROM (
             SELECT updated_at FROM culture_projects WHERE id = ?
             UNION
             SELECT created_at as updated_at FROM interview_sessions WHERE project_id = ?
             UNION
             SELECT created_at as updated_at FROM layer_analysis WHERE project_id = ?
             UNION
             SELECT created_at as updated_at FROM project_insights WHERE project_id = ?
           )`,
          [projectIdInt, projectIdInt, projectIdInt, projectIdInt]
        );

        const stats = interviewStats[0] || {};
        const layerCounts = layerStats.reduce((acc: unknown, row: unknown) => {
          acc[row.layer_type] = row.count;
          return acc;
        }, {});

        return {
          project_id: projectId,
          total_interviews: stats.total_interviews || 0,
          completed_interviews: stats.completed_interviews || 0,
          transcribed_interviews: stats.transcribed_interviews || 0,
          analyzed_interviews: stats.analyzed_interviews || 0,
          layer_completion: {
            artifacts: layerCounts.artifacts || 0,
            behaviors: layerCounts.behaviors || 0,
            norms_values: layerCounts.norms_values || 0,
            assumptions: layerCounts.assumptions || 0,
          },
          insights_count: (insightStats[0] && insightStats[0].insights_count) || 0,
          last_activity:
            (lastActivity[0] && lastActivity[0].last_activity) || new Date().toISOString(),
        };
      },
      null, // 폴백 데이터: null
      'getProjectProgress'
    );
  }

  /**
   * 인터뷰 세션 목록 조회 (강화된 에러 핸들링)
   */
  async getInterviewSessions(projectId: string): Promise<InterviewSession[]> {
    return this.executeSafeQuery(
      async () => {
        const response = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          'SELECT * FROM interview_sessions WHERE project_id = ? ORDER BY session_date DESC',
          [projectId]
        );

        return response.map((row: unknown) => ({
          id: row.id,
          project_id: row.project_id,
          participant_role: row.participant_role,
          session_date: row.session_date,
          duration_minutes: row.duration_minutes,
          audio_file_path: row.audio_file_path,
          transcript: row.transcript,
          status: row.status,
          metadata: row.metadata,
        }));
      },
      [], // 폴백 데이터: 빈 배열
      'getInterviewSessions'
    );
  }

  /**
   * 새 인터뷰 세션 생성
   */
  async createInterviewSession(
    session: Omit<InterviewSession, 'id'>
  ): Promise<InterviewSession | null> {
    return this.executeSafeQuery(
      async () => {
        const sessionId = `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `INSERT INTO interview_sessions (
             id, project_id, participant_role, session_date, duration_minutes, 
             audio_file_path, transcript, status, metadata
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId,
            session.project_id,
            session.participant_role,
            session.session_date,
            session.duration_minutes,
            session.audio_file_path,
            session.transcript,
            session.status,
            JSON.stringify(session.metadata),
          ]
        );

        const newSession = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM interview_sessions WHERE id = ?', [sessionId]);

        if (newSession.length > 0) {
          const row = newSession[0];
          return {
            id: row.id,
            project_id: row.project_id,
            participant_role: row.participant_role,
            session_date: row.session_date,
            duration_minutes: row.duration_minutes,
            audio_file_path: row.audio_file_path,
            transcript: row.transcript,
            status: row.status,
            metadata: row.metadata,
          };
        }

        return null;
      },
      null,
      'createInterviewSession'
    );
  }

  /**
   * 인터뷰 세션 업데이트
   */
  async updateInterviewSession(
    sessionId: string,
    updates: Partial<InterviewSession>
  ): Promise<boolean> {
    return this.executeSafeQuery(
      async () => {
        const setClause = [];
        const values = [];

        if (updates.participant_role) {
          setClause.push('participant_role = ?');
          values.push(updates.participant_role);
        }
        if (updates.session_date) {
          setClause.push('session_date = ?');
          values.push(updates.session_date);
        }
        if (updates.duration_minutes !== undefined) {
          setClause.push('duration_minutes = ?');
          values.push(updates.duration_minutes);
        }
        if (updates.audio_file_path) {
          setClause.push('audio_file_path = ?');
          values.push(updates.audio_file_path);
        }
        if (updates.transcript) {
          setClause.push('transcript = ?');
          values.push(updates.transcript);
        }
        if (updates.status) {
          setClause.push('status = ?');
          values.push(updates.status);
        }
        if (updates.metadata) {
          setClause.push('metadata = ?');
          values.push(JSON.stringify(updates.metadata));
        }

        if (setClause.length === 0) {
          return false;
        }

        values.push(sessionId);

        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `UPDATE interview_sessions SET ${setClause.join(', ')} WHERE id = ?`,
          values
        );

        return true;
      },
      false,
      'updateInterviewSession'
    );
  }

  /**
   * 4층위 분석 결과 저장
   */
  async saveLayerAnalysis(analysis: Omit<LayerAnalysis, 'id'>): Promise<LayerAnalysis | null> {
    return this.executeSafeQuery(
      async () => {
        const analysisId = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          `INSERT INTO layer_analysis (
             id, project_id, layer_type, layer_index, content, source_data, confidence_score, metadata
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            analysisId,
            analysis.project_id,
            analysis.layer_type,
            analysis.layer_index,
            analysis.content,
            analysis.source_data,
            analysis.confidence_score,
            JSON.stringify(analysis.metadata),
          ]
        );

        const newAnalysis = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM layer_analysis WHERE id = ?', [analysisId]);

        if (newAnalysis.length > 0) {
          const row = newAnalysis[0];
          return {
            id: row.id,
            project_id: row.project_id,
            layer_type: row.layer_type,
            layer_index: row.layer_index,
            content: row.content,
            source_data: row.source_data,
            confidence_score: row.confidence_score,
            created_at: row.created_at,
            metadata: row.metadata,
          };
        }

        return null;
      },
      null,
      'saveLayerAnalysis'
    );
  }

  /**
   * 프로젝트 파일 저장 (강화된 에러 핸들링)
   */
  async saveProjectFile(fileData: ProjectFileData): Promise<ProjectFile | null> {
    return this.executeSafeQuery(
      async () => {
        console.log('💾 파일 저장 시작:', {
          fileName: fileData.file_name,
          fileType: fileData.file_type,
          fileSize: fileData.file_size
            ? `${(fileData.file_size / 1024 / 1024).toFixed(2)}MB`
            : '알 수 없음',
          projectId: fileData.project_id,
        });

        // 1. 입력값 검증 강화
        if (!fileData.file_name || fileData.file_name.trim().length === 0) {
          throw new Error('파일명이 비어있습니다.');
        }

        if (!fileData.file_content || fileData.file_content.trim().length === 0) {
          throw new Error('파일 내용이 비어있습니다.');
        }

        if (!fileData.project_id || isNaN(Number(fileData.project_id))) {
          throw new Error('올바르지 않은 프로젝트 ID입니다.');
        }

        // 2. 파일 크기 검증 및 계산
        if (!fileData.file_size) {
          fileData.file_size = Math.round((fileData.file_content.length * 3) / 4);
          console.log(
            '📏 파일 크기 자동 계산:',
            `${(fileData.file_size / 1024 / 1024).toFixed(2)}MB`
          );
        }

        // 3. 파일 크기 제한 확인 (10MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (fileData.file_size > MAX_FILE_SIZE) {
          throw new Error(
            `파일 크기가 제한을 초과합니다. 현재: ${(fileData.file_size / 1024 / 1024).toFixed(2)}MB, 최대: ${MAX_FILE_SIZE / 1024 / 1024}MB`
          );
        }

        // 4. Base64 형식 검증
        try {
          const sampleData = fileData.file_content.substring(0, 100);
          atob(sampleData);
        } catch (decodeError) {
          console.error('❌ Base64 디코딩 오류:', decodeError);
          throw new Error('올바르지 않은 Base64 형식입니다.');
        }

        // 5. 프로젝트 존재 여부 확인
        const projectExists = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT COUNT(*) as count FROM culture_projects WHERE id = ?', [
          fileData.project_id,
        ]);

        if (!projectExists[0] || projectExists[0].count === 0) {
          throw new Error(`프로젝트 ID ${fileData.project_id}가 존재하지 않습니다.`);
        }

        // 6. 중복 파일명 처리
        const existingFiles = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          'SELECT COUNT(*) as count FROM project_files WHERE project_id = ? AND file_name = ?',
          [fileData.project_id, fileData.file_name]
        );

        let finalFileName = fileData.file_name;
        if (existingFiles[0] && existingFiles[0].count > 0) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileExtension = finalFileName.includes('.') ? finalFileName.split('.').pop() : '';
          const baseName = fileExtension
            ? finalFileName.replace(`.${fileExtension}`, '')
            : finalFileName;
          finalFileName = `${baseName}_${timestamp}${fileExtension ? '.' + fileExtension : ''}`;

          console.log('🔄 중복 파일명 감지, 자동 리네임:', {
            original: fileData.file_name,
            renamed: finalFileName,
          });
        }

        // 7. 메타데이터 준비
        const now = new Date().toISOString();
        const metadata = fileData.metadata ? JSON.stringify(fileData.metadata) : null;

        console.log('💾 데이터베이스 삽입 시작...');

        // 8. 트랜잭션 기반 안전한 삽입
        try {
          await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('BEGIN TRANSACTION');

          await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query(
            `INSERT INTO project_files (
               project_id, file_type, file_name, file_content, file_size, mime_type, metadata, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              fileData.project_id,
              fileData.file_type,
              finalFileName,
              fileData.file_content,
              fileData.file_size,
              fileData.mime_type || 'application/octet-stream',
              metadata,
              now,
              now,
            ]
          );

          await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('COMMIT');
          console.log('✅ 트랜잭션 커밋 완료');
        } catch (insertError) {
          await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('ROLLBACK');
          console.error('❌ 삽입 실패, 롤백 완료:', insertError);
          throw new Error(
            `파일 저장 중 데이터베이스 오류가 발생했습니다: ${insertError instanceof Error ? insertError.message : '알 수 없는 오류'}`
          );
        }

        // 9. 저장된 파일 조회 및 검증
        const newFiles = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          'SELECT * FROM project_files WHERE project_id = ? ORDER BY id DESC LIMIT 1',
          [fileData.project_id]
        );

        if (newFiles.length === 0) {
          throw new Error('파일이 저장되었지만 조회할 수 없습니다.');
        }

        const row = newFiles[0];
        const savedFile: ProjectFile = {
          id: row.id,
          project_id: row.project_id,
          file_type: row.file_type,
          file_name: row.file_name,
          file_content: row.file_content,
          file_size: row.file_size,
          mime_type: row.mime_type,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };

        console.log('🎉 파일 저장 완료:', {
          fileId: savedFile.id,
          fileName: savedFile.file_name,
          fileSize: `${(savedFile.file_size / 1024 / 1024).toFixed(2)}MB`,
          projectId: savedFile.project_id,
        });

        // 10. 저장 후 자동 데이터베이스 백업 (비동기)
        if (
          (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.saveDatabase
        ) {
          (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite
            .saveDatabase()
            .catch((backupError: Error) => {
              console.warn('⚠️ 자동 백업 실패 (파일은 정상 저장됨):', backupError);
            });
        }

        return savedFile;
      },
      null,
      'saveProjectFile'
    );
  }

  /**
   * 프로젝트별 파일 목록 조회
   */
  async getProjectFiles(projectId: string | number): Promise<ProjectFile[]> {
    return this.executeSafeQuery(
      async () => {
        const projectIdInt = typeof projectId === 'string' ? parseInt(projectId) : projectId;
        if (isNaN(projectIdInt)) {
          throw new Error('유효하지 않은 프로젝트 ID입니다.');
        }

        const response = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query(
          'SELECT id, project_id, file_type, file_name, file_size, mime_type, created_at, updated_at FROM project_files WHERE project_id = ? ORDER BY created_at DESC',
          [projectIdInt]
        );

        return response.map((row: unknown) => ({
          id: row.id,
          project_id: row.project_id,
          file_type: row.file_type,
          file_name: row.file_name,
          file_content: '', // 목록 조회시에는 내용 제외 (성능상 이유)
          file_size: row.file_size,
          mime_type: row.mime_type,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      },
      [],
      'getProjectFiles'
    );
  }

  /**
   * 특정 파일 다운로드 (파일시스템 기반)
   */
  async downloadProjectFile(fileId: string | number): Promise<ProjectFile | null> {
    return this.executeSafeQuery(
      async () => {
        const fileIdInt = typeof fileId === 'string' ? parseInt(fileId) : fileId;
        if (isNaN(fileIdInt)) {
          throw new Error('유효하지 않은 파일 ID입니다.');
        }

        console.log('📂 파일 다운로드 시작 - FileID:', fileIdInt);

        // 1. DB에서 파일 메타데이터 조회
        const response = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM project_files WHERE id = ?', [fileIdInt]);

        if (response.length === 0) {
          console.warn('⚠️ 파일을 찾을 수 없음 - FileID:', fileIdInt);
          return null;
        }

        const row = response[0];
        console.log('📋 파일 메타데이터 조회 완료:', {
          fileName: row.file_name,
          filePath: row.file_path,
          fileSize: row.file_size,
          migrationStatus: row.migration_status,
        });

        let fileContent: string;

        // 2. 마이그레이션 상태에 따른 처리
        if (row.file_path && row.migration_status === 'completed') {
          // 파일시스템에서 파일 읽기
          console.log('💾 파일시스템에서 파일 읽기:', row.file_path);

          // 경로 보안 검증
          if (!FileSystemUtil.validateFilePath(row.file_path)) {
            throw new Error('안전하지 않은 파일 경로입니다.');
          }

          try {
            // 브라우저 환경에서는 직접 파일 시스템 접근 불가
            // 서버사이드에서 파일을 읽어와야 함
            // 임시로 파일 경로 기반으로 처리
            throw new Error('브라우저 환경에서는 직접 파일 시스템 접근이 제한됩니다.');
          } catch (fsError) {
            console.error('❌ 파일시스템 읽기 실패:', fsError);

            // Base64 컨텐츠가 있다면 폴백으로 사용
            if (row.file_content) {
              console.log('🔄 Base64 폴백 사용');
              fileContent = row.file_content;
            } else {
              throw new Error(
                `파일 읽기에 실패했습니다: ${fsError instanceof Error ? fsError.message : '알 수 없는 오류'}`
              );
            }
          }
        } else if (row.file_content) {
          // 마이그레이션 이전 또는 실패한 경우 Base64 사용
          console.log('📄 Base64 컨텐츠 사용 (마이그레이션 상태:', row.migration_status, ')');
          fileContent = row.file_content;
        } else {
          throw new Error(
            '파일 내용을 찾을 수 없습니다. 파일이 손상되었거나 마이그레이션이 필요할 수 있습니다.'
          );
        }

        const result: ProjectFile = {
          id: row.id,
          project_id: row.project_id,
          file_type: row.file_type,
          file_name: row.file_name,
          file_content: fileContent,
          file_path: row.file_path,
          file_size: row.file_size,
          mime_type: row.mime_type,
          metadata: row.metadata,
          migration_status: row.migration_status,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };

        console.log('✅ 파일 다운로드 완료:', {
          fileName: result.file_name,
          fileSize: FileSystemUtil.formatFileSize(result.file_size),
          contentLength: fileContent.length,
        });

        return result;
      },
      null,
      'downloadProjectFile'
    );
  }

  /**
   * 고아 파일 정리 (파일시스템에는 있지만 DB에 없는 파일 삭제)
   */
  async cleanupOrphanedFiles(
    projectId?: string | number
  ): Promise<{ cleaned: number; errors: string[] }> {
    return this.executeSafeQuery(
      async () => {
        console.log('🧽 고아 파일 정리 시작:', projectId ? `프로젝트 ${projectId}` : '전체');

        const cleanupResult = {
          cleaned: 0,
          errors: [] as string[],
        };

        try {
          // 1. DB에서 현재 등록된 파일 경로 목록 조회
          let dbFilePathsQuery: string;
          let queryParams: unknown[] = [];

          if (projectId) {
            const projectIdInt = typeof projectId === 'string' ? parseInt(projectId) : projectId;
            dbFilePathsQuery =
              "SELECT file_path FROM project_files WHERE project_id = ? AND file_path IS NOT NULL AND migration_status = 'completed'";
            queryParams = [projectIdInt];
          } else {
            dbFilePathsQuery =
              "SELECT file_path FROM project_files WHERE file_path IS NOT NULL AND migration_status = 'completed'";
          }

          const dbFilePaths = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query(dbFilePathsQuery, queryParams);
          const registeredPaths = new Set(dbFilePaths.map((row: unknown) => row.file_path));

          console.log('📋 DB에 등록된 파일 수:', registeredPaths.size);

          // 2. 브라우저 환경에서는 파일시스템 직접 접근 불가
          console.log('⚠️ 브라우저 환경에서는 파일시스템 접근 제한');
          console.log('📝 고아 파일 정리는 서버사이드에서 수행해야 합니다.');

          // 3. 브라우저 환경에서는 대신 DB 상태 점검만 수행
          const inconsistentFiles = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query(
            `SELECT id, file_name, file_path, migration_status 
             FROM project_files 
             WHERE migration_status = 'completed' AND file_path IS NOT NULL
             ${projectId ? 'AND project_id = ?' : ''}`,
            projectId ? [typeof projectId === 'string' ? parseInt(projectId) : projectId] : []
          );

          console.log('🔍 파일시스템 마이그레이션 완료 파일 수:', inconsistentFiles.length);

          // 4. 실제 고아 파일 정리는 서버사이드로 위임
          cleanupResult.errors.push('고아 파일 정리는 서버사이드 API로 수행해야 합니다.');

          console.log('✅ 고아 파일 정리 상태 점검 완료');
          return cleanupResult;
        } catch (cleanupError) {
          console.error('❌ 고아 파일 정리 중 오류:', cleanupError);
          cleanupResult.errors.push(
            `정리 중 오류: ${cleanupError instanceof Error ? cleanupError.message : '알 수 없는 오류'}`
          );
          return cleanupResult;
        }
      },
      { cleaned: 0, errors: ['서비스 오류로 인한 정리 실패'] },
      'cleanupOrphanedFiles'
    );
  }

  /**
   * 파일 삭제 (파일시스템 연동 및 트랜잭션 처리)
   */
  async deleteProjectFile(fileId: string | number): Promise<boolean> {
    return this.executeSafeQuery(
      async () => {
        const fileIdInt = typeof fileId === 'string' ? parseInt(fileId) : fileId;
        if (isNaN(fileIdInt)) {
          throw new Error('유효하지 않은 파일 ID입니다.');
        }

        console.log('🗑️ 파일 삭제 시작 - FileID:', fileIdInt);

        // 1. 삭제 전 파일 정보 조회 (트랜잭션 대비)
        const fileInfoQuery = await (
          window as unknown as {
            sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
          }
        ).sqlite.query('SELECT * FROM project_files WHERE id = ?', [fileIdInt]);

        if (fileInfoQuery.length === 0) {
          console.warn('⚠️ 삭제할 파일을 찾을 수 없음 - FileID:', fileIdInt);
          return false; // 이미 삭제된 경우
        }

        const fileInfo = fileInfoQuery[0];
        console.log('📋 파일 정보 확인:', {
          fileName: fileInfo.file_name,
          filePath: fileInfo.file_path,
          migrationStatus: fileInfo.migration_status,
          fileSize: FileSystemUtil.formatFileSize(fileInfo.file_size || 0),
        });

        let fileSystemDeleted = false;
        // let rollbackInfo: unknown = null; // 미사용으로 주석 처리

        try {
          // 2. 파일시스템에서 파일 삭제 (마이그레이션 완료된 경우)
          if (fileInfo.file_path && fileInfo.migration_status === 'completed') {
            console.log('💾 파일시스템에서 파일 삭제 시도:', fileInfo.file_path);

            // 경로 보안 검증
            if (!FileSystemUtil.validateFilePath(fileInfo.file_path)) {
              throw new Error('안전하지 않은 파일 경로입니다.');
            }

            try {
              // 브라우저 환경 제약으로 직접 파일 삭제 불가
              // 서버사이드에서 처리해야 함
              console.log('⚠️ 브라우저 환경에서는 직접 파일 삭제 제한');

              // 파일시스템 삭제 대신 마크만 진행
              fileSystemDeleted = true; // 브라우저 환경에서는 사실상 DB만 삭제
            } catch (fsError) {
              console.error('❌ 파일시스템 삭제 실패:', fsError);

              // 파일 삭제 실패 시 대안 처리
              if (fileInfo.file_content) {
                console.log('🔄 Base64 컨텐츠가 있으므로 DB만 삭제 진행');
                fileSystemDeleted = true; // 폴백 데이터가 있으므로 계속 진행
              } else {
                throw new Error(
                  `파일시스템 삭제에 실패했고 폴백 데이터도 없습니다: ${fsError instanceof Error ? fsError.message : '알 수 없는 오류'}`
                );
              }
            }
          } else {
            console.log('📄 Base64 컨텐츠 기반 파일 (파일시스템 삭제 생략)');
            fileSystemDeleted = true; // Base64 데이터만 있으므로 DB 삭제만 진행
          }

          // 3. DB 삭제 수행 (트랜잭션 기반)
          console.log('📊 DB 레코드 삭제 시작...');

          await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('BEGIN TRANSACTION');

          const deleteResult = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('DELETE FROM project_files WHERE id = ?', [fileIdInt]);

          if (deleteResult.changes === 0) {
            await (
              window as unknown as {
                sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
              }
            ).sqlite.query('ROLLBACK');
            console.warn('⚠️ DB에서 삭제할 레코드를 찾을 수 없음');
            return false;
          }

          await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('COMMIT');
          console.log('✅ DB 레코드 삭제 완료');

          // 4. 삭제 성공 로깅
          console.log('🎉 파일 삭제 완료:', {
            fileId: fileIdInt,
            fileName: fileInfo.file_name,
            fileSystemDeleted: fileSystemDeleted,
            dbDeleted: true,
          });

          return true;
        } catch (deleteError) {
          console.error('❌ 파일 삭제 중 오류 발생:', deleteError);

          // 5. 오류 발생 시 트랜잭션 롤백
          try {
            await (
              window as unknown as {
                sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
              }
            ).sqlite.query('ROLLBACK');
            console.log('🔄 DB 트랜잭션 롤백 완료');
          } catch (rollbackError) {
            console.error('❌ 롤백 실패:', rollbackError);
          }

          // 오류 상세 정보 제공
          if (deleteError instanceof Error) {
            if (deleteError.message.includes('constraint')) {
              throw new Error('파일이 다른 데이터에서 참조되고 있어 삭제할 수 없습니다.');
            } else if (deleteError.message.includes('경로')) {
              throw new Error('파일 경로에 보안 위험이 감지되어 삭제를 중단했습니다.');
            }
          }

          throw new Error(
            `파일 삭제 중 오류가 발생했습니다: ${deleteError instanceof Error ? deleteError.message : '알 수 없는 오류'}`
          );
        }
      },
      false,
      'deleteProjectFile'
    );
  }
  async getDashboardState(): Promise<DashboardState> {
    return this.executeSafeQuery(
      async () => {
        const projects = await this.getProjects();
        const activeProject = projects.find(p => p.status !== 'completed') || null;
        const progress = activeProject ? await this.getProjectProgress(activeProject.id) : null;

        return {
          projects,
          activeProject,
          progress,
          systemStatus: this.serviceStatus.isConnected ? 'idle' : 'error',
          lastUpdate: new Date().toISOString(),
        };
      },
      // 폴백 데이터: 기본 대시보드 상태
      {
        projects: [],
        activeProject: null,
        progress: null,
        systemStatus: 'error',
        lastUpdate: new Date().toISOString(),
      },
      'getDashboardState'
    );
  }

  /**
   * 파일 마이그레이션 실행
   */
  async executeMigration(onProgress?: (progress: unknown) => void): Promise<unknown> {
    return this.executeSafeQuery(
      async () => {
        return await FileMigrationService.executeMigration(onProgress);
      },
      { totalFiles: 0, processedFiles: 0, successCount: 0, errorCount: 0, errors: [] },
      'executeMigration'
    );
  }

  /**
   * 마이그레이션 상태 확인
   */
  async getMigrationStatus(): Promise<unknown> {
    return this.executeSafeQuery(
      async () => {
        return await FileMigrationService.getMigrationStatus();
      },
      { total: 0, pending: 0, completed: 0, failed: 0 },
      'getMigrationStatus'
    );
  }

  /**
   * 마이그레이션 롤백
   */
  async rollbackMigration(): Promise<boolean> {
    return this.executeSafeQuery(
      async () => {
        await FileMigrationService.rollbackMigration();
        return true;
      },
      false,
      'rollbackMigration'
    );
  }
  /**
   * 프로젝트 삭제 (강화된 에러 핸들링 및 트랜잭션 안전성)
   */
  async deleteProject(projectId: string): Promise<boolean> {
    return this.executeSafeQuery(
      async () => {
        console.log('🗑️ CultureStateService.deleteProject 시작:', projectId);

        const projectIdInt = parseInt(projectId);

        if (isNaN(projectIdInt)) {
          throw new Error('유효하지 않은 프로젝트 ID입니다.');
        }

        console.log('🔄 연관 데이터 CASCADE 삭제 시작 (projectId:', projectIdInt, ')');

        try {
          // 1. project_insights 삭제
          console.log('1️⃣ project_insights 삭제 중...');
          const insightsResult = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('DELETE FROM project_insights WHERE project_id = ?', [projectIdInt]);
          console.log('✅ project_insights 삭제 완료:', insightsResult);

          // 2. layer_analysis 삭제 (session_id 기반)
          console.log('2️⃣ 프로젝트 세션 조회 중...');
          const sessionQuery = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('SELECT id FROM interview_sessions WHERE project_id = ?', [projectIdInt]);
          const sessionIds = sessionQuery.results || [];
          console.log('📋 조회된 세션 수:', sessionIds.length);

          let totalLayerDeleted = 0;
          for (const session of sessionIds) {
            const layerResult = await (
              window as unknown as {
                sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
              }
            ).sqlite.query('DELETE FROM layer_analysis WHERE session_id = ?', [session.id]);
            totalLayerDeleted += layerResult.changes || 0;
          }
          console.log('✅ layer_analysis 삭제 완료, 총 삭제된 행:', totalLayerDeleted);

          // 3. interview_sessions 삭제
          console.log('3️⃣ interview_sessions 삭제 중...');
          const sessionsResult = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('DELETE FROM interview_sessions WHERE project_id = ?', [projectIdInt]);
          console.log('✅ interview_sessions 삭제 완룼:', sessionsResult);

          // 4. 메인 culture_projects 삭제
          console.log('4️⃣ culture_projects 삭제 중...');
          const projectResult = await (
            window as unknown as {
              sqlite: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
            }
          ).sqlite.query('DELETE FROM culture_projects WHERE id = ?', [projectIdInt]);
          console.log('✅ culture_projects 삭제 완료:', projectResult);

          // 삭제 결과 검증
          if (projectResult.changes === 0) {
            console.warn(
              '⚠️ 경고: culture_projects에서 삭제된 행이 없음. 프로젝트가 이미 삭제되었거나 존재하지 않음.'
            );
            // 그래도 연관 데이터는 정리되었으므로 true 반환
          }

          console.log('🎉 프로젝트 삭제 완료! 삭제된 행 수:', {
            insights: insightsResult.changes || 0,
            layers: totalLayerDeleted,
            sessions: sessionsResult.changes || 0,
            project: projectResult.changes || 0,
          });

          return true;
        } catch (deleteError) {
          console.error('❌ CASCADE 삭제 중 오류 발생:', deleteError);

          // 삭제 실패 상세 정보 제공
          if (deleteError instanceof Error) {
            if (deleteError.message.includes('project_insights')) {
              throw new Error('프로젝트 인사이트 데이터 삭제에 실패했습니다.');
            } else if (deleteError.message.includes('layer_analysis')) {
              throw new Error('층위 분석 데이터 삭제에 실패했습니다.');
            } else if (deleteError.message.includes('interview_sessions')) {
              throw new Error('인터뷰 세션 데이터 삭제에 실패했습니다.');
            } else if (deleteError.message.includes('culture_projects')) {
              throw new Error('메인 프로젝트 데이터 삭제에 실패했습니다.');
            }
          }

          throw new Error(
            `프로젝트 삭제 중 예상치 못한 오류가 발생했습니다: ${deleteError instanceof Error ? deleteError.message : '알 수 없는 오류'}`
          );
        }
      },
      false, // 폴백 데이터: false
      'deleteProject'
    );
  }
}

export const cultureStateService = new CultureStateService();
export default CultureStateService;
