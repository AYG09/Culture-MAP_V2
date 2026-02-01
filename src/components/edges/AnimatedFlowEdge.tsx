// src/components/edges/AnimatedFlowEdge.tsx
import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react';

/**
 * 애니메이션 Edge 컴포넌트
 * - SVG animateMotion을 사용하여 원(dot)이 source에서 target으로 이동
 * - 기존 stroke-dasharray 애니메이션보다 성능 우수
 * - getBezierPath로 부드러운 곡선 구현
 */
export interface AnimatedFlowEdgeData extends Record<string, unknown> {
  relationType?: 'direct' | 'indirect';
  isPositive?: boolean;
  bundleIndex?: number;
  bundleSize?: number;
}

export type AnimatedFlowEdge = Edge<AnimatedFlowEdgeData, 'animatedFlow'>;

function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<AnimatedFlowEdge>) {
  const bundleSize = typeof data?.bundleSize === 'number' ? data.bundleSize : 0;
  const bundleIndex = typeof data?.bundleIndex === 'number' ? data.bundleIndex : 0;
  const hasBundle = bundleSize > 1;
  const centerOffset = hasBundle ? bundleIndex - (bundleSize - 1) / 2 : 0;
  const bundleGap = 10;

  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const isHorizontalDominant = Math.abs(deltaX) >= Math.abs(deltaY);
  const offset = centerOffset * bundleGap;

  const adjustedSourceX = isHorizontalDominant ? sourceX : sourceX + offset;
  const adjustedSourceY = isHorizontalDominant ? sourceY + offset : sourceY;
  const adjustedTargetX = isHorizontalDominant ? targetX : targetX + offset;
  const adjustedTargetY = isHorizontalDominant ? targetY + offset : targetY;

  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition,
  });

  // Edge 색상 (style에서 가져오거나 기본값)
  const strokeColor = (style?.stroke as string) ?? '#888';
  
  // 점선 여부 (indirect relation)
  const isIndirect = data?.relationType === 'indirect';
  const strokeDasharray = isIndirect ? '5 5' : undefined;

  return (
    <>
      {/* 기본 Edge 라인 */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={{
          ...style,
          strokeDasharray,
        }}
        markerEnd={markerEnd}
      />
      
      {/* 이동하는 화살표 원 - 선-후 관계 시각화 */}
      <circle r="4" fill={strokeColor}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
      
      {/* 두 번째 원 (시차를 두고 이동) */}
      <circle r="3" fill={strokeColor} opacity="0.6">
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={edgePath}
          begin="1s"
        />
      </circle>
    </>
  );
}

export default memo(AnimatedFlowEdge);
