// src/types/culture.ts

/**
 * Step 0~4 표준 워크플로우 상태 인터페이스
 * UI 간 완전 호환성 보장
 */
export interface AnalysisWorkflowState {
  stage: WorkflowStage;
  step0Data: {
    transcription: string;
    metadata: {
      fileName: string;
      duration?: string;
      speakers: number;
      confidence: number;
    };
  } | null;
  step1Data: {
    metadata: {
      totalFiles: number;
      totalDuration: string;
      speakers: {
        leaders: number;
        members: number;
      };
    };
    keywordFrequency: Array<{
      keyword: string;
      totalCount: number;
      leaderMentions: number;
      memberMentions: number;
    }>;
    nonVerbalCues: Array<{
      type: 'positive' | 'negative';
      expression: string;
      totalCount: number;
      leaderMentions: number;
      memberMentions: number;
    }>;
  } | null;
  step2Data: string | null; // Gemini 1차 분석 결과
  step3Data: string | null; // Claude Culture Map 텍스트
  step4Data: {
    analysisResult: FourLayerAnalysisResult;
    visualizationData: unknown;
  } | null;
  progress: number; // 0-100
  isProcessing: boolean;
  error?: string;
  completedStages: Set<string>;
}

/**
 * Step 0~4 표준 워크플로우 단계 정의
 */
export type WorkflowStage = 'step0' | 'step1' | 'step2' | 'step3' | 'step4';

/**
 * 워크플로우 진행 상황 콜백 타입
 */
export type WorkflowProgressCallback = (state: AnalysisWorkflowState, message?: string) => void;

/**
 * Step 0~4 단계별 상태
 */
export interface StageStatus {
  id: WorkflowStage;
  label: string;
  description: string;
  icon: string;
  completed: boolean;
  current: boolean;
  isProcessing?: boolean;
  error?: string;
  data?: unknown;
}

/**
 * 표준 5단계 정의 (기존 UI 호환성 유지)
 */
export const STANDARD_WORKFLOW_STAGES: StageStatus[] = [
  {
    id: 'step0',
    label: 'NotebookLM 음성변환',
    description: '음성 파일을 텍스트로 변환',
    icon: '🎤',
    completed: false,
    current: false,
  },
  {
    id: 'step1',
    label: 'NotebookLM 정량분석',
    description: '키워드 빈도 및 정량 데이터 추출',
    icon: '📊',
    completed: false,
    current: false,
  },
  {
    id: 'step2',
    label: 'Gemini 1차분석',
    description: 'AI 예비 분석 수행',
    icon: '🧠',
    completed: false,
    current: false,
  },
  {
    id: 'step3',
    label: 'Claude 컴쳐맵',
    description: '4층위 분석 및 컴쳐맵 생성',
    icon: '🗺️',
    completed: false,
    current: false,
  },
  {
    id: 'step4',
    label: 'Claude 최종보고서',
    description: '종합 분석 보고서 작성 (시각화 포함)',
    icon: '📋',
    completed: false,
    current: false,
  },
];

/**
 * 구성원 인식 강도 타입 (인터뷰 빈도 기반)
 */
export type PerceptionIntensity = 'high' | 'medium' | 'low' | null;

/**
 * 빈도 레이블 매핑
 */
export const FREQUENCY_LABELS: Record<Exclude<PerceptionIntensity, null>, string> = {
  high: '빈도多',
  medium: '빈도中',
  low: '빈도少',
};

/**
 * AI 강도(1~5)와 시스템 강도(low/medium/high) 매핑
 */
export const INTENSITY_MAP = {
  TO_STRING: (val: number): PerceptionIntensity => {
    if (val >= 4) return 'high';
    if (val >= 2) return 'medium';
    return 'low';
  },
  TO_NUMBER: (val: PerceptionIntensity): number => {
    if (val === 'high') return 5;
    if (val === 'medium') return 3;
    return 1;
  }
};

/**
 * 애플리케이션 모드
 * - workshop: 워크샵 모드 (포스트잇 기반, 빈도 기능 숨김)
 * - consulting: 컨설팅 모드 (인터뷰 분석 기반, 빈도 기능 활성화)
 */
export type AppMode = 'workshop' | 'consulting';

/**
 * 컬쳐맵 노트 데이터
 */
export type NoteType = '결과' | '행동' | '유형_레버' | '무형_레버' | 'insight';

/**
 * 컬쳐맵 노트 데이터
 */
export interface NoteData {
  id: string;
  content: string; // text -> content로 통일
  position: { x: number; y: number };
  width?: number;
  height?: number;
  type: NoteType;
  sentiment: 'positive' | 'negative' | 'neutral';
  perceptionIntensity?: PerceptionIntensity;
  frequency?: PerceptionIntensity;
  basis?: string;
  layer: 1 | 2 | 3 | 4;
  connections?: string[];
  /** 생성자 구분: 'user' (사용자) | 'ai' (AI) - 사용자가 편집하면 즉시 'user'로 변경 */
  createdBy?: 'user' | 'ai';
  /** 자동 정렬에서 위치 유지 여부 */
  pinned?: boolean;
  /** 자동 정렬에서 연결 핸들 유지 여부 */
  pinnedHandles?: boolean;
}

/**
 * 컬쳐맵 연결 데이터
 */
export interface ConnectionData {
  id: string;
  sourceId: string; // 노트 ID
  targetId: string; // 노트 ID
  relationType: 'direct' | 'indirect';
  isPositive: boolean;
  type?: 'influences' | 'supports' | 'conflicts' | 'depends_on';
  strength?: 'weak' | 'medium' | 'strong';
  description?: string;
  /** 생성자 구분: 'user' (사용자) | 'ai' (AI) - 사용자가 편집하면 즉시 'user'로 변경 */
  createdBy?: 'user' | 'ai';
  /** 연결선 소스 핸들 위치 (top/bottom/left/right) */
  sourceHandle?: string;
  /** 연결선 타겟 핸들 위치 (top/bottom/left/right) */
  targetHandle?: string;
}

/**
 * 프롬프트 생성 타입 정의
 */
export type PromptType =
  | 'four_layer_analysis' // Dave Gray-Schein 4층위 분석
  | 'insight_extraction' // 핵심 인사이트 추출
  | 'problem_diagnosis' // 문제점 진단
  | 'culture_assessment' // 조직문화 현황 평가
  | 'change_strategy' // 변화 전략 수립
  | 'leader_analysis'; // 리더십 분석

/**
 * 프롬프트 템플릿 인터페이스
 */
export interface PromptTemplate {
  id: PromptType;
  name: string;
  description: string;
  category: '분석' | '진단' | '전략';
  template: string;
  variables: string[]; // 템플릿에서 사용하는 변수명들
  examples?: string[];
  academicFocus: string; // 학술적 근거 중점 영역
}

/**
 * 생성된 프롬프트 정보
 */
export interface GeneratedPrompt {
  id: string;
  type: PromptType;
  inputText: string;
  generatedPrompt: string;
  createdAt: string;
  copied?: boolean;
}

/**
 * 수동 분석 입력 데이터
 */
export interface ManualAnalysisInput {
  text: string;
  source: 'manual_input' | 'file_upload';
  fileName?: string;
  fileSize?: number;
  uploadedAt: string;
}

/**
 * 분석 모드 타입
 */
export type AnalysisMode =
  | 'manual_input' // 수동 텍스트 입력
  | 'prompt_generator'; // 프롬프트 생성

/**
 * Claude 이중 역할 체인 상태
 */
export interface ChainedPromptState {
  isActive: boolean;
  currentStep: 'culturemap' | 'report' | 'completed';
  progress: number; // 0-100
  cultureMapResult?: string;
  reportResult?: string;
  startTime?: string;
  endTime?: string;
  error?: string;
}

/**
 * Claude 이중 역할 단계별 정보
 */
export interface ChainedStep {
  id: 'culturemap' | 'report';
  title: string;
  description: string;
  icon: string;
  prompt: string;
  completed: boolean;
  isActive: boolean;
  result?: string;
  duration?: number; // milliseconds
  tokens?: number; // 예상 토큰 사용량
}

/**
 * 체인 실행 콜백 타입
 */
export type ChainProgressCallback = (state: ChainedPromptState, message?: string) => void;

/**
 * Dave Gray-Schein 4층위 분석 결과 구조
 */
export interface FourLayerAnalysisResult {
  artifacts: {
    visible_elements: string[];
    symbols: string[];
    rituals: string[];
    stories: string[];
  };
  behaviors: {
    patterns: string[];
    interactions: string[];
    decision_making: string[];
    communication: string[];
  };
  norms_values: {
    stated_values: string[];
    implicit_norms: string[];
    cultural_rules: string[];
    belief_systems: string[];
  };
  assumptions: {
    basic_assumptions: string[];
    mental_models: string[];
    worldviews: string[];
    unconscious_beliefs: string[];
  };
  insights: {
    patterns: string[];
    gaps: string[];
    risks: string[];
    opportunities: string[];
    recommendations: string[];
  };
  academic_references: string[];
  confidence_score: number;
}

/**
 * 구성원 인식 강도 분석 (Step 3 컬쳐맵용)
 */
export interface MemberPerceptionIntensity {
  element: string;
  mentionFrequency: number; // 언급 횟수
  emotionalIntensity: 'low' | 'medium' | 'high'; // 감정적 강도
  groupConsensus: number; // 집단 합의도 (0-1)
  perceptionLevel: 'focus' | 'interest' | 'mention'; // [집중][관심][언급]
}

/**
 * 컬쳐맵 요소 (구성원 인식 강도 포함)
 */
export interface CultureMapElement {
  id: string;
  content: string;
  type: 'artifact' | 'behavior' | 'norm_value' | 'assumption';
  sentiment: 'positive' | 'negative' | 'neutral';
  perceptionData: MemberPerceptionIntensity;
  academicBasis?: {
    concept: string;
    source: string;
    field: string;
  };
}

/**
 * 인지편향 분석 결과 (Step 4 최종보고서용)
 */
export interface CognitiveBiasAnalysis {
  overestimatedElements: {
    element: string;
    biasType: 'negativity_bias' | 'availability_bias' | 'confirmation_bias';
    evidence: string;
    theoreticalBasis: string;
  }[];
  underestimatedElements: {
    element: string;
    reason: 'taken_for_granted' | 'blind_spot' | 'abstraction';
    hiddenImpact: string;
    riskOfIgnoring: string;
  }[];
  accuratePerceptions: string[];
}

/**
 * 최종 분석 보고서 구조 (Step 4용)
 */
export interface ComprehensiveAnalysisReport {
  memberPerceptionStatus: {
    topMentionedIssues: MemberPerceptionIntensity[];
    attentionPattern: 'problem_focused' | 'balanced' | 'strength_focused';
    emotionalDistribution: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
  perceptionRealityGap: CognitiveBiasAnalysis;
  consultingStrategy: {
    immediateFocus: string[]; // 높은 인식 + 실제 영향
    hiddenStrengths: string[]; // 낮은 인식 + 높은 영향
    perceptionCorrection: string[]; // 높은 인식 + 낮은 영향
    futureOpportunities: string[]; // 잠재적 변화 동력
  };
  organizationDiagnosis: {
    overallState:
    | 'crisis'
    | 'problem_focused'
    | 'hybrid_transition'
    | 'growth_oriented'
    | 'excellence';
    confidence: number;
    reasoning: string[];
    dominantNarrative: string;
  };
}
