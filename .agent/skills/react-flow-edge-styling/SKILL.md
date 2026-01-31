# React Flow Edge Styling Skill

## 개요
React Flow에서 edge 스타일(실선/점선)을 제어할 때 발생할 수 있는 함정과 올바른 패턴

## 🚨 문제 상황

### 증상
- `strokeDasharray`를 설정했는데 edge가 항상 점선으로 표시됨
- 데이터는 올바르게 저장되지만 화면에 반영되지 않음
- `relationType: 'direct'`인데도 점선으로 렌더링됨

### 근본 원인
**React Flow의 `animated` 속성이 CSS 기반 점선 애니메이션을 적용**하여 사용자의 `strokeDasharray` 설정을 덮어씁니다.

```typescript
// ❌ 잘못된 패턴 - animated가 strokeDasharray를 덮어씀
{
  id: connection.id,
  type: 'animatedFlow',
  animated: true,  // 🔴 이것이 CSS 점선 애니메이션 적용!
  style: {
    strokeDasharray: undefined,  // 무시됨
  },
}
```

React Flow 내부적으로 `animated: true`이면:
- `.react-flow__edge-animated` 클래스가 추가됨
- CSS에서 `stroke-dasharray` 애니메이션이 적용됨
- 사용자의 `style.strokeDasharray` 설정이 무시됨

## ✅ 올바른 패턴

### 1. animated 속성 제거
커스텀 edge 컴포넌트에서 자체 애니메이션(animateMotion 등)을 사용한다면 `animated` 속성을 제거합니다.

```typescript
// ✅ 올바른 패턴
export const convertConnectionToFlowEdge = (connection: ConnectionData): Edge => {
  return {
    id: connection.id,
    source: connection.sourceId,
    target: connection.targetId,
    type: 'animatedFlow',
    // animated 속성 제거! React Flow의 CSS 애니메이션 비활성화
    style: {
      strokeWidth: 2,
      stroke: edgeColor,
      strokeDasharray: connection.relationType === 'indirect' ? '5 5' : undefined,
    },
    data: {
      relationType: connection.relationType,
    },
  };
};
```

### 2. 커스텀 Edge 컴포넌트에서 스타일 제어
```tsx
// AnimatedFlowEdge.tsx
function AnimatedFlowEdge({ id, style, data, ...props }: EdgeProps) {
  // data.relationType을 기반으로 strokeDasharray 결정
  const isIndirect = data?.relationType === 'indirect';
  const strokeDasharray = isIndirect ? '5 5' : undefined;

  return (
    <BaseEdge 
      id={id} 
      style={{
        ...style,
        strokeDasharray,  // data 기반으로 덮어쓰기
      }}
      {...props}
    />
  );
}
```

### 3. 자체 애니메이션 구현
SVG `animateMotion`으로 원(dot) 이동 애니메이션 구현:
```tsx
<circle r="4" fill={strokeColor}>
  <animateMotion
    dur="2s"
    repeatCount="indefinite"
    path={edgePath}
  />
</circle>
```

## 🔍 디버깅 체크리스트

1. **Edge 데이터 확인**
   - Liveblocks에서 `relationType` 올바르게 저장되는지
   - `mapLiveblocksConnectionToConnectionData`에서 올바르게 매핑되는지

2. **변환 함수 확인**
   - `convertConnectionToFlowEdge`에서 `animated` 속성 있는지
   - `style.strokeDasharray` 올바르게 설정되는지
   - `data.relationType` 전달되는지

3. **Edge 컴포넌트 확인**
   - `data.relationType` 기반으로 `strokeDasharray` 계산하는지
   - `BaseEdge`의 `style`에 올바르게 전달하는지

4. **콘솔 로그 확인**
   ```typescript
   console.log('🔗 [AnimatedFlowEdge] render:', { 
     id, 
     dataRelationType: data?.relationType, 
     styleStrokeDasharray: style?.strokeDasharray, 
     finalStrokeDasharray: strokeDasharray 
   });
   ```

## 📁 관련 파일
- `src/utils/flowDataConverter.ts` - Edge 변환 함수
- `src/components/edges/AnimatedFlowEdge.tsx` - 커스텀 Edge 컴포넌트
- `src/services/LiveblocksService.ts` - 연결선 저장/로드

## 🏷️ 태그
`react-flow`, `edge`, `animated`, `strokeDasharray`, `styling`, `css-override`
