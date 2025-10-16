/**
 * 컬쳐맵 내보내기 옵션
 */
export interface ExportOptions {
  /** 내보내기 형식 */
  format: 'png' | 'svg' | 'json' | 'excel';
  /** 파일명 (확장자 제외) */
  filename?: string;
  /** PNG 이미지 품질 (0-1) */
  quality?: number;
}

/**
 * 보고서 내보내기 옵션
 */
export interface ReportExportOptions {
  /** 내보내기 형식 */
  format: 'word' | 'pdf' | 'excel';
  /** 메타데이터 포함 여부 (작성자, 날짜 등) */
  includeMetadata?: boolean;
}
