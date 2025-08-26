// src/types/culture_extended.ts
// 🔥 진화적 확장: 다중 조직 분석 관리 시스템 타입 정의

/**
 * 조직 분석 상태 타입
 */
export type OrganizationAnalysisStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

/**
 * 조직 규모 분류
 */
export type OrganizationSize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';

/**
 * 산업 분류 (한국 표준 산업 분류 기반)
 */
export type IndustryType =
  | 'manufacturing' // 제조업
  | 'construction' // 건설업
  | 'wholesale_retail' // 도소매업
  | 'transportation' // 운수창고업
  | 'accommodation' // 숙박음식점업
  | 'information' // 정보통신업
  | 'finance_insurance' // 금융보험업
  | 'real_estate' // 부동산업
  | 'professional' // 전문과학기술서비스업
  | 'business_support' // 사업시설관리지원서비스업
  | 'public_admin' // 공공행정국방사회보장행정
  | 'education' // 교육서비스업
  | 'health_social' // 보건업및사회복지서비스업
  | 'arts_sports' // 예술스포츠여가관련서비스업
  | 'association' // 협회및단체수리및기타개인서비스업
  | 'household' // 가구내고용활동
  | 'international' // 국제및외국기관
  | 'other'; // 기타

/**
 * 조직 분석 결과 인터페이스
 */
export interface OrganizationAnalysis {
  id: number;
  culture_project_id: number;
  organization_code: string;
  industry_type?: IndustryType;
  organization_size?: OrganizationSize;
  analysis_status: OrganizationAnalysisStatus;
  culture_map_data?: unknown; // FourLayerAnalysisResult와 호환
  key_insights?: {
    patterns: string[];
    gaps: string[];
    risks: string[];
    opportunities: string[];
    recommendations: string[];
  };
  recommendations?: {
    immediate_actions: string[];
    long_term_strategies: string[];
    leadership_development: string[];
    cultural_interventions: string[];
  };
  analysis_summary?: string;
  completion_date?: string;
  analyst_notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  // 조인된 필드
  organization_name?: string;
  framework_type?: string;
}

/**
 * 조직간 비교 분석 인터페이스
 */
export interface AnalysisComparison {
  id: number;
  comparison_name: string;
  organization_ids: number[];
  comparison_criteria?: {
    dimensions: string[];
    weights: { [key: string]: number };
    focus_areas: string[];
  };
  comparative_insights?: {
    similarities: string[];
    differences: string[];
    best_practices: string[];
    learning_opportunities: string[];
    industry_benchmarks: string[];
  };
  created_by?: string;
  created_at: string;
}

/**
 * 조직 분석 필터 옵션
 */
export interface OrganizationAnalysisFilters {
  status?: OrganizationAnalysisStatus;
  industry_type?: IndustryType;
  organization_size?: OrganizationSize;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  offset?: number;
}

/**
 * 대시보드 통계 데이터
 */
export interface DashboardStatistics {
  totalOrganizations: number;
  completedAnalyses: number;
  inProgressAnalyses: number;
  totalComparisons: number;
  industryBreakdown: Array<{
    industry_type: IndustryType;
    count: number;
    percentage: number;
  }>;
  sizeBreakdown: Array<{
    organization_size: OrganizationSize;
    count: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    organization_code: string;
    organization_name: string;
    analysis_status: OrganizationAnalysisStatus;
    updated_at: string;
    action_type: 'created' | 'updated' | 'completed';
  }>;
  performanceMetrics: {
    averageCompletionTime: number; // days
    completionRate: number; // percentage
    qualityScore: number; // 0-100
  };
}

/**
 * 데이터 품질 검사 결과
 */
export interface DataQualityReport {
  issues: string[];
  recommendations: string[];
  score: number; // 0-100
  categories: {
    data_integrity: {
      score: number;
      issues: string[];
    };
    completeness: {
      score: number;
      issues: string[];
    };
    consistency: {
      score: number;
      issues: string[];
    };
    timeliness: {
      score: number;
      issues: string[];
    };
  };
  recommendations_by_priority: {
    critical: string[];
    high: string[];
    medium: string[];
    low: string[];
  };
}

/**
 * 데이터 내보내기 옵션
 */
export interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  includeMetadata: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  fields?: string[];
  filters?: OrganizationAnalysisFilters;
}

/**
 * 진화적 스키마 업그레이드 결과
 */
export interface SchemaUpgradeResult {
  success: boolean;
  version: string;
  changes: string[];
  warnings: string[];
  errors: string[];
  rollbackPossible: boolean;
}

/**
 * 기술부채 추적 정보
 */
export interface TechnicalDebt {
  id: string;
  type: 'data_quality' | 'schema_design' | 'performance' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  estimatedEffort: number; // hours
  createdAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  tags: string[];
}

/**
 * 성능 메트릭
 */
export interface PerformanceMetrics {
  queryPerformance: {
    averageResponseTime: number; // ms
    slowQueries: Array<{
      sql: string;
      duration: number;
      frequency: number;
    }>;
  };
  memoryUsage: {
    current: number; // MB
    peak: number;
    average: number;
  };
  storageUsage: {
    totalSize: number; // MB
    tablesSizes: Array<{
      tableName: string;
      size: number;
      rowCount: number;
    }>;
  };
  userActivity: {
    activeUsers: number;
    sessionDuration: number; // minutes
    operationsPerHour: number;
  };
}

/**
 * 조직문화 분석 보고서 템플릿
 */
export interface CultureAnalysisReport {
  id: string;
  organization_analysis_id: number;
  template_type: 'executive_summary' | 'detailed_analysis' | 'action_plan' | 'comparative_study';
  title: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    type: 'text' | 'chart' | 'table' | 'infographic';
    data?: unknown;
  }>;
  metadata: {
    author: string;
    createdAt: string;
    lastModified: string;
    version: string;
    wordCount: number;
    estimatedReadingTime: number; // minutes
  };
  exportFormats: Array<'pdf' | 'word' | 'powerpoint' | 'html'>;
  academicReferences: Array<{
    id: string;
    citation: string;
    type: 'journal' | 'book' | 'conference' | 'report';
    relevance: 'high' | 'medium' | 'low';
  }>;
}

/**
 * 학술적 근거 추적 시스템
 */
export interface AcademicReference {
  id: string;
  citation: string;
  authors: string[];
  title: string;
  journal?: string;
  year: number;
  doi?: string;
  abstract?: string;
  relevantConcepts: string[];
  qualityScore: number; // 0-100 (SSCI, SCI 등급 기반)
  usageCount: number;
  lastUsed: string;
}

/**
 * 한국적 조직문화 특성 분석 결과
 */
export interface KoreanCultureAnalysis {
  hierarchyIndex: number; // 0-100 (권력거리)
  collectivismIndex: number; // 0-100 (집단주의)
  relationshipOrientation: number; // 0-100 (관계지향성)
  harmonyEmphasis: number; // 0-100 (화합 중시)
  longTermOrientation: number; // 0-100 (장기지향성)
  uncertaintyAvoidance: number; // 0-100 (불확실성 회피)
  contextualCommunication: number; // 0-100 (고맥락 커뮤니케이션)

  culturalDimensions: {
    hofstedeScores: {
      powerDistance: number;
      individualismCollectivism: number;
      masculinityFemininity: number;
      uncertaintyAvoidance: number;
      longTermOrientation: number;
      indulgenceRestraint: number;
    };
    trompenaarsScores: {
      universalismParticularism: number;
      individualismCommunitarianism: number;
      specificDiffuse: number;
      achievementAscription: number;
      sequentialSynchronic: number;
      internalExternal: number;
      emotionalNeutral: number;
    };
  };

  koreanSpecificFactors: {
    nunchi: number; // 눈치 문화
    jeong: number; // 정 문화
    uri: number; // 우리 의식
    chemyeon: number; // 체면 문화
    ppalli: number; // 빨리빨리 문화
    hierarchy: number; // 서열 문화
  };
}

/**
 * 조직문화 변화 추적 시스템
 */
export interface CultureChangeTracking {
  id: string;
  organization_analysis_id: number;
  baseline_date: string;
  current_date: string;
  change_initiatives: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    type: 'leadership' | 'structure' | 'process' | 'values' | 'communication';
    impact_score: number; // 0-100
  }>;
  culture_metrics_changes: {
    artifacts: {
      before: number;
      after: number;
      change_percentage: number;
    };
    behaviors: {
      before: number;
      after: number;
      change_percentage: number;
    };
    norms_values: {
      before: number;
      after: number;
      change_percentage: number;
    };
    assumptions: {
      before: number;
      after: number;
      change_percentage: number;
    };
  };
  key_changes: {
    positive_changes: string[];
    negative_changes: string[];
    neutral_changes: string[];
    unexpected_changes: string[];
  };
  change_velocity: number; // 변화 속도 지수
  sustainability_score: number; // 지속가능성 점수
}

/**
 * 확장된 데이터베이스 서비스 인터페이스
 */
export interface ExtendedDatabaseService {
  // 스키마 관리
  upgradeSchemaEvolutionary(): Promise<boolean>;

  // 조직 분석 관리
  saveOrganizationAnalysis(data: Partial<OrganizationAnalysis>): Promise<{
    success: boolean;
    id?: number;
    error?: string;
  }>;
  getOrganizationAnalyses(filters?: OrganizationAnalysisFilters): OrganizationAnalysis[];

  // 비교 분석 관리
  saveAnalysisComparison(data: Partial<AnalysisComparison>): Promise<{
    success: boolean;
    id?: number;
    error?: string;
  }>;
  getAnalysisComparisons(limit?: number): AnalysisComparison[];

  // 대시보드 및 통계
  getDashboardStats(): DashboardStatistics;

  // 데이터 품질 관리
  performDataQualityCheck(): DataQualityReport;

  // 데이터 내보내기
  exportOrganizationAnalyses(format?: 'csv' | 'json'): string;

  // window.sqlite 확장
  extendWindowSqlite(): void;
}

/**
 * 조직 분석 매니저 컴포넌트 Props
 */
export interface OrganizationAnalysisManagerProps {
  projectId: number;
  onAnalysisUpdate?: (analysis: OrganizationAnalysis) => void;
  onComparisionCreate?: (comparison: AnalysisComparison) => void;
  initialFilters?: OrganizationAnalysisFilters;
  showAdvancedFeatures?: boolean;
}
