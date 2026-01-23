// src/hooks/useLayerSystem.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  LayerType,
  LayerIndex,
  EnhancedNoteData,
  LayerSystemState,
  LayerValidationResult,
  LayerViolation,
  LayerSuggestion,
  LayerBoundary,
  LayerMovementRecord,
  LayerLockLevel,
  LayerMetrics,
  DragConstraints,
  LayerVisualizationOptions,
} from '../types/layerSystem';
import { LAYER_CONFIG } from '../types/layerSystem';
import type { Position } from '../types';

/**
 * 층위 시스템 관리 훅
 * 4개 층위의 동적 관리, 데이터 무결성 보장, 시각적 피드백 제공
 */
export const useLayerSystem = (
  notes: EnhancedNoteData[],
  setNotes: React.Dispatch<React.SetStateAction<EnhancedNoteData[]>>,
  containerHeight = 800
) => {
  // 층위 시스템 상태
  const [layerState, setLayerState] = useState<LayerSystemState>(() => {
    const layerHeight = Math.floor(containerHeight / 4) - 20; // 20px 간격
    return {
      boundaries: Object.entries(LAYER_CONFIG).map(([type, config]) => ({
        layerType: type as LayerType,
        layerIndex: config.index,
        yMin: config.index * (layerHeight + 20),
        yMax: (config.index + 1) * (layerHeight + 20) - 20,
        height: layerHeight,
        isVisible: true,
        color: config.color,
        opacity: 0.1,
      })),
      snapEnabled: true,
      autoRealignEnabled: true,
      validationEnabled: true,
      showLayerGuides: true,
      layerHeight,
      layerGap: 20,
      totalHeight: containerHeight,
    };
  });

  // 드래그 제약 조건
  const [dragConstraints, setDragConstraints] = useState<DragConstraints>({
    enableLayerConstraints: true,
    allowCrossLayerDrag: true,
    snapToLayerBoundary: true,
    showDropZones: true,
    dropZoneOpacity: 0.3,
    feedbackLevel: 'clear',
  });

  // 시각화 옵션
  const [visualizationOptions, setVisualizationOptions] = useState<LayerVisualizationOptions>({
    showLayerLabels: true,
    showLayerBoundaries: true,
    showLayerIcons: true,
    layerOpacity: 0.1,
    boundaryLineStyle: 'dashed',
    boundaryLineWidth: 2,
    labelPosition: 'left',
    animateTransitions: true,
    transitionDuration: 300,
  });

  // 유효성 검사 결과
  const [validationResult, setValidationResult] = useState<LayerValidationResult>({
    isValid: true,
    violations: [],
    suggestions: [],
    affectedNotes: [],
    canAutoFix: false,
  });

  // 메트릭스
  const [metrics, setMetrics] = useState<LayerMetrics>({
    distribution: {
      결과: { count: 0, percentage: 0, avgPosition: { x: 0, y: 0 }, spread: 0 },
      행동: { count: 0, percentage: 0, avgPosition: { x: 0, y: 0 }, spread: 0 },
      유형_레버: { count: 0, percentage: 0, avgPosition: { x: 0, y: 0 }, spread: 0 },
      무형_레버: { count: 0, percentage: 0, avgPosition: { x: 0, y: 0 }, spread: 0 },
    },
    violations: { total: 0, byType: {}, bySeverity: {} },
    userBehavior: { totalMoves: 0, crossLayerMoves: 0, snapUsage: 0, autoFixAcceptance: 0 },
    performance: { lastValidationTime: 0, avgValidationTime: 0, memoryUsage: 0 },
  });

  // 성능 최적화를 위한 참조
  const lastValidationTime = useRef<number>(0);
  const validationTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());

  /**
   * 층위 경계 정보 가져오기
   */
  const getLayerBoundary = useCallback(
    (layerIndex: LayerIndex): LayerBoundary | undefined => {
      return layerState.boundaries.find(b => b.layerIndex === layerIndex);
    },
    [layerState.boundaries]
  );

  /**
   * 위치 기반 층위 감지
   */
  const detectLayerFromPosition = useCallback(
    (position: Position): LayerIndex => {
      for (const boundary of layerState.boundaries) {
        if (position.y >= boundary.yMin && position.y <= boundary.yMax) {
          return boundary.layerIndex;
        }
      }
      // 범위를 벗어난 경우 가장 가까운 층위 반환
      if (position.y < layerState.boundaries[0].yMin) return 0;
      return 3; // 최하위 층위
    },
    [layerState.boundaries]
  );

  /**
   * 노트를 특정 층위로 이동
   */
  const moveToLayer = useCallback(
    async (
      noteId: string,
      targetLayer: LayerIndex,
      trigger: LayerMovementRecord['trigger'] = 'user_drag'
    ) => {
      const note = notes.find(n => n.id === noteId);
      if (!note) return false;

      const targetBoundary = getLayerBoundary(targetLayer);
      if (!targetBoundary) return false;

      const currentTime = Date.now();
      const movementRecord: LayerMovementRecord = {
        timestamp: currentTime,
        fromLayer: note.layerIndex,
        toLayer: targetLayer,
        fromPosition: note.position,
        toPosition: {
          ...note.position,
          y: targetBoundary.yMin + targetBoundary.height / 2, // 층위 중앙으로 이동
        },
        trigger,
        isValid: true,
      };

      // 층위 잠금 검사
      if (note.layerLockLevel === 'locked') {
        console.warn(`노트 ${noteId}는 층위가 잠겨있어 이동할 수 없습니다.`);
        return false;
      }

      if (note.layerLockLevel === 'hard' && note.layerIndex !== targetLayer) {
        console.warn(`노트 ${noteId}는 하드 잠금 상태로 다른 층위로 이동할 수 없습니다.`);
        return false;
      }

      // 노트 업데이트
      setNotes(prevNotes =>
        prevNotes.map(n =>
          n.id === noteId
            ? {
                ...n,
                type: Object.keys(LAYER_CONFIG)[targetLayer] as LayerType,
                layerIndex: targetLayer,
                position: movementRecord.toPosition,
                movementHistory: [...(n.movementHistory || []), movementRecord],
                lastLayerValidation: currentTime,
                isOutOfLayer: false,
                warningLevel: 'none',
                constraintBounds: {
                  minY: targetBoundary.yMin,
                  maxY: targetBoundary.yMax,
                },
              }
            : n
        )
      );

      // 메트릭스 업데이트
      setMetrics(prev => ({
        ...prev,
        userBehavior: {
          ...prev.userBehavior,
          totalMoves: prev.userBehavior.totalMoves + 1,
          crossLayerMoves:
            note.layerIndex !== targetLayer
              ? prev.userBehavior.crossLayerMoves + 1
              : prev.userBehavior.crossLayerMoves,
        },
      }));

      return true;
    },
    [notes, setNotes, getLayerBoundary]
  );

  /**
   * 가장 가까운 층위로 스냅
   */
  const snapToNearestLayer = useCallback(
    (noteId: string) => {
      const note = notes.find(n => n.id === noteId);
      if (!note) return false;

      const detectedLayer = detectLayerFromPosition(note.position);

      // 이미 올바른 층위에 있는 경우
      if (note.layerIndex === detectedLayer) {
        return true;
      }

      return moveToLayer(noteId, detectedLayer, 'auto_snap');
    },
    [notes, detectLayerFromPosition, moveToLayer]
  );

  /**
   * 모든 층위 재정렬
   */
  const realignAllLayers = useCallback(async () => {
    let fixCount = 0;

    for (const note of notes) {
      const expectedLayer = detectLayerFromPosition(note.position);
      if (note.layerIndex !== expectedLayer) {
        const success = await moveToLayer(note.id, expectedLayer, 'layer_realignment');
        if (success) fixCount++;
      }
    }

    console.log(`${fixCount}개 노트의 층위를 재정렬했습니다.`);
    return fixCount;
  }, [notes, detectLayerFromPosition, moveToLayer]);

  /**
   * 층위 무결성 유효성 검사
   */
  const validateLayerIntegrity = useCallback((): LayerValidationResult => {
    const startTime = Date.now();
    const violations: LayerViolation[] = [];
    const suggestions: LayerSuggestion[] = [];
    const affectedNotes: string[] = [];

    for (const note of notes) {
      const expectedLayer = detectLayerFromPosition(note.position);

      // 잘못된 층위 위치 감지
      if (note.layerIndex !== expectedLayer) {
        const violation: LayerViolation = {
          type: 'wrong_layer',
          noteId: note.id,
          currentLayer: note.layerIndex,
          expectedLayer,
          severity: note.layerLockLevel === 'locked' ? 'high' : 'medium',
          message: `포스트잇이 ${LAYER_CONFIG[Object.keys(LAYER_CONFIG)[expectedLayer] as LayerType].label} 영역에 있지만 ${LAYER_CONFIG[note.type].label}로 분류되어 있습니다.`,
          autoFixable: note.layerLockLevel !== 'locked',
        };

        violations.push(violation);
        affectedNotes.push(note.id);

        // 자동 수정 제안
        if (violation.autoFixable) {
          suggestions.push({
            type: 'move_note',
            noteId: note.id,
            targetLayer: expectedLayer,
            reasoning: `위치 기반으로 적절한 층위로 이동을 제안합니다.`,
            confidence: 0.8,
            implementation: 'automatic',
          });
        }
      }

      // 층위 범위 초과 감지
      const boundary = getLayerBoundary(note.layerIndex);
      if (boundary && (note.position.y < boundary.yMin || note.position.y > boundary.yMax)) {
        violations.push({
          type: 'layer_overflow',
          noteId: note.id,
          currentLayer: note.layerIndex,
          expectedLayer: expectedLayer,
          severity: 'low',
          message: `포스트잇이 할당된 층위 경계를 벗어났습니다.`,
          autoFixable: true,
        });

        affectedNotes.push(note.id);
      }
    }

    const validationTime = Date.now() - startTime;
    lastValidationTime.current = validationTime;

    const result: LayerValidationResult = {
      isValid: violations.length === 0,
      violations,
      suggestions,
      affectedNotes: [...new Set(affectedNotes)], // 중복 제거
      canAutoFix: suggestions.some(s => s.implementation === 'automatic'),
    };

    setValidationResult(result);

    // 메트릭스 업데이트
    setMetrics(prev => ({
      ...prev,
      violations: {
        total: violations.length,
        byType: violations.reduce(
          (acc, v) => ({ ...acc, [v.type]: (acc[v.type] || 0) + 1 }),
          {} as Record<string, number>
        ),
        bySeverity: violations.reduce(
          (acc, v) => ({ ...acc, [v.severity]: (acc[v.severity] || 0) + 1 }),
          {} as Record<string, number>
        ),
      },
      performance: {
        ...prev.performance,
        lastValidationTime: validationTime,
        avgValidationTime: (prev.performance.avgValidationTime + validationTime) / 2,
      },
    }));

    return result;
  }, [notes, detectLayerFromPosition, getLayerBoundary]);

  /**
   * 위반 사항 자동 수정
   */
  const autoFixViolations = useCallback(
    async (violations: LayerViolation[]) => {
      let fixedCount = 0;

      for (const violation of violations) {
        if (violation.autoFixable && violation.type === 'wrong_layer') {
          const success = await moveToLayer(
            violation.noteId,
            violation.expectedLayer,
            'validation_fix'
          );
          if (success) {
            fixedCount++;

            // 자동 수정 수용 메트릭스 업데이트
            setMetrics(prev => ({
              ...prev,
              userBehavior: {
                ...prev.userBehavior,
                autoFixAcceptance: prev.userBehavior.autoFixAcceptance + 1,
              },
            }));
          }
        }
      }

      console.log(`${fixedCount}개 위반 사항을 자동 수정했습니다.`);

      // 수정 후 재검증
      setTimeout(() => validateLayerIntegrity(), 100);

      return fixedCount;
    },
    [moveToLayer, validateLayerIntegrity]
  );

  /**
   * 노트 층위 잠금 수준 설정
   */
  const setLayerLockLevel = useCallback(
    (noteId: string, lockLevel: LayerLockLevel) => {
      setNotes(prevNotes =>
        prevNotes.map(note => (note.id === noteId ? { ...note, layerLockLevel: lockLevel } : note))
      );
    },
    [setNotes]
  );

  /**
   * 드래그 시 실시간 유효성 검사 (디바운스)
   */
  const validateOnDrag = useCallback(
    (noteId: string, newPosition: Position) => {
      // 기존 타임아웃 제거
      validationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      validationTimeouts.current.clear();

      // 디바운스 적용 (300ms)
      const timeout = setTimeout(() => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        const expectedLayer = detectLayerFromPosition(newPosition);
        const isOutOfLayer = note.layerIndex !== expectedLayer;

        // 실시간 경고 상태 업데이트
        setNotes(prevNotes =>
          prevNotes.map(n =>
            n.id === noteId
              ? {
                  ...n,
                  isOutOfLayer,
                  warningLevel: isOutOfLayer
                    ? note.layerLockLevel === 'hard'
                      ? 'error'
                      : 'warning'
                    : 'none',
                }
              : n
          )
        );
      }, 300);

      validationTimeouts.current.add(timeout);
    },
    [notes, detectLayerFromPosition, setNotes]
  );

  /**
   * 층위 배치 시각화 업데이트
   */
  const updateLayerBoundaries = useCallback((newHeight: number) => {
    const layerHeight = Math.floor(newHeight / 4) - 20;

    setLayerState(prev => ({
      ...prev,
      boundaries: prev.boundaries.map(boundary => ({
        ...boundary,
        yMin: boundary.layerIndex * (layerHeight + 20),
        yMax: (boundary.layerIndex + 1) * (layerHeight + 20) - 20,
        height: layerHeight,
      })),
      layerHeight,
      totalHeight: newHeight,
    }));
  }, []);

  /**
   * 분포 분석 및 메트릭스 계산
   */
  const updateMetrics = useCallback(() => {
    const distribution = notes.reduce(
      (acc, note) => {
        const layer = note.type;
        if (!acc[layer]) {
          acc[layer] = { notes: [], positions: [] };
        }
        acc[layer].notes.push(note);
        acc[layer].positions.push(note.position);
        return acc;
      },
      {} as Record<LayerType, { notes: EnhancedNoteData[]; positions: Position[] }>
    );

    const totalNotes = notes.length;

    const newDistribution = Object.entries(LAYER_CONFIG).reduce(
      (acc, [type]) => {
        const layerNotes = distribution[type as LayerType]?.notes || [];
        const positions = distribution[type as LayerType]?.positions || [];

        const avgPosition =
          positions.length > 0
            ? {
                x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
                y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
              }
            : { x: 0, y: 0 };

        const spread =
          positions.length > 1
            ? Math.sqrt(
                positions.reduce(
                  (sum, p) =>
                    sum + Math.pow(p.x - avgPosition.x, 2) + Math.pow(p.y - avgPosition.y, 2),
                  0
                ) / positions.length
              )
            : 0;

        acc[type as LayerType] = {
          count: layerNotes.length,
          percentage: totalNotes > 0 ? (layerNotes.length / totalNotes) * 100 : 0,
          avgPosition,
          spread,
        };

        return acc;
      },
      {} as LayerMetrics['distribution']
    );

    setMetrics(prev => ({
      ...prev,
      distribution: newDistribution,
    }));
  }, [notes]);

  // 자동 유효성 검사 (노트 변경 시)
  useEffect(() => {
    if (layerState.validationEnabled && notes.length > 0) {
      const timeout = setTimeout(() => {
        validateLayerIntegrity();
        updateMetrics();
      }, 500);

      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, layerState.validationEnabled]);

  // 컨테이너 크기 변경 시 층위 경계 업데이트
  useEffect(() => {
    updateLayerBoundaries(containerHeight);
  }, [containerHeight, updateLayerBoundaries]);

  // 정리
  useEffect(() => {
    const timeouts = validationTimeouts.current;
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  return {
    // 상태
    layerState,
    dragConstraints,
    visualizationOptions,
    validationResult,
    metrics,

    // 핵심 기능
    moveToLayer,
    snapToNearestLayer,
    realignAllLayers,
    validateLayerIntegrity,
    autoFixViolations,
    setLayerLockLevel,

    // 유틸리티
    getLayerBoundary,
    detectLayerFromPosition,
    validateOnDrag,
    updateLayerBoundaries,

    // 설정
    setDragConstraints,
    setVisualizationOptions,
    setLayerState,
  };
};
