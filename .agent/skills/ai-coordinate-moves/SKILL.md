---
name: 좌표 기반 노드 이동 규칙
description: 좌표 정보를 컨텍스트에 노출하고 update_node(x,y)로 정밀 배치
lastUpdated: 2026-01-18
source: Culture-MAP V2 구현 결정
applies_to: @xyflow/react, Culture-MAP V2, Function Calling
---

# 좌표 기반 노드 이동 규칙

노드를 특정 위치로 이동해야 할 때 `update_node`에 좌표를 포함한다.

## 핵심 규칙
- 컨텍스트에 노드 좌표를 포함해 좌표 이동이 가능한 상태를 제공
- `update_node`에 `x`, `y`를 함께 전달
- 필요한 경우 `auto_layout`으로 전체 정렬

## ✅ 올바른 예시 (DO)
- 요청: "노드 X를 (900, 420)로 옮겨줘"
- 처리: update_node(id:"노드X_ID", x:900, y:420) → auto_layout()

## ❌ 잘못된 예시 (DON'T)
- 좌표 없이 "옮겨줘"만 수행
- x/y 중 하나만 전달하여 의도와 다르게 이동

## 적용 체크리스트
- [ ] 컨텍스트에 좌표가 제공되는가?
- [ ] update_node에 x/y를 포함했는가?
- [ ] 필요 시 auto_layout을 호출했는가?
