# Implementation Plan: auto_layout 비정상 종료 및 레이어 이탈 보정

## 목표
1. auto_layout 수행 중 레이아웃 결과 불일치로 중단되는 현상 해소
2. ELK 레이아웃 결과가 누락될 경우 기본 레이아웃으로 안전하게 대체
3. 레이어 이탈을 방지하고 동일 레이어 순서를 유지

---

## 핵심 변경 범위

### 1) auto_layout fallback 보강
- ELK 결과 노드 수 불일치 시 기본 레이아웃으로 대체
- safeAutoLayout에서 fallback 후에도 불일치면 중단

### 2) auto_layout 중복/타입 정규화
- safeAutoLayout에서 노드 id dedupe 후 레이아웃 수행
- 기본 레이아웃에서 알 수 없는 타입을 기본 레이어로 정규화

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| ELK 결과 불안정 지속 | 정렬 품질 저하 | 기본 레이아웃으로 안정성 확보 |
| fallback 과다 | 성능 저하 가능 | 불일치 상황에서만 fallback 실행 |

---

## 롤백 계획

### 트리거 조건
- auto_layout 중단 로그가 지속되거나 정렬 품질이 악화

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/utils/flowAutoLayout.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. auto_layout 호출 시 중단 로그가 사라지는지 확인
2. 정렬 후 노드가 레이어 범위 내에 유지되는지 확인

---

# Implementation Plan: JSON 내보내기 중복 노드 제거

## 목표
1. JSON 내보내기 시 중복 node id 제거
2. 노드가 없는 edge는 제외
3. metadata의 nodeCount/edgeCount 정확화

---

## 핵심 변경 범위

### 1) ExportMenu JSON 내보내기 보정
- reactFlowInstance.getNodes() 결과 dedupe
- 유효 nodeId 기준으로 edge 필터링

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| dedupe로 일부 edge 제거 | 연결선 누락 | nodeId 유효성 기준으로만 필터링 |

---

## 검증 계획

### 수동 검증
1. JSON 내보내기 후 nodeCount가 고유 id 수와 일치
2. edgeCount가 실제 유효 연결선 수와 일치

---

# Implementation Plan: 레이어 라벨 툴팁 가림/정렬 레이어 이탈 수정

## 목표
1. 레이어 라벨 툴팁이 노드에 가려지지 않도록 표시 계층 분리
2. 자동 정렬 시 노드가 레이어 범위를 벗어나는 현상 방지
3. 동일 레이어 선후관계 정렬 로직을 auto_layout 경로에 적용

---

## 핵심 변경 범위

### 1) 툴팁 표시 계층 분리
- 배경 레이어와 라벨 레이어를 분리된 ViewportPortal로 렌더링
- 라벨/툴팁 z-index 상향 및 포인터 이벤트 분리

### 2) auto_layout 경로 보정
- 동일 레이어 edge가 존재할 때 basic 레이아웃 적용
- AI 일괄 생성 레이아웃 후 safeAutoLayout 재실행

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 라벨 클릭/드래그 이벤트 충돌 | UX 문제 | 라벨 컨테이너 pointerEvents 분리 |
| auto_layout 재실행 중복 | 성능 저하 | requestAnimationFrame으로 1회 재실행 |

---

## 롤백 계획

### 트리거 조건
- 라벨 툴팁 표시 불안정 또는 정렬 결과 악화

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/components/CultureMapFlow.css
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 툴팁이 노드에 가려지지 않고 항상 표시되는지 확인
2. 자동 정렬 후 노드가 레이어 범위 안에 유지되는지 확인
3. 동일 레이어 선후관계가 정렬에 반영되는지 확인

---

# Implementation Plan: 동일 레이어 선후관계 반영 정렬 개선

## 목표
1. 동일 층위 내 연결선의 선후관계 반영
2. 같은 레이어 내부 순서가 뒤섞이는 현상 최소화
3. 기존 레이어 높이/간격/앵커 로직 유지

---

## 핵심 변경 범위

### 1) 동일 레이어 위상 정렬
- 같은 레이어 간 edge(source/target 동일 레이어)만 추출
- Kahn 위상 정렬로 순서 산출
- tie-break는 anchorX, fallbackIndex 사용
- 사이클 발생 시 anchorX 기반으로 잔여 노드 정렬

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 사이클로 인한 불안정 순서 | 순서 흔들림 | anchorX 기반 fallback 정렬 적용 |
| 정렬 비용 증가 | 성능 저하 | 레이어별 O(n+e)로 제한 |

---

## 롤백 계획

### 트리거 조건
- 동일 레이어 정렬 결과가 악화되거나 성능 문제가 발생

### 롤백 절차
```bash
git checkout -- src/utils/flowAutoLayout.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 동일 레이어 연결에서 source→target 순서가 유지되는지 확인
2. 엣지 교차 및 역전이 줄었는지 확인

---

# Implementation Plan: 줌 확대 시 노드 사라짐 버그 수정

## 목표
1. 확대/축소 시 노드가 화면에서 사라지는 현상 해소
2. translateExtent가 노드 배치 범위를 항상 포함하도록 동적 계산
3. 성능 저하 없이 onlyRenderVisibleElements 유지

---

## 핵심 변경 범위

### 1) translateExtent 동적 확장
- 노드 bbox(minX/minY/maxX/maxY) 계산
- measured/width/height 우선 사용, fallback 크기 적용
- padding을 추가해 줌인 상태에서도 노드 포함 보장
- totalHeight 기반 세로 범위와 기존 여유값 유지

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| extent 계산 비용 증가 | 성능 저하 가능 | useMemo로 nodes/height 변경 시만 계산 |
| bbox 계산에 width/height 누락 | 범위 축소 가능 | measured/width/height fallback 적용 |

---

## 롤백 계획

### 트리거 조건
- 확대 시 노드 사라짐이 지속되거나 성능 저하 발생

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 확대/축소 시 노드가 화면에서 사라지지 않는지 확인
2. 가장자리 노드가 뷰포트 제한에 의해 사라지지 않는지 확인

---

# Implementation Plan: 컨텍스트 메뉴/노드 편집 UX 개선

## 목표
1. AI 생성 노드 수동 편집이 정상 반영되도록 핸들러 주입
2. 우클릭 메뉴가 화면 가장자리에서 잘리지 않도록 뷰포트 이동
3. 메뉴 라벨 단순화(결과/행동/유형/무형) 및 노드 유형 변경 기능 추가
4. 레이어 라벨 hover 설명 팝업 추가

---

## 핵심 변경 범위

### 1) AI 생성 노드 편집 핸들러 주입
- add_node/add_nodes_with_connections 생성 노드 data에 onUpdate/onEditStart/onEditEnd 추가
- 잠금 정보(isLocked/lockedBy) 기본값 유지

### 2) 컨텍스트 메뉴 뷰포트 이동
- 메뉴 크기 측정 후 화면 밖 영역이 있으면 setViewport로 캔버스 이동
- 메뉴 위치는 고정, 뷰포트만 이동

### 3) 메뉴 라벨/유형 변경
- 새 노드 생성 메뉴 라벨을 결과/행동/유형/무형으로 단순화
- 노드 우클릭 메뉴에 유형 변경(레이어 변경) 액션 추가

### 4) 레이어 라벨 hover 팝업
- ViewportPortal 레이어 라벨에 설명 툴팁 추가
- 기존 클릭 동작 유지

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 뷰포트 이동 시 사용자가 화면 이동으로 느끼는 혼란 | UX 혼란 가능 | 메뉴 오픈 시 1회 이동만 수행, 과도 이동 방지 |
| 유형 변경 시 Liveblocks 레이어 불일치 | 동기화 오류 | node.type과 layer를 동시에 업데이트 |

---

## 롤백 계획

### 트리거 조건
- 편집 반영 실패 지속 또는 메뉴 위치 이상

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/components/CultureMapFlow.css
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. AI 생성 노드 편집 반영 확인
2. 우클릭 메뉴가 화면 가장자리에서도 모두 보이는지 확인
3. 노드 유형 변경 시 레이어 이동 및 동기화 확인
4. 레이어 라벨 hover 팝업 표시 확인

---

# Implementation Plan: ExportMenu 상단 버튼 스타일 통일

## 목표
1. 상단 PNG/JSON/Excel 버튼을 흰색 글래스 스타일로 통일
2. 새로고침/재접속 이후에도 스타일 일관성 유지
3. 전역 디자인 덮어쓰기 방지

---

# Implementation Plan: AI 노드 위치/동기화 소실 방지

## 목표
1. AI 노드 생성 시 layer 기반 타입 보정으로 위치 불일치 제거
2. Liveblocks observe 이벤트 과다 발생 및 드래그 중 노드 소실 방지

---

## 핵심 변경 범위

### 1) AI 노드 타입 보정
- add_node/add_nodes_with_connections에서 type 누락 시 layer 기반 nodeType 선택
- 레이어 범위 1~4 보정 후 타입 매핑

### 2) Liveblocks observe 이벤트 필터링
- 로컬 단건 변경 시 notes-changed/ connections-changed emit 억제
- updateStickyNote 업데이트로 인한 삭제 이벤트는 실제 삭제일 때만 emit

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 로컬 단건 변경에서 전체 복원 미발생 | 일부 뷰 갱신 누락 가능 | sticky-note-updated/connection-updated 유지로 UI 갱신 보장 |
| 삭제 이벤트 필터 오탐 | 실제 삭제 누락 가능 | 현재 배열에 존재 여부로 필터링 |

---

## 롤백 계획

### 트리거 조건
- 드래그/편집 중 노드/연결 동기화 이상 지속

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/services/LiveblocksService.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. AI가 layer만 준 노드가 올바른 층위에 생성되는지 확인
2. 드래그 중 노드가 사라지지 않는지 확인
3. notes-changed/ connections-changed 로그 및 복원 호출 빈도 감소 확인

---

## 핵심 변경 범위

### 1) ExportMenu 버튼 클래스 통일
- ExportMenu 버튼에 `glass-button` 클래스를 추가하여 상단 UI와 일관성 유지

### 2) ExportMenu CSS 오버라이드 제거
- `.export-button`의 배경/테두리/색상/그림자 오버라이드를 제거
- 레이아웃/간격/disabled 처리만 유지

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| ExportMenu 버튼 시각적 식별 저하 | UX 혼란 가능 | 아이콘/텍스트 유지, `glass-button--accent` 필요 시 도입 | 

---

## 롤백 계획

### 트리거 조건
- 상단 내보내기 버튼이 식별 어려움

### 롤백 절차
```bash
git checkout -- src/components/ExportMenu.tsx
git checkout -- src/components/ExportMenu.css
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 새로고침/재접속 후 상단 PNG/JSON/Excel 버튼이 흰색 글래스 스타일인지 확인
2. 보고서 탭 진입 여부와 상관없이 스타일 유지 확인
3. 내보내기 버튼 동작 및 로딩 스피너 정상 확인

---

# Implementation Plan: 학술 파일 공유 목록 동기화 보강

## 목표
1. 로컬 저장소가 비어 있을 때 세션 공유 목록의 본인 메타데이터 자동 정리
2. 공유 목록에서 현재 접속 사용자 기준으로만 표시
3. 세션 종료 시 공유 메타데이터 잔존 최소화

---

## 핵심 변경 범위

### 1) 모달 오픈 시 정리
- 로컬 학술 파일이 0개인데 공유 목록에 본인 항목이 있으면 삭제(publishAcademicFiles([]))

### 2) 활성 사용자 기반 필터링
- Liveblocks presence로 현재 접속 사용자 ID를 수집
- 공유 목록 렌더링 시 activeUserIds 기준으로 필터링

### 3) 세션 종료 정리
- leaveSession 시 publishAcademicFiles([]) 호출

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 오프라인 사용자의 공유 목록 비표시 | 목록 혼란 가능 | 접속 사용자만 사용 가능한 구조임을 안내 문구 유지 |
| 세션 종료 타이밍 누락 | 스테일 항목 잔존 | 모달 오픈 시 추가 정리로 보완 |

---

## 롤백 계획

### 트리거 조건
- 공유 목록이 비어 있거나 접속 사용자도 표시되지 않음

### 롤백 절차
```bash
git checkout -- src/components/AIConfigModal.tsx
git checkout -- src/services/LiveblocksService.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 로컬 지식 파일 삭제/초기화 후 모달 오픈 시 공유 목록에서 본인 항목 제거 확인
2. 다른 사용자 접속 종료 후 공유 목록에서 해당 사용자 항목 숨김 확인
3. 세션 나가기 후 재입장 시 본인 스테일 항목 미표시 확인

---

# Implementation Plan: 미연결 업데이트 가드

## 목표
1. Liveblocks 미연결 상태에서 로컬만 변경되는 업데이트 차단
2. 데이터 유실 시나리오(브라우저 간 불일치, 재접속 후 소실) 방지

---

## 핵심 변경 범위

### 1) 연결 상태 가드
- 노드/연결선 생성·수정·삭제 진입점에서 `isConnected()` 확인
- 미연결이면 경고 후 작업 중단

### 2) 경고 스팸 방지
- 경고는 3초 쿨다운 적용

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 오프라인 편집 불가 | UX 저하 | 연결 복구 안내 및 최소 경고만 노출 |
| 잦은 경고 | 피로감 | 쿨다운 적용 |

---

## 롤백 계획

### 트리거 조건
- 정상 연결인데도 편집 불가 현상

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 연결 끊김 상태에서 노드/연결 변경 시 경고 후 중단되는지 확인
2. 연결 복구 후 정상 편집 가능한지 확인

---

# Implementation Plan: 새로고침 시 세션 자동 재접속

## 목표
1. 페이지 새로고침 시 마지막 세션으로 자동 재접속
2. 사용자가 명시적으로 나가기 버튼을 누르면 자동 재접속 해제

---

## 핵심 변경 범위

### 1) Gateway 초기화 로직
- 마지막 세션 코드(localStorage) 확인
- 자동 재접속 성공 시 게이트 스킵

### 2) 세션 저장/정리
- 세션 생성/입장 시 마지막 세션 저장
- 세션 나가기 시 저장값 제거

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 저장된 세션 코드가 만료됨 | 재접속 실패 | 실패 시 저장값 제거 후 목록 로드 |
| 의도치 않은 자동 재접속 | UX 혼란 | 나가기 시 저장값 삭제 |

---

## 롤백 계획

### 트리거 조건
- 재접속 시 루프 발생
- 세션 목록이 로드되지 않음

### 롤백 절차
```bash
git checkout -- src/components/Gateway.tsx
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 세션 입장 후 새로고침 시 자동 재접속 확인
2. 나가기 후 새로고침 시 게이트 화면 표시 확인

---

# Implementation Plan: Gateway TDZ 오류 수정

## 목표
1. Gateway 컴포넌트에서 발생하는 `Cannot access before initialization` 오류 제거
2. useEffect 의존성 배열과 useCallback 선언 순서를 일치시켜 TDZ 방지
---

- `handleDevModeAutoJoin`, `loadSessions` useCallback 선언을 useEffect보다 위로 이동
- useEffect 의존성 배열은 그대로 유지

### 2) 기존 로직 유지
- 게이트 초기화 흐름 및 세션 저장/복구 로직 변경 없음
---


| 리스크 | 영향 | 대응 |
|---|---|---|
| 의존성 배열 누락 | 상태 동기화 불일치 | 의존성 배열 변경 금지, 선언 순서만 조정 |
| 리팩토링으로 로직 변경 | 세션 자동 재접속 실패 | 선언 위치만 이동하고 로직 그대로 유지 |

---


### 트리거 조건
- Gateway 화면이 렌더링되지 않거나 세션 자동 재접속이 실패
### 롤백 절차
# Implementation Plan: 레이어 정렬 순서/높이 동기화

## 목표
1. auto_layout 시 레이어 순서를 무형→유형→행동→결과로 고정
2. 레이어 높이를 노드 분포에 맞춰 확장하여 하단 노드 누락 방지
---

## 목표
4. 로컬 스냅샷 저장/복원 및 Liveblocks 동기화

---

## 핵심 변경 범위
### 1) AI 도구 스키마 확장
- MAP_TOOL_DECLARATIONS에 뷰포트/UI/스타일/스냅샷 도구 추가
### 2) AI 시스템 지침 확장
- 도구 사용 규칙에 신규 액션 사용 조건 추가
- 허용 도구 목록 확장

### 3) Canvas 핸들러 확장
- executeAiAction에 신규 액션 분기 추가
- ReactFlowInstance 가드 적용

- FlowNodes.css 하드코딩 값을 CSS 변수로 교체
- CultureMapFlow에서 CSS 변수 주입

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| Liveblocks 복원 동기화 불일치 | 협업 상태 꼬임 | clearMapData 후 updateStickyNote/updateConnection 재삽입 |
| ReactFlow 인스턴스 미존재 | 런타임 오류 | 모든 뷰포트 제어에서 가드 처리 |
| 스타일 회귀 | UI 이질감 | CSS 변수에 기존 색상 fallback 유지 |

---

## 롤백 계획

### 트리거 조건
- AI 액션에서 뷰포트/스타일 변경 시 런타임 오류 발생

### 롤백 절차
```bash
git checkout -- src/types/actions.ts
git checkout -- src/services/AIService.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/components/flow-nodes/FlowNodes.css
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. AI 액션으로 줌/팬/포커스/전체보기 동작 확인
2. 레이어 투명도 및 배경/컨트롤/미니맵/내보내기 토글 확인
3. 스타일 변수 변경 시 노드/엣지 스타일 즉시 반영 확인
4. 스냅샷 저장/복원 후 노드/연결 및 뷰포트 복원 확인
3. 타입별 노드가 레이어 밴드 내에서만 이동하도록 보장

---

## 핵심 변경 범위

### 1) 레이아웃 유틸 순서 정렬
- flowAutoLayout 레이어 순서를 표시 순서로 고정
- layerHeights는 레이어 타입 인덱스 매핑으로 참조

### 2) auto_layout 후처리
- 레이어별 필요 높이 계산 후 layerHeights 확장
- 노드 Y를 레이어 밴드 중앙으로 스냅

### 3) 배경 레이어 렌더링 순서
- 무형→유형→행동→결과 순으로 배경 레이어 렌더링

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 레이어 높이 과도 확장 | 화면 스크롤 증가 | 필요 높이만 최소 확장 |
| 레이아웃 순서 불일치 | 노드-배경 오정렬 | 표시 순서와 동일한 누적 계산 적용 |

---

## 롤백 계획

### 트리거 조건
- auto_layout 후 노드가 레이어 밴드에서 벗어남
- 배경 레이어 순서/높이 불일치

### 롤백 절차
```bash
git checkout -- src/utils/flowAutoLayout.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. auto_layout 실행 후 레이어 순서가 무형→유형→행동→결과인지 확인
2. 하단 레이어 노드가 캡처/뷰포트에서 누락되지 않는지 확인
3. PNG 내보내기 결과에 모든 레이어가 포함되는지 확인

---
```bash
git checkout -- src/components/Gateway.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 앱 로드 직후 콘솔에 `Cannot access before initialization` 오류가 없는지 확인
2. 게이트 초기화/세션 목록 로드 정상 동작 확인

---

# Implementation Plan: Vercel index.html 캐시 무효화

## 목표
1. Vercel에서 오래된 번들이 계속 로드되는 문제를 방지
2. 새 배포 시 항상 최신 `index.html`이 제공되도록 캐시 정책 강화

---

## 핵심 변경 범위

### 1) Vercel 캐시 헤더 설정
- `/` 및 `/index.html`에 `Cache-Control: no-store, must-revalidate` 적용
- 해시된 정적 자산 캐시는 변경하지 않음

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| index.html 응답 캐시 미사용 | 초기 로드 시 약간의 오버헤드 | 정적 자산 캐시는 유지해 영향 최소화 |
| 배포 후에도 오류 지속 | 원인이 캐시가 아닐 가능성 | Vercel 재배포 후 재검증, 코드 레벨 추가 조사 |

---

## 롤백 계획

### 트리거 조건
- 캐시 정책 변경으로 응답 지연/오작동 발생

### 롤백 절차
```bash
git checkout -- vercel.json
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. Vercel 재배포 후 최신 번들 해시가 로드되는지 확인
2. 브라우저 콘솔에서 `Cannot access before initialization` 오류 재발 여부 확인

---

# Implementation Plan: 동기화 완료 후 IndexedDB 캐시 리셋

## 목표
1. Liveblocks 서버 동기화 완료 이후에만 브라우저 IndexedDB 캐시 초기화
2. 브라우저 간 캐시 불일치로 인한 구버전 노드/채팅 표시 방지

---

## 핵심 변경 범위

### 1) Liveblocks 동기화 이벤트 후처리
- `LiveblocksYjsProvider.on("sync")`로 서버 동기화 완료 감지
- 1회만 `IndexeddbPersistence.clearData()` 호출

### 2) 캐시 리셋 제어
- 세션 재접속 시 플래그 초기화
- 동기화 완료 후 반복 호출 방지

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 동기화 전에 캐시 삭제 | 데이터 유실 | sync 이벤트 이후에만 실행 |
| 반복 삭제 | 불필요한 IO | 플래그로 1회만 실행 |

---

## 롤백 계획

### 트리거 조건
- 동기화 완료 후에도 데이터 미표시
- 재접속 시 캐시 초기화 반복 호출

### 롤백 절차
```bash
git checkout -- src/services/LiveblocksService.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 크롬/엣지에서 동일 세션 접속 후 동일한 노드 상태 표시 확인
2. 새로고침 후에도 서버 최신 상태가 유지되는지 확인

---

# Implementation Plan: DEV-LOCAL 채팅 내역 초기화

## 목표
1. DEV-LOCAL 세션에서 채팅 내역을 즉시 초기화
2. Liveblocks 저장소(Yjs)와 AI 세션 히스토리를 동시에 리셋

---

## 핵심 변경 범위

### 1) Liveblocks 채팅 삭제
- `LiveblocksService.clearChatMessages()` 추가
- Yjs `chatMessages` 배열 전체 삭제

### 2) AI 세션 리셋
- `AIService.resetChatSession()` 추가
- `chatHistory`, `currentThoughts`, `chatSession` 초기화

### 3) UI 버튼
- DEV-LOCAL 세션에서만 보이는 “채팅 초기화” 버튼 추가
- 사용자 확인 후 실행

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 실수로 초기화 | 대화 기록 손실 | 확인 팝업으로 방지 |
| 비연결 상태 | 화면만 초기화 | 로컬 상태 초기화 + 다음 메시지부터 새 세션 |

---

## 롤백 계획

### 트리거 조건
- 채팅 초기화가 다른 세션까지 영향
- 초기화 후 메시지 전송 불가

### 롤백 절차
```bash
git checkout -- src/services/LiveblocksService.ts
git checkout -- src/services/AIService.ts
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- src/components/AIChatSidebar.css
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. DEV-LOCAL 접속 후 “채팅 초기화” 버튼 클릭 시 메시지가 모두 사라지는지 확인
2. 초기화 후 새 메시지 전송이 정상 동작하는지 확인

---

# Implementation Plan: 클립보드 이미지 붙여넣기 지원

## 목표
1. 채팅 입력창에서 스크린샷/클립보드 이미지를 붙여넣기 지원
2. 이미지 첨부 미리보기 및 제거 UI 제공
3. 업로드 실패/용량 제한은 기존 AIService 정책 재사용

---

## 핵심 변경 범위

### 1) 입력 붙여넣기 처리
- `onPaste`에서 image/* 감지 시 첨부로 등록
- 텍스트만 붙여넣기는 기존 동작 유지

### 2) 미리보기 UI
- 첨부 리스트에 이미지 썸네일 표시
- object URL 생성/해제로 메모리 누수 방지

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 대용량 이미지 첨부 | 업로드 실패 | AIService의 리사이즈/해상도 제한 로직 재사용 |
| object URL 누수 | 메모리 증가 | 첨부 변경 시 URL 해제 |

---

## 롤백 계획

### 트리거 조건
- 붙여넣기 시 입력이 막히는 문제
- 이미지 첨부 UI 오류

### 롤백 절차
```bash
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- src/components/AIChatSidebar.css
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 캡처 이미지 붙여넣기 시 첨부 생성 및 미리보기 표시
2. 텍스트만 붙여넣기는 정상 입력
3. 제거 버튼 클릭 시 첨부/미리보기 제거

---

# Implementation Plan: 이전 채팅 요약 + 토큰 예산 관리

## 목표
1. 이전 채팅 요약을 보고서 생성 프롬프트에 포함
2. Gemini 모델 input/output 토큰 한도를 동적으로 조회하여 요약 길이 예산화
3. 요약 실패 시 안전한 폴백 제공

---

## 핵심 변경 범위

### 1) 모델 토큰 한도 조회
- `@google/genai`의 `models.get`으로 `inputTokenLimit`/`outputTokenLimit` 조회
- 실패 시 보수적 기본값 사용 및 캐싱

### 2) 채팅 요약 유틸
- Liveblocks 채팅 메시지를 요약 프롬프트로 변환
- 입력 토큰 예산 내에서 최근 메시지 중심으로 축약
- 출력 길이(문자 수) 제한 및 실패 폴백 제공

### 3) 보고서 생성 컨텍스트 확장
- 기존 맵 데이터/인사이트에 “최근 채팅 요약” 섹션 추가
- 남은 입력 토큰의 일부만 요약에 할당

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 요약 입력이 길어 토큰 초과 | 보고서 생성 실패 | 모델 한도 조회 + 요약 예산 제한 + 메시지 축약 |
| 요약 생성 실패 | 요약 섹션 누락 | 폴백 요약(최근 메시지 발췌) 적용 |
| 대형 PDF 동시 사용 | 컨텍스트 과다 | PDF 1000페이지 제한 유지 + 요약은 텍스트만 사용 |

---

## 롤백 계획

### 트리거 조건
- 보고서 생성 실패율 증가
- 요약으로 인한 프롬프트 오류 발생

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 보고서 생성 시 “최근 채팅 요약” 섹션이 포함되는지 확인
2. 긴 채팅 기록에서도 요약이 길이 제한 내로 생성되는지 확인
3. 요약 실패 시 폴백이 적용되는지 확인

---

# Implementation Plan: 토큰 초과 방지 + 마인드맵 이미지 지식 활용

## 목표
1. 다중 PDF 첨부로 발생하는 토큰 초과 오류를 방지
2. 노트북LM 마인드맵 이미지 파일을 학술 지식 소스로 업로드·매칭·활용
3. 문서/이미지 혼합 첨부 규칙과 안전한 폴백으로 안정성 향상

---

## 핵심 변경 범위

### 1) 학술 파일 선택 로직
- PDF는 기본 1개만 선택(토큰 초과 방지)
- 이미지 마인드맵은 별도 1개까지 선택
- 키워드/주제 스코어링 기반 선택 및 대용량 PDF 제외

### 2) load_academic_knowledge 처리
- PDF 1개 + 이미지 1개 조합으로 PartUnion 전달
- 토큰 초과 오류 발생 시 단일/무첨부 재시도 또는 static knowledge 폴백
- 선택된 파일 목록 로그 유지

### 3) 업로드/메타데이터
- 학술 파일 업로드에서 이미지 MIME 지원
- 이미지 해상도 제한(3600x3600) 검증

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 다중 PDF 로딩으로 토큰 증가 | 응답 지연/오류 | PDF 1개 제한 및 오류 시 재시도 |
| 매칭 실패 시 품질 저하 | 빈약한 답변 가능성 | static knowledge 요약 + 일반 지식 안내 프롬프트 사용 |
| 이미지 해상도 초과 | 업로드 실패 | 3600x3600 사전 검증 및 경고 |

---

## 롤백 계획

### 트리거 조건
- 학술 PDF 로드 실패율 급증
- 응답 품질 저하로 사용자 불만 증가
- 로그에서 매칭 결과가 비정상적으로 빈번히 없음으로 표시

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run lint
npm run type-check
```

### 수동 검증
1. “SMART 원칙이 뭐야?” 질문 시 단일 폴백 PDF 사용 로그가 사라지는지 확인
2. 로빈스/커밍스 요청 시 PDF 1개만 첨부되어 토큰 오류가 발생하지 않는지 확인
3. 마인드맵 이미지 업로드 후 관련 질문에서 이미지가 첨부되는지 확인

---

# Implementation Plan: AI 페르소나 적용 + 빈 응답 오류 복구

## 목표
1. AI 페르소나/지침을 시스템 프롬프트 경로에 반영
2. Gemini 응답이 비어 있는 경우를 감지하고 재시도/폴백 처리
3. 보고서 생성 실패율 감소 및 사용자 오류 메시지 명확화

---

## 핵심 변경 범위

### 1) 페르소나/지침 반영
- `AIService`의 시스템 프롬프트 템플릿에 페르소나 규칙 추가

---

# Implementation Plan: 모델 가용성 검증 + 404 재시도

## 목표
1. Gemini 모델 목록을 조회해 현재 모델이 실제로 사용 가능한지 검증
2. generateContent/stream에서 404 모델 오류 발생 시 자동으로 전환 후 1회 재시도
3. 채팅/이미지 업로드 흐름 중단 방지

---

## 핵심 변경 범위

### 1) 모델 가용성 조회
- `models.list` 기반으로 사용 가능한 모델 목록을 캐시
- 모델 이름 정규화(예: `models/` 접두사 제거)

### 2) 404 재시도 처리
- `sendChatMessageStream` 시작 실패가 모델 미지원(404)인 경우, 모델 재검증 후 세션 재생성 및 재시도
- `extractMindmapKeywords`에서도 동일한 404 재시도 처리

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 모델 목록 조회 실패 | 자동 전환 불가 | 기존 모델로 진행 + 경고 로그 |
| 재시도 루프 | 무한 반복 | 재시도 1회 제한 |

---

## 롤백 계획

### 트리거 조건
- 모델 전환 후에도 404 오류 반복
- 채팅/업로드 흐름 지연

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- .agent/brain/implementation_plan.md
```

---

## 검증 계획

### 수동 검증
1. `gemini-3-flash` 설정 시 404 발생하면 자동 전환 및 재시도되는지 확인
2. 이미지 업로드/채팅이 중단되지 않는지 확인

---

# Implementation Plan: LiteLLM 프록시 추가

## 목표
1. 모델명 변경 대응을 위해 LiteLLM 프록시 구성 템플릿 제공
2. Gemini 모델을 OpenAI 호환 인터페이스로 호출 가능하도록 설정
3. 배포/운영 문서 제공

---

## 핵심 변경 범위

### 1) 프록시 설정 파일
- `litellm-proxy/config.yaml`에 gemini-3-flash-preview, gemini-3-pro-preview 등 모델 매핑
- API 키는 환경 변수로 주입

### 2) 실행/배포 스크립트
- Docker 실행/compose 예시 제공
- `.env.example`로 환경 변수 가이드 제공

### 3) 문서화
- README에 LiteLLM 프록시 사용법 및 별도 운영 안내

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 프록시 운영 부담 | 비용/관리 증가 | 별도 서비스로 분리 운영, 필요 시만 사용 |
| 키 노출 위험 | 보안 이슈 | 환경 변수로만 주입, 문서에 경고 |

---

## 롤백 계획

### 트리거 조건
- 프록시 운영 불필요 판단

### 롤백 절차
```bash
git checkout -- README.md
git checkout -- litellm-proxy
git checkout -- .agent/brain/implementation_plan.md
```

---

## 검증 계획

### 수동 검증
1. Docker로 프록시 실행 후 `/v1/chat/completions` 호출 성공 확인
2. Gemini API 키 미설정 시 명확한 오류 발생 확인
- 보고서 생성용 프롬프트에도 동일 지침 반영

### 2) 빈 응답 처리
- `sendMessage` 결과에서 빈 응답 감지
- 1회 재시도(동일 메시지/설정) 후에도 비어 있으면 폴백 메시지 반환
- 로그에 원인 추적 정보 추가

### 3) 오류 메시지 개선
- 보고서 생성 실패 시 사용자 안내 메시지 구체화

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 모델이 간헐적으로 빈 응답 반환 | 보고서 생성 실패 | 빈 응답 감지 + 재시도 + 폴백 처리 |
| 페르소나 과도한 길이 | 프롬프트 길이 증가 | 핵심 규칙만 유지, 불필요한 반복 제거 |

---

## 롤백 계획

### 트리거 조건
- 보고서 생성 실패율 증가
- 응답 지연/타임아웃 증가

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 보고서 생성 시 빈 응답 발생 로그가 감지되면 재시도/폴백이 동작하는지 확인
2. AI 페르소나 규칙이 응답에 반영되는지 확인
3. 실패 시 사용자 오류 메시지가 구체적으로 표시되는지 확인

---

# Implementation Plan: Presence/커서 동기화 + Shrimp 대체 절차

## 목표
1. Liveblocks presence 업데이트/구독 래퍼를 추가해 커서 동기화를 제공
2. Shrimp MCP 불가/불안정 시 문서 기반 대체 절차를 공식화

---

## 핵심 변경 범위

### 1) Presence 래퍼 추가
- `LiveblocksService`에 `updatePresence`, `onOthersPresence` 추가
- 세션 종료 시 room 참조 정리

### 2) 커서 전파 및 표시
- 캔버스 마우스 이동 시 커서 좌표 전송 (throttle)
- 다른 사용자 커서 표시 UI 추가

### 3) Shrimp 대체 문서화
- `.agent/skills/task-orchestration-fallback/SKILL.md` 신규
- `.agent/workflows/MCP-VSCODE.md`, `shrimp-rules.md`에 대체 절차 연결

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 커서 전송 과다 | 성능 저하 | 50ms throttle 적용 |
| Presence 미수신 | 커서 미표시 | sync-complete 후 구독 재설정 |
| Shrimp 규칙 충돌 | 절차 혼선 | fallback 규칙을 명시적으로 추가 |

---

## 롤백 계획

### 트리거 조건
- 커서 표시로 인한 성능 저하
- Presence 업데이트 오류

### 롤백 절차
```bash
git checkout -- src/services/LiveblocksService.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/workflows/MCP-VSCODE.md
git checkout -- shrimp-rules.md
git checkout -- .agent/skills/task-orchestration-fallback/SKILL.md
git checkout -- .agent/brain/implementation_plan.md
```

---

## 검증 계획

### 수동 검증
1. 두 브라우저에서 동일 세션 접속 후 커서가 상호 표시되는지 확인
2. Shrimp MCP 불가 시 fallback 문서로 절차 수행 가능 여부 확인

---

# Implementation Plan: Gemini Function Calling mode 조건 수정

## 목표
1. allowedFunctionNames를 mode=ANY일 때만 전달하여 400 오류 제거
2. AUTO/NONE 모드에서도 내부 도구만 노출되도록 tool declarations 필터링 유지

---

## 핵심 변경 범위

### 1) FunctionCallingConfig 규칙 준수
- mode=ANY에서만 allowedFunctionNames 포함
- AUTO/NONE에서는 allowedFunctionNames 미전달

### 2) 도구 노출 제한 유지
- allowedFunctionNames가 있을 때 tools 배열을 이름 기준으로 필터링

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| AUTO 모드에서 도구 제한 해제 | 내부 도구만 사용해야 하는 흐름에 영향 | tools 필터링으로 제한 유지 |
| ANY 모드에서 툴 누락 | 기능 호출 실패 | allowedFunctionNames 기본값에 mapEditTools 사용 |

---

## 롤백 계획

### 트리거 조건
- AUTO/NONE 모드에서 도구 호출이 비정상적으로 동작
- function calling 전반에서 오류 발생

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 채팅 스트림 호출 시 400 INVALID_ARGUMENT 오류 재발 여부 확인
2. allowExternalTools=false 경로에서 내부 도구만 사용되는지 확인

---

# Implementation Plan: 전체/1:1 채팅 분리

## 목표
1. 전체 채팅과 1:1 채팅 메시지를 탭별로 분리해 혼합 표시를 방지
2. 전체 채팅은 Liveblocks 공유, 1:1 채팅은 로컬로 분리 유지

---

## 핵심 변경 범위

### 1) 메시지 스코프 필드 추가
- `ChatMessage.scope`에 `group/direct` 구분 필드 추가
- Liveblocks에 저장되는 메시지는 `scope: group` 지정

### 2) 탭별 필터링 적용
- UI 렌더링 시 `scope`로 메시지 분리
- 기존 메시지는 `scope` 미존재 시 `group`으로 보정

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 기존 메시지에 scope 없음 | 필터 누락/미표시 | scope 기본값을 group으로 보정 |
| 1:1 메시지 공유 | UX 혼란 | direct는 로컬만 유지 |

---

## 롤백 계획

### 트리거 조건
- 탭 전환 시 메시지 표시가 비정상
- Liveblocks 채팅 동기화 오류 발생

### 롤백 절차
```bash
git checkout -- src/types/liveblocks.ts
git checkout -- src/services/LiveblocksService.ts
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 전체 탭에서 1:1 메시지가 보이지 않는지 확인
2. 1:1 탭에서 전체 메시지가 섞이지 않는지 확인

---

# Implementation Plan: ELK 기반 auto_layout 및 edge 겹침 완화

## 목표
1. ELK layered 레이아웃 도입으로 연결선 겹침/교차를 최소화
2. 과도한 간격 증가 없이 spacing preset을 반영
3. 레이아웃 실패 시 기존 앵커 보존 레이아웃으로 fallback

---

## 핵심 변경 범위

### 1) 레이아웃 엔진 도입
- `elkjs` 의존성 추가
- `flowAutoLayout.ts`에 ELK 레이아웃 함수 추가

### 2) async 레이아웃 적용
- `safeAutoLayout` 및 AI 일괄 생성 레이아웃을 async 처리
- 레이아웃 완료 후 Liveblocks 동기화 유지

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| ELK 레이아웃 실패 | 레이아웃 미적용 | 기존 앵커 보존 레이아웃으로 fallback |
| 간격 과대 | 화면 비효율 | spacing preset별 옵션 튜닝 |
| 비동기 적용 지연 | UX 지연 | auto_layout 호출 시점만 async 실행 |

---

## 롤백 계획

### 트리거 조건
- auto_layout 실행 후 위치 이상/멈춤
- 레이아웃 적용 시 UI 멈춤 현상

### 롤백 절차
```bash
git checkout -- src/utils/flowAutoLayout.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- package.json
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. auto_layout 실행 시 연결선 겹침이 완화되는지 확인
2. spacing preset(좁게/보통/넓게) 적용이 과도한 간격 없이 반영되는지 확인
3. 레이아웃 실패 시 기존 레이아웃으로 fallback되는지 확인

---

# Implementation Plan: 레이어 높이/투명도 동기화 및 동적 높이(20px 패딩)

## 목표
1. 레이어 높이를 노드 위치 기반으로 동적으로 조절하고 하단 20px 여백 유지
2. 레이어 투명도 범위를 0~100%로 변경하고 초기값 0%
3. 레이어 높이/투명도 상태를 Liveblocks에 저장해 재입장 시 복원

---

## 핵심 변경 범위

### 1) Liveblocks 레이어 설정 저장/리스너
- Y.Doc의 `layerSettings` Map에 layerHeights/layerOpacities 저장
- 변경 이벤트 `layer-settings-changed` emit
- 유효성 검사(배열 길이 4, 유한수) 및 기본값 폴백

### 2) CultureMapFlow 동기화
- layerOpacities 초기값 0
- 투명도 슬라이더 범위 0~1
- sync-complete 및 layer-settings-changed에서 상태 복원
- 로컬 변경 시 Liveblocks에 저장(루프 방지)

### 3) 동적 레이어 높이 계산
- 노드의 y+height 최대값을 기준으로 레이어 높이 계산
- 레이어 하단 여백 20px 유지
- 레이아웃 유틸의 패딩 상수 20px로 통일

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 레이어 설정 루프 | 값 덮어쓰기 | 적용 플래그로 저장 루프 방지 |
| 투명도 0%에서 색상 계산 오류 | 경계선 색상 붕괴 | 색상 생성 함수를 분리해 OPACITY 치환 |

---

## 롤백 계획

### 트리거 조건
- 레이어 상태가 복원되지 않거나 드래그 시 레이아웃 이상 발생

### 롤백 절차
```bash
git checkout -- src/services/LiveblocksService.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/utils/flowAutoLayout.ts
git checkout -- src/types/liveblocks.ts
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 요약/편집 후 재입장 시 레이어 높이/투명도 복원 확인
2. 노드 하단과 레이어 경계가 최소 20px 여백 유지 확인
3. 투명도 0%에서 경계선 렌더링 정상 확인

---

# Implementation Plan: 레이어 상하단 패딩 + 최대 높이 800

## 목표
1. 레이어 상단/하단 모두 20px 패딩 적용
2. 레이어 높이 조절 최대값을 800으로 확장

---

## 핵심 변경 범위

### 1) 레이어 패딩 보강
- 드래그 클램프에 상하단 20px 반영
- auto_layout 및 레이아웃 유틸 패딩을 40px로 통일
- 동적 높이 계산에 상단/하단 패딩 모두 반영

### 2) 최대 높이 800
- adjust_layer_height 및 UI 입력 최대값 800으로 변경

---

## 검증 계획

### 수동 검증
1. 레이어 상단/하단 모두 20px 여백 유지 확인
2. 레이어 높이 슬라이더에서 800까지 조절 가능 확인

---

# Implementation Plan: 드래그 기반 레이어 확장/축소 개선

## 목표
1. 노드 드래그로 레이어 하단 경계가 800까지 함께 내려가도록 동적 높이 반영
2. 노드를 위로 끌어올리면 레이어 하단 경계가 함께 올라가도록 축소 반영
3. 초기 투명도 기본값을 100%로 유지

---

## 핵심 변경 범위

### 1) 동적 레이어 높이 계산 보강
- 레이어 시작점(cumulativeY) 기준으로 하단 위치를 계산
- 최대 높이 800까지 확장, 위로 이동 시 축소 허용

### 2) 기본 투명도
- layerOpacities 초기값 1로 설정
- Liveblocks 기본값도 1로 정렬

---

## 검증 계획

### 수동 검증
1. 노드를 아래로 내리면 레이어 높이가 800까지 확장되는지 확인
2. 노드를 위로 올리면 레이어 경계가 함께 올라오는지 확인

---

# Implementation Plan: AI 액션 의도 판별 보강 + 레이어 밴드 클램프

## 목표
1. 요약/축약 요청 시 노드 편집 액션이 무시되지 않도록 의도 판별 보강
2. AI가 반환한 액션을 explicit 의도 없이도 수동 확인 가능하게 저장
3. 노드가 레이어 영역 밖으로 이동하지 않도록 드래그 y 좌표 제한

---

## 핵심 변경 범위

### 1) AIChatSidebar 의도 판별 개선
- actionVerbs/actionNouns에 요약/축약/간략/내용 등 키워드 추가
- explicit 의도 없을 때도 수동 확인용 액션 저장
- 자동 실행은 explicit 요청 시에만 허용

### 2) 레이어 밴드 클램프
- layerHeights 기반으로 레이어 밴드 시작/높이 계산
- handleNodesChange에서 position 변경 y를 밴드 범위로 제한
- Liveblocks 동기화는 클램프된 좌표 사용

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 의도 판별 과대 | 원치 않는 액션 제안 | 자동 실행은 explicit 요청에서만 허용 |
| 과도한 클램프 | 노드 이동 불편 | 노드 높이 반영, 레이어 높이 변경 시 자동 반영 |

---

## 롤백 계획

### 트리거 조건
- 요약 요청에도 액션이 표시되지 않음
- 노드 드래그가 정상적으로 동작하지 않음

### 롤백 절차
```bash
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. "요약해줘" 요청 시 update_node 액션이 수동 확인에 표시되는지 확인
2. 노드가 레이어 영역 밖으로 드래그되지 않는지 확인

---

# Implementation Plan: 학술 파일 공유 목록 정리

## 목표
1. 세션 공유 목록에 스테일/빈 학술 파일 항목이 표시되지 않도록 정리
2. 파일 0개인 사용자 메타데이터는 공유 맵에서 제거

---

## 핵심 변경 범위

### 1) Liveblocks academicFiles 정리
- publish 시 파일 0개면 해당 userId 엔트리 삭제
- presence에 userId 포함해 사용자 식별 일관성 유지

### 2) 공유 목록 UI 필터링
- 파일 1개 이상인 항목만 렌더링
- "공유된 지식 파일이 없습니다" 메시지는 필터링 결과 기준

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| presence 확장 부작용 | 타입 불일치 가능 | SessionPresence 타입 동기화 및 최소 변경 |
| 공유 목록 과소 표시 | 실제 파일 누락 | files.length>0 기준만 적용 |

---

## 롤백 계획

### 트리거 조건
- 공유 목록이 비정상적으로 비어 보임
- 학술 파일 공유가 갱신되지 않음

### 롤백 절차
```bash
git checkout -- src/services/LiveblocksService.ts
git checkout -- src/types/liveblocks.ts
git checkout -- src/components/AIConfigModal.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 학술 파일이 없는 사용자 항목이 공유 목록에 표시되지 않는지 확인
2. 파일 업로드 후 공유 목록에 표시되는지 확인
3. 모든 파일 삭제 시 공유 목록에서 해당 사용자 항목이 사라지는지 확인

---

# Implementation Plan: 드래그 중 레이어 자동 확장 보강

## 목표
1. 드래그 중 변경된 노드 위치를 즉시 반영해 레이어 높이 자동 확장
2. 레이어 밴드 클램프 규칙은 유지하며 확장을 막지 않도록 개선

---

## 핵심 변경 범위

### 1) 드래그 기반 레이어 높이 계산
- handleNodesChange에서 applyNodeChanges로 임시 노드 상태 생성
- 임시 노드 기준으로 레이어별 maxBottom 계산 후 nextHeights 산출
- 드래그 중에는 확장(증가)만 즉시 반영

### 2) 클램프 기준 높이 갱신
- 확장된 레이어 높이를 기준으로 bandStart/bandHeight 계산
- 다른 레이어 침범은 기존 클램프 로직으로 차단

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 드래그 중 과도한 확장 | 레이어 높이 급변 | 확장만 허용, 축소는 기존 useEffect에서 처리 |
| 성능 저하 | 드래그 시 계산 비용 증가 | 확장 필요 시에만 setLayerHeights 호출 |

---

## 롤백 계획

### 트리거 조건
- 드래그 중 레이어가 확장되지 않거나 위치가 튀는 현상

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 노드 드래그 시 레이어 하단으로 자동 확장되는지 확인
2. 다른 레이어로 침범하지 않고 밴드 내에서만 이동하는지 확인

---

# Implementation Plan: 레이어 확장 시 하위 레이어 노드 동적 이동

## 목표
1. 상위 레이어 확장 시 하위 레이어 노드가 자연스럽게 아래로 이동
2. 레이어 밴드 규칙을 유지하면서 y축 위치가 자동 보정

---

## 핵심 변경 범위

### 1) 레이어 시작점 변화 추적
- 이전 레이어 시작점과 현재 시작점의 차이를 계산
- 레이어별 이동 델타를 산출

### 2) 노드 y 위치 자동 보정
- 레이어별 델타만큼 해당 레이어 노드 y 이동
- Liveblocks 및 로컬 notes 동기화 반영

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 드래그 중 노드 위치 튐 | UX 불편 | 레이어 시작점 변화 시에만 이동 적용 |
| 과도한 동기화 | 성능 저하 | 델타 존재 시에만 업데이트 |

---

## 롤백 계획

### 트리거 조건
- 레이어 확장 시 노드가 비정상적으로 이동

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 상위 레이어 확장 시 하위 레이어 노드가 함께 내려가는지 확인
2. 레이어 경계 내에서만 이동하는지 확인

---

# Implementation Plan: 세션 복원 중 레이어 시프트 가드

## 목표
1. 세션 복원(sync/initial) 시 레이어 시프트/동기화가 실행되지 않도록 억제
2. 드래그/레이어 확장 동작은 유지

---

## 핵심 변경 범위

### 1) 복원 플래그 도입
- `isHydratingRef`로 복원 중 상태 표시
- 복원 시작 시 `previousLayerStartsRef` 초기화

### 2) 시프트 이펙트 가드
- `isHydratingRef` 또는 `applyingLayerSettingsRef` 활성 시 노드 시프트/Liveblocks 업데이트 스킵

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 복원 직후 레이어 이동 누락 | 노드 위치 오차 | 복원 완료 후 정상 시프트 허용 |
| 플래그 해제 타이밍 오류 | 시프트 미작동 | requestAnimationFrame으로 한 프레임만 차단 |

---

## 롤백 계획

### 트리거 조건
- 복원 후 드래그 시 레이어 확장/시프트 불가

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. sync/initial 복원 시 시프트/업데이트가 실행되지 않는지 확인
2. 복원 후 드래그 시 레이어 확장/시프트 정상 동작 확인

---

# Implementation Plan: 복원 중 레이어 자동 계산/동기화 가드

## 목표
1. 복원 중 레이어 자동 높이 계산/동기화를 억제
2. 복원 이후 드래그 확장/시프트 동작 유지

---

## 핵심 변경 범위

### 1) 자동 높이 계산 가드
- `isHydratingRef` 또는 `applyingLayerSettingsRef` 활성 시 자동 높이 계산 중단

### 2) layerSettings 동기화 가드
- 복원 중 `updateLayerSettings` 호출 차단

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 복원 직후 레이어 높이 미갱신 | 레이어 높이 지연 | 복원 종료 후 자동 계산 재개 |
| 가드 누락 | 반복 동기화 | 복원 플래그/설정 적용 플래그 동시 체크 |

---

## 롤백 계획

### 트리거 조건
- 복원 후 드래그 확장/시프트 미동작

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. sync/initial 복원 시 레이어 높이 계산/동기화 스킵 확인
2. 복원 후 드래그 확장/시프트 정상 동작 확인

---

# Implementation Plan: PNG 고화질 내보내기

## 목표
1. PNG 내보내기 해상도 향상
2. 메모리 사용 폭증 방지

---

## 핵심 변경 범위

### 1) 고해상도 스케일링
- `toPng` 옵션에 `pixelRatio` 적용
- `devicePixelRatio` 기반으로 상한(3) 설정

### 2) 캐시 무효화
- `cacheBust: true`로 정적 캡처 안정성 확보

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 메모리 사용 증가 | 브라우저 렌더 지연 | pixelRatio 상한 적용 |
| 대형 캔버스 캡처 실패 | 내보내기 실패 | 에러 처리 유지 |

---

## 롤백 계획

### 트리거 조건
- PNG 내보내기 실패 빈도 증가

### 롤백 절차
```bash
git checkout -- src/components/ExportMenu.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. PNG 내보내기 선명도 개선 여부 확인
2. 내보내기 실패/지연 발생 여부 확인

---

# Implementation Plan: AI 페르소나/도움말 최신화

## 목표
1. AI가 수동 UI 조작 방법을 정확히 안내
2. 상단 ? 도움말/도움말 모달을 최신 UI 동작과 일치

---

## 핵심 변경 범위

### 1) AI 페르소나 안내 보강
- 시스템 프롬프트에 수동 조작 안내 원칙 추가

### 2) 도움말 텍스트 업데이트
- HelpModal과 상단 ? 알림 텍스트를 현재 조작 방식으로 수정

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 가이드와 UI 불일치 | 사용자 혼란 | 실제 동작 기준으로 문구 정정 |
| 안내 누락 | 기능 오해 | 생성/편집/연결/내보내기 항목 포함 |

---

## 롤백 계획

### 트리거 조건
- 도움말 문구가 실제 UI와 맞지 않음

### 롤백 절차
```bash
git checkout -- src/services/AIService.ts
git checkout -- src/components/HelpModal.tsx
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. AI가 수동 조작 방법을 안내하는지 확인
2. ? 도움말과 모달의 안내가 실제 조작과 일치하는지 확인

---

# Implementation Plan: 컨설팅 모드 세션 타입 동기화

## 목표
1. 컨설팅 모드 전환 후 재접속/새로고침 시 UI가 정상 노출
2. Liveblocks metadata 변경이 UI 상태에 즉시 반영

---

## 핵심 변경 범위

### 1) Liveblocks metadata 동기화
- provider sync 시 metadata에서 session type 복원
- metadata observe에서 변경 감지 및 이벤트 emit

### 2) UI 구독 및 반영
- CultureMapFlow에서 session type 상태 유지
- session-type-changed 이벤트로 UI 토글 갱신

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| metadata 누락 | 기본 모드로 고정 | 기본값 유지 + 변경 이벤트 수신 시 갱신 |
| 이벤트 누락 | UI 미갱신 | sync 시점 강제 동기화 + observe 추가 |

---

## 롤백 계획

### 트리거 조건
- 재접속 후 컨설팅 모드 UI가 계속 미표시

### 롤백 절차
```bash
git checkout -- src/services/LiveblocksService.ts
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 컨설팅 모드 전환 후 새로고침/재접속 시 UI 표시 확인
2. 다른 사용자가 모드 변경 시 즉시 반영되는지 확인

---

# Implementation Plan: 컨설팅 → 워크샵 전환 버튼 추가

## 목표
1. 설정창에서 워크샵 모드 전환 지원
2. 세션 타입 업데이트가 즉시 반영되도록 리로드 처리

---

## 핵심 변경 범위

### 1) AIConfigModal 전환 로직 추가
- 워크샵 전환 핸들러 및 메시지 상태 추가
- 세션 미연결/이미 워크샵/전환 실패 처리

### 2) UI 버튼 추가
- 기존 consulting-switch 스타일 재사용
- 전환 중 버튼 비활성화

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 잘못된 모드 전환 | UX 혼란 | 전환 확인 다이얼로그 표시 |
| 세션 미연결 | 전환 실패 | 에러 메시지로 안내 |

---

## 롤백 계획

### 트리거 조건
- 워크샵 전환 후 UI가 정상적으로 전환되지 않음

### 롤백 절차
```bash
git checkout -- src/components/AIConfigModal.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. 컨설팅 모드에서 워크샵 전환 버튼 클릭 후 새로고침 시 워크샵 UI 확인
2. 세션 미연결/이미 워크샵 상태에서 에러 메시지 표시 확인

---

# Implementation Plan: JSON 가져오기 + 채팅 JSON 첨부 읽기

## 목표
1. JSON 내보내기 파일을 다시 불러와 컬쳐맵을 복원
2. 채팅 첨부로 JSON을 읽고 AI 프롬프트에 포함

---

## 핵심 변경 범위

### 1) ExportMenu JSON 가져오기
- JSON 가져오기 버튼 및 숨김 file input 추가
- CultureMapFlow로 파일 전달

### 2) CultureMapFlow JSON 파싱/동기화
- JSON 구조 검증(nodes/edges/viewport)
- convertFromFlowData → convertToFlowData 재사용
- Liveblocks clearMapData 후 updateStickyNote/updateConnection으로 반영
- viewport 포함 시 reactFlowInstance.setViewport 적용

### 3) AIChatSidebar JSON 첨부 읽기
- input accept에 .json 추가
- JSON 파일은 로컬에서 읽어 prompt에 포함
- 길이 제한 및 파싱 오류 메시지 처리

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| JSON 구조 불일치 | 로드 실패 | 최소 필드 검증 후 오류 메시지 표시 |
| 대용량 JSON | 느린 응답 | 프롬프트 첨부 길이 제한 적용 |
| 동기화 불일치 | 맵 손상 | Liveblocks clearMapData 후 순차 업데이트 |

---

## 롤백 계획

### 트리거 조건
- JSON 가져오기 후 맵이 비어 있거나 레이아웃이 깨짐

### 롤백 절차
```bash
git checkout -- src/components/ExportMenu.tsx
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- .agent/brain/implementation_plan.md
git checkout -- .agent/brain/task.md
git checkout -- .agent/brain/walkthrough.md
```

---

## 검증 계획

### 수동 검증
1. JSON 가져오기 후 노드/연결 수가 일치하는지 확인
2. 새로고침/재접속 후에도 맵이 유지되는지 확인
3. 채팅에서 JSON 첨부 시 업로드 없이 AI 응답이 생성되는지 확인
