# Task List: 새로고침 시 세션 자동 재접속

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 자동 재접속 로직
- [x] 마지막 세션 코드 저장/복구
- [x] 재접속 실패 시 저장값 제거

## Task 2: 나가기 처리
- [x] 나가기 시 마지막 세션 저장값 삭제

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 4: 검증
- [ ] 새로고침 후 자동 재접속 확인
- [ ] 나가기 후 게이트 화면 복귀 확인

---

# Task List: 동기화 완료 후 IndexedDB 캐시 리셋

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 캐시 리셋 로직 추가
- [x] Liveblocks 동기화 이벤트에서 캐시 리셋 1회 실행
- [x] 세션 재접속 시 플래그 초기화

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 3: 검증
- [ ] 크롬/엣지 접속 시 동일 상태 표시 확인
- [ ] 새로고침 후 서버 최신 상태 유지 확인

---

# Task List: DEV-LOCAL 채팅 내역 초기화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 채팅 초기화 API 추가
- [x] LiveblocksService에 `clearChatMessages` 추가
- [x] AIService에 `resetChatSession` 추가

## Task 2: UI 버튼 추가
- [x] DEV-LOCAL 세션에서만 보이는 초기화 버튼 추가
- [x] 확인 팝업 후 실행

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 4: 검증
- [ ] DEV-LOCAL에서 초기화 버튼 클릭 시 메시지 삭제 확인
- [ ] 초기화 후 새 메시지 전송 정상 동작 확인

---

# Task List: 클립보드 이미지 붙여넣기 지원

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 붙여넣기 처리
- [x] onPaste에서 이미지 클립보드 감지
- [x] 이미지 첨부로 등록

## Task 2: 미리보기 UI
- [x] 이미지 썸네일 표시
- [x] object URL 정리

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [ ] walkthrough.md에 변경 사항 기록

## Task 4: 검증
- [ ] 이미지 붙여넣기 시 첨부/미리보기 표시 확인
- [ ] 텍스트 붙여넣기 정상 동작 확인
