# Task List: 미연결 업데이트 가드

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 연결 상태 가드 추가
- [x] 주요 노드/연결 변경 경로에서 연결 확인
- [x] 경고 쿨다운 적용

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 3: 검증
- [ ] 미연결 상태에서 작업이 차단되는지 확인
- [ ] 연결 복구 후 정상 편집 확인

---

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

---

# Task List: Gemini Function Calling mode 조건 수정

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: functionCallingConfig 수정
- [x] mode=ANY에서만 allowedFunctionNames 전달
- [x] AUTO/NONE에서 tools 필터링으로 도구 제한 유지

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 3: 검증
- [ ] 스트리밍 호출에서 400 INVALID_ARGUMENT 오류 재발 여부 확인
- [ ] allowExternalTools=false 경로에서 내부 도구만 호출되는지 확인

---

# Task List: 전체/1:1 채팅 분리

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 메시지 scope 적용
- [x] ChatMessage에 scope 추가
- [x] Liveblocks 메시지에 scope: group 저장

## Task 2: 탭별 분리 처리
- [x] UI 필터링을 scope 기반으로 변경
- [x] 기존 메시지 scope 미존재 시 group 보정
- [x] 로컬 메시지에 탭 scope 기록

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [x] walkthrough.md에 변경 사항 기록

## Task 4: 검증
- [ ] 전체 탭에서 1:1 메시지가 보이지 않는지 확인
- [ ] 1:1 탭에서 전체 메시지가 섞이지 않는지 확인

---

# Task List: ELK 기반 auto_layout 및 edge 겹침 완화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: ELK 레이아웃 엔진 도입
- [x] elkjs 의존성 추가
- [x] ELK 레이아웃 함수 구현 및 fallback 처리

## Task 2: async 레이아웃 적용
- [x] safeAutoLayout async 처리
- [x] AI 일괄 생성 레이아웃 async 적용

## Task 3: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [ ] walkthrough.md에 변경 사항 기록

## Task 4: 검증
- [ ] auto_layout 실행 시 연결선 겹침 완화 확인

---

# Task List: Vercel index.html 캐시 무효화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 캐시 헤더 설정
- [x] vercel.json에 index.html 캐시 무효화 헤더 추가

## Task 2: 문서 업데이트
- [x] implementation_plan.md 업데이트
- [ ] walkthrough.md에 변경 사항 기록

## Task 3: 검증
- [ ] Vercel 재배포 후 최신 번들 해시 로드 확인
- [ ] 프로덕션 콘솔 에러 재발 여부 확인
- [ ] spacing preset 반영 여부 확인
