// src/utils/FileSystemUtil.ts

import { v4 as uuidv4 } from 'uuid';

/**
 * 파일 시스템 유틸리티 클래스
 * 브라우저 환경에서의 파일 관리를 위한 도우미 클래스
 */
export class FileSystemUtil {
  private static readonly UPLOAD_BASE_PATH = 'uploads';
  private static readonly MAX_FILENAME_LENGTH = 255;
  private static readonly DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js'];

  /**
   * 고유한 파일명 생성
   * @param projectId 프로젝트 ID
   * @param originalFileName 원본 파일명
   * @returns 고유한 파일명 (projectId_timestamp_uuid_originalName)
   */
  static generateUniqueFileName(projectId: number | string, originalFileName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8); // 8자리 UUID
    const sanitizedOriginalName = this.sanitizeFileName(originalFileName);

    const uniqueName = `${projectId}_${timestamp}_${uuid}_${sanitizedOriginalName}`;

    // 파일명 길이 제한 확인
    if (uniqueName.length > this.MAX_FILENAME_LENGTH) {
      const extension = this.getFileExtension(sanitizedOriginalName);
      const baseName = sanitizedOriginalName.replace(extension, '');
      const truncatedBase = baseName.substring(0, 50); // 기본명을 50자로 제한
      return `${projectId}_${timestamp}_${uuid}_${truncatedBase}${extension}`;
    }

    return uniqueName;
  }

  /**
   * 파일명 안전화 (특수문자 제거)
   * @param fileName 원본 파일명
   * @returns 안전한 파일명
   */
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"|?*\\]/g, '_') // 위험한 특수문자를 언더스코어로 변경
      .replace(/\s+/g, '_') // 공백을 언더스코어로 변경
      .replace(/_{2,}/g, '_') // 연속된 언더스코어를 하나로 축약
      .trim();
  }

  /**
   * 파일 확장자 추출
   * @param fileName 파일명
   * @returns 확장자 (점 포함)
   */
  static getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  }

  /**
   * 파일 확장자 검증
   * @param fileName 파일명
   * @returns 안전한 확장자인지 여부
   */
  static validateFileExtension(fileName: string): boolean {
    const extension = this.getFileExtension(fileName).toLowerCase();
    return !this.DANGEROUS_EXTENSIONS.includes(extension);
  }

  /**
   * MIME 타입 검증
   * @param mimeType MIME 타입
   * @returns 허용된 MIME 타입인지 여부
   */
  static validateMimeType(mimeType: string): boolean {
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/json',
      'text/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/pdf',
    ];

    return allowedTypes.includes(mimeType);
  }

  /**
   * 프로젝트별 파일 경로 생성
   * @param projectId 프로젝트 ID
   * @param uniqueFileName 고유 파일명
   * @returns 파일 저장 경로
   */
  static generateFilePath(projectId: number | string, uniqueFileName: string): string {
    return `${this.UPLOAD_BASE_PATH}/project_${projectId}/${uniqueFileName}`;
  }

  /**
   * 경로 traversal 공격 방지 검증
   * @param filePath 파일 경로
   * @returns 안전한 경로인지 여부
   */
  static validateFilePath(filePath: string): boolean {
    // 상위 디렉토리 접근 패턴 검증
    const dangerousPatterns = ['../', '..\\', '~/', '/etc/', '/root/', 'C:\\'];

    for (const pattern of dangerousPatterns) {
      if (filePath.includes(pattern)) {
        return false;
      }
    }

    // uploads 폴더 내부인지 확인
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.startsWith(this.UPLOAD_BASE_PATH + '/');
  }

  /**
   * Base64 데이터를 Blob으로 변환
   * @param base64Data Base64 인코딩된 데이터
   * @param mimeType MIME 타입
   * @returns Blob 객체
   */
  static base64ToBlob(base64Data: string, mimeType: string): Blob {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * 파일 크기를 사람이 읽기 쉬운 형태로 포맷
   * @param bytes 바이트 크기
   * @returns 포맷된 크기 문자열
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
}

/**
 * 파일 저장 관련 인터페이스
 */
export interface FileStorageInfo {
  originalName: string;
  uniqueName: string;
  filePath: string;
  size: number;
  mimeType: string;
}

/**
 * 마이그레이션 관련 인터페이스
 */
export interface MigrationProgress {
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  currentFile?: string;
  errors: string[];
}
