// src/types/layerSystem.ts

import type { Position } from './index';
import type { NoteData } from './culture';

/**
 * 4개 층위 시스템 타입 정의
 * Dave Gray-Schein 모델 기반 4층위: 결과 → 행동 → 유형 → 무형
 */
export type LayerType = '결과' | '행동' | '유형_레버' | '무형_레버';

/**
 * 층위 인덱스 (하위 층위일수록 낮은 번호)
 */
export type LayerIndex = 0 | 1 | 2 | 3;

/**
 * 층위 매핑 정보
 */
export const LAYER_CONFIG = {
  결과: {
    index: 0 as LayerIndex,
    color: '#FF6B6B', // 빨간색 계열
    label: '결과 상태',
    description: '가시적 성과와 결과물',
    sortPriority: 0,
    zIndex: 1000,
  },
  행동: {
    index: 1 as LayerIndex,
    color: '#4ECDC4', // 청록색 계열
    label: '행동 패턴',
    description: '관찰 가능한 행동 패턴',
    sortPriority: 1,
    zIndex: 900,
  },
  유형_레버: {
    index: 2 as LayerIndex,
    color: '#45B7D1', // 파란색 계열
    label: '유형 요인',
    description: '구조, 시스템, 프로세스',
    sortPriority: 2,
    zIndex: 800,
  },
  무형_레버: {
    index: 3 as LayerIndex,
    color: '#96CEB4', // 녹색 계열
    label: '무형 요인',
    description: '가치관, 신념, 가정',
    sortPriority: 3,
    zIndex: 700,
  },
} as const;

/**
 * 확장된 포스트잇 데이터 (층위 관리 기능 포함)
 */
export interface EnhancedNoteData extends Omit<NoteData, 'type'> {
  type: LayerType;
  layerIndex: LayerIndex;

  // 층위 무결성 관련 필드
  originalLayerIndex: LayerIndex; // 원래 할당된 층위
  layerLockLevel: LayerLockLevel; // 층위 이동 제한 수준
  lastLayerValidation: number; // 마지막 층위 유효성 검사 시간 (timestamp)

  // 동적 위치 관리
  constraintBounds?: {
    minY: number; // 층위의 최소 Y 좌표
    maxY: number; // 층위의 최대 Y 좌표
  };

  // 스냅 기능 관련
  snapToGrid: boolean;
  gridSize: number;
  snapToLayer: boolean; // 층위 경계에 자동 스냅 여부

  // 시각적 피드백
  isOutOfLayer: boolean; // 잘못된 층위에 위치한지 여부
  warningLevel: 'none' | 'warning' | 'error'; // 경고 수준

  // 메타데이터
  movementHistory: LayerMovementRecord[]; // 이동 히스토리
}

/**
 * 층위 이동 제한 수준
 */
export type LayerLockLevel =
  | 'free' // 자유 이동 가능
  | 'soft' // 경고 표시하되 이동 허용
  | 'hard' // 층위 내에서만 이동 허용
  | 'locked'; // 완전 고정

/**
 * 층위 이동 기록
 */
export interface LayerMovementRecord {
  timestamp: number;
  fromLayer: LayerIndex;
  toLayer: LayerIndex;
  fromPosition: Position;
  toPosition: Position;
  trigger: 'user_drag' | 'auto_snap' | 'layer_realignment' | 'validation_fix';
  isValid: boolean;
}

/**
 * 층위 경계 정의
 */
export interface LayerBoundary {
  layerType: LayerType;
  layerIndex: LayerIndex;
  yMin: number;
  yMax: number;
  height: number;
  isVisible: boolean;
  color: string;
  opacity: number;
}

/**
 * 층위 시스템 상태
 */
export interface LayerSystemState {
  boundaries: LayerBoundary[];
  snapEnabled: boolean;
  autoRealignEnabled: boolean;
  validationEnabled: boolean;
  showLayerGuides: boolean;
  layerHeight: number; // 각 층위의 기본 높이
  layerGap: number; // 층위 간 간격
  totalHeight: number; // 전체 시스템 높이
}

/**
 * 층위 유효성 검사 결과
 */
export interface LayerValidationResult {
  isValid: boolean;
  violations: LayerViolation[];
  suggestions: LayerSuggestion[];
  affectedNotes: string[]; // 영향받는 노트 ID들
  canAutoFix: boolean;
}

/**
 * 층위 규칙 위반 정보
 */
export interface LayerViolation {
  type: 'wrong_layer' | 'layer_overflow' | 'logical_inconsistency';
  noteId: string;
  currentLayer: LayerIndex;
  expectedLayer: LayerIndex;
  severity: 'low' | 'medium' | 'high';
  message: string;
  autoFixable: boolean;
}

/**
 * 층위 개선 제안
 */
export interface LayerSuggestion {
  type: 'move_note' | 'merge_layers' | 'split_content' | 'clarify_relationship';
  noteId?: string;
  targetLayer?: LayerIndex;
  reasoning: string;
  confidence: number; // 0-1
  implementation: 'automatic' | 'user_confirmation' | 'manual_only';
}

/**
 * 층위 관리 액션 타입
 */
export interface LayerManagementActions {
  // 기본 층위 작업
  moveToLayer: (noteId: string, targetLayer: LayerIndex) => void;
  snapToNearestLayer: (noteId: string) => void;
  realignAllLayers: () => void;

  // 유효성 검사
  validateLayerIntegrity: () => LayerValidationResult;
  autoFixViolations: (violations: LayerViolation[]) => void;

  // 시각적 피드백
  highlightLayerViolations: (violations: LayerViolation[]) => void;
  showLayerBoundaries: (visible: boolean) => void;

  // 설정 관리
  updateLayerConfig: (config: Partial<LayerSystemState>) => void;
  setLayerLockLevel: (noteId: string, lockLevel: LayerLockLevel) => void;
}

/**
 * 드래그 앤 드롭 제약 조건
 */
export interface DragConstraints {
  enableLayerConstraints: boolean;
  allowCrossLayerDrag: boolean;
  snapToLayerBoundary: boolean;
  showDropZones: boolean;
  dropZoneOpacity: number;
  feedbackLevel: 'none' | 'subtle' | 'clear' | 'strong';
}

/**
 * 층위 시각화 옵션
 */
export interface LayerVisualizationOptions {
  showLayerLabels: boolean;
  showLayerBoundaries: boolean;
  showLayerIcons: boolean;
  layerOpacity: number;
  boundaryLineStyle: 'solid' | 'dashed' | 'dotted';
  boundaryLineWidth: number;
  labelPosition: 'left' | 'right' | 'top' | 'bottom';
  animateTransitions: boolean;
  transitionDuration: number; // ms
}

/**
 * 자동 정렬 알고리즘 옵션
 */
export interface AutoAlignmentOptions {
  algorithm: 'content_based' | 'position_based' | 'hybrid';
  confidence_threshold: number; // 0-1, 자동 정렬 실행을 위한 최소 신뢰도
  preserve_user_positioning: boolean; // 사용자 위치 조정 유지 여부
  gentle_suggestions: boolean; // 강제 이동 대신 제안만 표시
}

/**
 * 층위 메트릭스 (분석 및 최적화용)
 */
export interface LayerMetrics {
  distribution: {
    [K in LayerType]: {
      count: number;
      percentage: number;
      avgPosition: Position;
      spread: number; // 분산도
    };
  };
  violations: {
    total: number;
    byType: { [key: string]: number };
    bySeverity: { [key: string]: number };
  };
  userBehavior: {
    totalMoves: number;
    crossLayerMoves: number;
    snapUsage: number;
    autoFixAcceptance: number;
  };
  performance: {
    lastValidationTime: number; // ms
    avgValidationTime: number; // ms
    memoryUsage: number; // bytes
  };
}

/**
 * 컨텍스트 메뉴 층위 관련 액션
 */
export interface LayerContextActions {
  moveToSpecificLayer: (targetLayer: LayerType) => void;
  lockToCurrentLayer: () => void;
  unlockLayer: () => void;
  analyzeLayerFit: () => void; // AI 기반 층위 적합성 분석
  showLayerHistory: () => void;
}

/**
 * 백엔드 동기화를 위한 층위 이벤트
 */
export interface LayerEvent {
  id: string;
  type: 'note_moved' | 'layer_validated' | 'violation_detected' | 'auto_fix_applied';
  timestamp: number;
  noteId?: string;
  data: unknown;
  userId?: string;
}

/**
 * 실시간 협업을 위한 층위 상태 동기화
 */
export interface LayerSyncState {
  version: number;
  lastUpdate: number;
  conflicts: LayerConflict[];
  pendingChanges: LayerEvent[];
}

/**
 * 층위 충돌 정보 (다중 사용자 환경)
 */
export interface LayerConflict {
  id: string;
  type: 'concurrent_move' | 'layer_config_change' | 'validation_mismatch';
  noteId: string;
  conflictingUsers: string[];
  resolutionStrategy: 'last_writer_wins' | 'merge' | 'user_decision';
  timestamp: number;
}

export default {
  LAYER_CONFIG,
} as const;
