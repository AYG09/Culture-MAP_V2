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


# Task List: Vercel index.html 캐시 무효화

## 진행 상황


## Task 1: 캐시 헤더 설정

## Task 2: 문서 업데이트

## Task 3: 검증

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
