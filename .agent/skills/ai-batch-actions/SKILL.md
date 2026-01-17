---
name: 배치 노드+연결 생성 규칙
description: Gemini Function Calling에서 노드와 연결선을 단일 호출로 생성하는 패턴
lastUpdated: 2026-01-18
source: Culture-MAP V2 구현 결정
applies_to: @google/genai, Culture-MAP V2, Function Calling
---

# 배치 노드+연결 생성 규칙

노드와 연결을 동시에 요청받을 때 `add_nodes_with_connections`를 사용해 **단일 호출**로 처리한다.

## 핵심 규칙
- 노드/연결 동시 요청 시 **add_nodes_with_connections** 우선 사용
- 노드 배열에 `tempId`를 부여하고, 연결은 `sourceId/targetId`에 `tempId`를 참조
- 배치 생성 후 `auto_layout` 호출로 정렬
- 연결 방향은 상위→하위(원인→결과) 유지

## ✅ 올바른 예시 (DO)
- 요청: "A, B, C 노드 만들고 A-B, B-C 연결해줘"
- 처리:
  - add_nodes_with_connections(nodes:[{tempId:"A", ...},{tempId:"B", ...},{tempId:"C", ...}], connections:[{sourceId:"A", targetId:"B"},{sourceId:"B", targetId:"C"}])
  - auto_layout()

## ❌ 잘못된 예시 (DON'T)
- 노드만 만들고 연결선 생성 누락
- create_connection을 노드 생성 전에 호출
- 연결 방향 반대로 지정 (하위→상위)

## 적용 체크리스트
- [ ] 다중 노드+연결 요청을 단일 호출로 처리했는가?
- [ ] nodes에 tempId가 있고 connections에서 참조하는가?
- [ ] auto_layout을 후속 호출하는가?
- [ ] 상위→하위 방향을 지켰는가?
