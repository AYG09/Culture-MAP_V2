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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Edge 색상 (style에서 가져오거나 기본값)
  const strokeColor = (style?.stroke as string) ?? '#888';
  
  // 점선 여부 (indirect relation)
  const isIndirect = data?.relationType === 'indirect';
  const strokeDasharray = isIndirect ? '5 5' : undefined;
  
  // 🔥 DEBUG: relationType 확인
  console.log('🔗 [AnimatedFlowEdge] render:', { id, dataRelationType: data?.relationType, styleStrokeDasharray: style?.strokeDasharray, finalStrokeDasharray: strokeDasharray });

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
