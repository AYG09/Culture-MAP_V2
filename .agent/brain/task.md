# Task List: auto_layout 비정상 종료 및 레이어 이탈 보정

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: auto_layout fallback 보강
- [x] ELK 결과 누락 시 기본 레이아웃 대체
- [x] safeAutoLayout에서 불일치 시 fallback 적용

## Task 2: auto_layout 중복/타입 정규화
- [x] safeAutoLayout 노드 id dedupe 적용
- [x] 기본 레이아웃에서 레이어 타입 정규화

## Task 3: 검증
- [ ] auto_layout 중단 로그 해소 확인
- [ ] 정렬 후 레이어 이탈 여부 확인


# Task List: JSON 내보내기 중복 노드 제거

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: JSON 내보내기 dedupe
- [x] node id 중복 제거
- [x] edge source/target 유효성 필터

## Task 2: 검증
- [ ] JSON 내보내기에서 nodeCount가 실제 고유 노드 수와 일치하는지 확인


# Task List: 레이어 라벨 툴팁 가림/정렬 레이어 이탈 수정

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 툴팁 표시 계층 분리
- [x] 라벨을 별도 ViewportPortal로 렌더링
- [x] 툴팁 z-index 상향

## Task 2: auto_layout 경로 보정
- [x] 동일 레이어 edge 존재 시 basic 레이아웃 사용
- [x] AI 일괄 생성 후 safeAutoLayout 재실행

## Task 3: 검증
- [ ] 툴팁이 노드에 가려지지 않는지 확인
- [ ] 자동 정렬 후 노드가 레이어 범위 내에 있는지 확인
- [ ] 동일 레이어 선후관계 반영 확인


# Task List: 동일 레이어 선후관계 반영 정렬 개선

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 동일 레이어 순서 계산
- [x] 동일 레이어 edge 기반 위상 정렬 적용

## Task 2: 검증
- [ ] 동일 레이어 연결 순서 유지 확인


# Task List: 줌 확대 시 노드 사라짐 버그 수정

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: translateExtent 동적 계산
- [x] 노드 bbox 기반으로 translateExtent 확장

## Task 2: 검증
- [ ] 확대/축소 시 노드 유지 확인


# Task List: ExportMenu 상단 버튼 스타일 통일

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: ExportMenu 버튼 클래스 통일
- [x] ExportMenu 버튼에 glass-button 클래스 추가

## Task 2: ExportMenu CSS 오버라이드 제거
- [x] export-button 배경/색상/그림자 제거
- [x] 레이아웃/간격/disabled 유지

## Task 3: 검증
- [ ] 새로고침/재접속 후 상단 버튼 스타일 유지
- [ ] 보고서 탭 전환 후에도 스타일 유지
- [x] 내보내기 기능 및 스피너 동작 확인


# Task List: 레이어 간격/높이 안정화 및 레이어 이탈 방지

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 동일 레이어 간격/행간 확대
- [x] edge 밀도 기반 horizontalSpacing/minGap 확대
- [x] depth 행간(rowOffset) 확대

## Task 2: auto_layout 후처리 개선
- [x] 레이어별 requiredHeight 재계산
- [x] 상대 yOffset 유지 + 밴드 내부 클램프

## Task 3: 전역 MCP 규칙 정합성
- [x] Skills 최신 시 Context7/Tavily 생략 가능 문구 반영

## Task 4: 검증
- [ ] 행동 레이어 가시성 개선 확인
- [ ] 유형/무형 레버 과확장 해소 확인
- [ ] 레이어 이탈 없음 확인


# Task List: AI 노드 위치/동기화 소실 방지

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: AI 노드 타입 기본값 보정
- [x] add_node type 누락 시 layer 기반 타입 보정
- [x] add_nodes_with_connections 동일 보정 적용

## Task 2: Liveblocks observe 이벤트 스팸/소실 방지
- [x] 로컬 단건 변경 snapshot emit 억제
- [x] 업데이트로 인한 삭제 이벤트 필터링

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 4: 검증
- [ ] AI 생성 노드 위치 정상 여부 확인
- [ ] 드래그 중 노드 소실 재현 여부 확인


# Task List: 학술 파일 공유 목록 동기화 보강

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 공유 목록 동기화/필터링 개선
- [x] 모달 오픈 시 로컬 비어있으면 본인 공유 메타데이터 삭제
- [x] 공유 메타데이터 늦은 동기화 시 자동 정리
- [x] Liveblocks presence 기반 activeUserIds 수집
- [x] 공유 목록 렌더링 시 activeUserIds 기준 필터링
- [x] 세션 종료 시 publishAcademicFiles([]) 호출

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 3: 검증
- [ ] 로컬 비어 있을 때 공유 목록에서 본인 항목 제거 확인
- [ ] 접속 사용자만 공유 목록에 표시되는지 확인
- [ ] 세션 종료 후 스테일 항목 미표시 확인


# Task List: 미연결 업데이트 가드

## 진행 상황


## Task 1: 연결 상태 가드 추가

## Task 2: 문서 업데이트

## Task 3: 검증


# Task List: 새로고침 시 세션 자동 재접속

## 진행 상황


## Task 1: 자동 재접속 로직

## Task 2: 나가기 처리

## Task 3: 문서 업데이트

## Task 4: 검증


# Task List: 동기화 완료 후 IndexedDB 캐시 리셋

## 진행 상황


## Task 1: 캐시 리셋 로직 추가

## Task 2: 문서 업데이트

## Task 3: 검증


# Task List: DEV-LOCAL 채팅 내역 초기화

## 진행 상황


## Task 1: 채팅 초기화 API 추가

## Task 2: UI 버튼 추가


# Task List: 컨텍스트 메뉴/노드 편집 UX 개선

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: AI 생성 노드 편집 반영 수정
- [x] AI 액션 생성 노드에 onUpdate/onEditStart/onEditEnd 주입
- [x] 잠금 필드 기본값 추가

## Task 2: 컨텍스트 메뉴 UX 및 유형 변경
- [x] 메뉴 라벨 결과/행동/유형/무형으로 단순화
- [x] 메뉴 기준 뷰포트 이동 로직 추가
- [x] 노드 유형 변경 액션 추가

## Task 3: 레이어 라벨 hover 팝업
- [x] 레이어 라벨 툴팁 추가
- [x] 툴팁 스타일 추가

## Task 4: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 5: 검증
- [ ] AI 생성 노드 편집 반영 확인
- [ ] 우클릭 메뉴 화면 잘림 해소 확인
- [ ] 노드 유형 변경 동작 확인
- [ ] 레이어 라벨 hover 팝업 표시 확인

## Task 3: 문서 업데이트

## Task 4: 검증


# Task List: 클립보드 이미지 붙여넣기 지원

## 진행 상황


## Task 1: 붙여넣기 처리

## Task 2: 미리보기 UI

## Task 3: 문서 업데이트

## Task 4: 검증


# Task List: Gemini Function Calling mode 조건 수정

## 진행 상황


## Task 1: functionCallingConfig 수정

## Task 2: 문서 업데이트

## Task 3: 검증


# Task List: 전체/1:1 채팅 분리

## 진행 상황


## Task 1: 메시지 scope 적용

## Task 2: 탭별 분리 처리

## Task 3: 문서 업데이트

## Task 4: 검증


# Task List: ELK 기반 auto_layout 및 edge 겹침 완화

## 진행 상황


## Task 1: ELK 레이아웃 엔진 도입

## Task 2: async 레이아웃 적용

## Task 3: 문서 업데이트

## Task 4: 검증


# Task List: 레이어 정렬 순서/높이 동기화

## 진행 상황


## Task 1: 레이아웃 유틸 순서 정렬

## Task 2: auto_layout 후처리

## Task 3: 배경 레이어 순서 동기화

## Task 4: 문서 업데이트

## Task 5: 검증


# Task List: AI 컨트롤(뷰포트/스타일/백업) 확장

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 도구 스키마 확장
- [x] MAP_TOOL_DECLARATIONS 신규 액션 추가

## Task 2: AI 시스템 지침 업데이트
- [x] 도구 사용 규칙/허용 목록 확장

## Task 3: CultureMapFlow 핸들러 추가
- [x] 뷰포트/레이어/UI/스타일/스냅샷 액션 처리
- [x] Liveblocks 복원 동기화 처리

## Task 4: CSS 변수 적용
- [x] FlowNodes.css 스타일 변수화

## Task 5: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 6: 검증
- [ ] AI 액션으로 줌/팬/포커스 동작 확인
- [ ] UI 토글 및 스타일 변경 반영 확인
- [ ] 스냅샷 저장/복원 동작 확인


# Task List: Vercel index.html 캐시 무효화

## 진행 상황


## Task 1: 캐시 헤더 설정

## Task 2: 문서 업데이트

## Task 3: 검증


# Task List: 컨설팅 모드 세션 타입 동기화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: session type 동기화 이벤트 추가
- [x] metadata observe/sync에서 session-type-changed emit

## Task 2: UI 구독 및 반영
- [x] CultureMapFlow에서 sessionType 상태/구독 적용

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 4: 검증
- [x] npm run build 성공
- [ ] 컨설팅 모드 재접속 UI 표시 (사용자 환경)

 # Task List: AI 액션 의도 판별 보강 + 레이어 밴드 클램프

 ## 진행 상황
 - 🔲 미완료
 - 🔄 진행 중
 - ✅ 완료

 ---

 ## Task 1: AIChatSidebar 의도 판별 개선
 - [x] 요약/축약/간략/내용 키워드 추가
 - [x] explicit 의도 없을 때도 수동 확인용 액션 저장
 - [x] 자동 실행은 explicit 요청 시에만 허용

 ## Task 2: 레이어 밴드 클램프
 - [x] 레이어 밴드 시작/높이 계산
 - [x] position 변경 y 클램프 적용
 - [x] Liveblocks 동기화에 클램프 좌표 사용

 ## Task 3: 문서 업데이트
 - [x] implementation_plan.md 업데이트
 - [x] walkthrough.md에 변경 사항 기록

 ## Task 4: 검증
 - [ ] 요약 요청 시 update_node 액션 표시 확인
 - [ ] 레이어 영역 밖 드래그 불가 확인
- [x] ChatMessage에 scope 추가

---

# Task List: 레이어 높이/투명도 동기화 및 동적 높이

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: Liveblocks 레이어 설정 저장
- [x] layerSettings 저장/조회 메서드 추가
- [x] layer-settings-changed 이벤트 emit

## Task 2: 레이어 높이/투명도 동기화
- [x] 투명도 초기값 0% 및 슬라이더 0~100% 변경
- [x] sync-complete/변경 이벤트로 복원
- [x] 로컬 변경 시 Liveblocks 저장

## Task 3: 동적 레이어 높이(20px 패딩)
- [x] 노드 하단 기준 레이어 높이 계산
- [x] 레이어 패딩 20px 통일
- [x] 투명도 0% 대응 색상 계산 수정
- [x] 상단 패딩 포함 클램프 적용
- [x] 레이아웃 패딩 40px 통일

## Task 4: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 5: 검증
- [ ] 재입장 시 레이어 높이/투명도 복원 확인
- [ ] 레이어 하단 20px 여백 유지 확인
- [ ] 레이어 상단 20px 여백 유지 확인
- [ ] 레이어 높이 최대 800 확인
- [ ] 노드 드래그 하단 확장/상단 축소 확인

---

# Task List: 세션 복원 중 레이어 시프트 가드

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 복원 가드 추가
- [x] isHydratingRef 도입 및 복원 시작 시 플래그 설정
- [x] 레이어 시프트 이펙트에서 복원/설정 적용 중 가드
- [x] 복원 완료 후 플래그 해제

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 3: 검증
- [x] npm run build 성공
- [ ] 복원 시 시프트/동기화 스킵 확인 (사용자 환경)
- [ ] 복원 후 드래그 시 레이어 확장/시프트 확인 (사용자 환경)

---

# Task List: 드래그 기반 레이어 확장/축소 개선

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 동적 높이 계산 보강
- [x] 레이어 시작점 기준 하단 확장 계산
- [x] 최대 800 제한 적용

## Task 2: 초기 투명도 기본값
- [x] layerOpacities 초기값 1 설정
- [x] Liveblocks 기본값 1로 정렬

## Task 3: 검증
- [ ] 노드 하단 확장/상단 축소 동작 확인

---

# Task List: 학술 파일 공유 목록 정리

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: Liveblocks academicFiles 정리
- [x] SessionPresence에 userId 추가
- [x] publish 시 빈 목록 엔트리 삭제

## Task 2: 공유 목록 UI 필터링
- [x] 파일 1개 이상 항목만 렌더링
- [x] 빈 목록 메시지 기준 조정

## Task 3: 검증
- [ ] 공유 목록에 빈/스테일 항목 미표시 확인

---

# Task List: 드래그 중 레이어 자동 확장 보강

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 드래그 기반 레이어 높이 계산
- [x] applyNodeChanges로 임시 노드 상태 생성
- [x] 드래그 중 확장만 즉시 반영

## Task 2: 클램프 기준 높이 갱신
- [x] 확장된 높이를 기준으로 bandStart/bandHeight 계산

## Task 3: 검증
- [ ] 드래그 중 레이어 자동 확장 확인

---

# Task List: 레이어 확장 시 하위 레이어 노드 동적 이동

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 레이어 시작점 변화 추적
- [x] 이전/현재 레이어 시작점 비교
- [x] 레이어별 이동 델타 산출

## Task 2: 노드 y 위치 자동 보정
- [x] 레이어별 델타 적용
- [x] Liveblocks 및 notes 동기화

## Task 3: 검증
- [ ] 하위 레이어 노드가 함께 내려가는지 확인

---

# Task List: PNG 고화질 내보내기

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 고화질 옵션 적용
- [x] toPng에 pixelRatio 적용
- [x] cacheBust 옵션 추가

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 3: 검증
- [x] npm run build 성공
- [ ] PNG 내보내기 선명도 개선 확인 (사용자 환경)

---

# Task List: AI 페르소나/도움말 최신화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: AI 안내 보강
- [x] 시스템 프롬프트에 수동 조작 안내 원칙 추가

## Task 2: 도움말 업데이트
- [x] HelpModal 텍스트 최신화
- [x] 상단 ? 도움말 텍스트 최신화

## Task 3: 검증
- [ ] AI가 수동 조작 방법을 안내하는지 확인 (사용자 환경)
- [ ] 도움말 문구가 실제 조작과 일치하는지 확인 (사용자 환경)

---

# Task List: 복원 중 레이어 자동 계산/동기화 가드

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 가드 추가
- [x] 자동 높이 계산 useEffect에 복원 가드 적용
- [x] layerSettings 동기화 useEffect에 복원 가드 적용

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 3: 검증
- [x] npm run build 성공
- [ ] 복원 시 레이어 높이 계산/동기화 스킵 확인 (사용자 환경)
- [ ] 복원 후 드래그 확장/시프트 확인 (사용자 환경)

---

# Task List: 컨설팅 → 워크샵 전환 버튼 추가

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 워크샵 전환 로직
- [x] AIConfigModal에 워크샵 전환 핸들러 추가
- [x] 세션 미연결/이미 워크샵/실패 메시지 처리

## Task 2: UI 버튼 추가
- [x] 설정창에 워크샵 전환 버튼 추가

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 4: 검증
- [ ] 컨설팅 → 워크샵 전환 동작 확인 (사용자 환경)

---

# Task List: Liveblocks 복원 루프/실시간 동기화 안정화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: snapshot 이벤트 조건 제한
- [x] notes/connection 스냅샷 emit 조건을 대량 변경에만 제한

## Task 2: hydrate 호출 coalesce
- [x] notes/connection 변경 hydrate를 RAF로 coalesce

## Task 3: 로컬 변경 핸들러 최신 상태 반영
- [x] apply*Changes 결과를 setNodes/setEdges로 적용하고 refs 즉시 갱신

## Task 4: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 5: 검증
- [ ] 노드 위치 변경이 타 사용자에게 즉시 반영되는지 확인 (사용자 환경)
- [ ] 연결선 유형 변경이 타 사용자에게 즉시 반영되는지 확인 (사용자 환경)
- [ ] 복원 로그가 과도하게 반복되지 않는지 확인 (사용자 환경)

---

# Task List: 레이어 높이/노드 위치 동기화 스팸 차단

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 레이어 높이 출처 구분
- [x] 사용자 조작 시에만 노드 위치 배치 동기화
- [x] 자동/원격 레이어 높이 변경 동기화 차단

## Task 2: 드래그 종료 동기화
- [x] 드래그 종료 노드만 updateStickyNote 수행

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md 변경 사항 기록

## Task 4: 검증
- [ ] updateStickyNote 스팸 로그 감소 확인 (사용자 환경)
- [ ] 드래그 종료 시 위치 동기화 확인 (사용자 환경)
- [ ] 자동 레이어 계산 중 노드 동기화 미발생 확인 (사용자 환경)

---
