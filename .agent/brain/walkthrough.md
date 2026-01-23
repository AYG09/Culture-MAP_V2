# Walkthrough: Vercel index.html 캐시 무효화

## 완료 일시
2026-01-23

## 변경 사항 요약

### 🎯 목표
1. Vercel에서 오래된 번들이 계속 로드되는 문제 방지
2. 최신 `index.html`이 항상 제공되도록 캐시 정책 강화

---

## 🔍 원인 분석

- 프로덕션에서 오래된 번들 해시가 계속 로드되어 TDZ 오류가 재발할 가능성 존재.

---

## ✅ 해결 조치

1. `vercel.json`에 `/`, `/index.html` 캐시 무효화 헤더 추가
2. 해시된 정적 자산 캐시는 유지

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `vercel.json` | index.html 캐시 무효화 헤더 추가 |
| `.agent/brain/implementation_plan.md` | 계획 추가 |
| `.agent/brain/task.md` | 체크리스트 추가 |

---

## 🧪 검증

1. Vercel 접속 후 3초 대기 시 `index-BjAX5Haz.js` 로드 및 ReferenceError 재발 확인
2. 오류 화면(ErrorBoundary) 렌더링 확인

---

# Walkthrough: 클립보드 이미지 붙여넣기 지원

# Walkthrough: Gateway TDZ 오류 수정

## 완료 일시
2026-01-23

## 변경 사항 요약

### 🎯 목표
1. Gateway 초기화 시 `Cannot access before initialization` 오류 제거
2. useEffect 의존성 참조 순서 안정화

---

## 🔍 원인 분석

- useEffect 의존성 배열이 useCallback 선언 이전 참조 가능(TDZ)하여 빌드 번들에서 ReferenceError 발생.

---

## ✅ 해결 조치

1. `handleDevModeAutoJoin`, `loadSessions` 선언을 useEffect 상단으로 이동
2. 의존성 배열과 기존 로직은 그대로 유지

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/Gateway.tsx` | useCallback 선언 순서 조정 |
| `.agent/brain/implementation_plan.md` | 계획 추가 |

---

## 🧪 검증

1. `npm run build` 성공 확인
2. preview 실행 후 브라우저 콘솔에서 ReferenceError 미발생 확인
	- Liveblocks API 키 미설정 경고는 예상된 동작

---

## 완료 일시
2026-01-21

## 변경 사항 요약

### 🎯 목표
1. 채팅 입력창에서 스크린샷/클립보드 이미지 붙여넣기 지원
2. 이미지 첨부 미리보기 및 제거 UI 제공

---

## 🔍 원인 분석

- 현재는 파일 첨부 버튼만 지원되어 클립보드 이미지가 입력창에 반영되지 않음.

---

## ✅ 해결 조치

1. `onPaste`에서 image/* 감지 시 첨부로 등록
2. 첨부 리스트에 썸네일 미리보기 추가
3. object URL 정리로 메모리 누수 방지

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/AIChatSidebar.tsx` | 붙여넣기 처리 및 미리보기 렌더링 |
| `src/components/AIChatSidebar.css` | 미리보기 스타일 추가 |
| `.agent/brain/implementation_plan.md` | 계획 갱신 |
| `.agent/brain/task.md` | 체크리스트 갱신 |

---

## 🧪 검증

1. 이미지 붙여넣기 시 첨부/미리보기 표시 확인
2. 텍스트 붙여넣기 정상 동작 확인

---

# Walkthrough: 이전 채팅 요약 + 토큰 예산 관리

## 완료 일시
2026-01-21

## 변경 사항 요약

### 🎯 목표
1. 보고서 생성 시 이전 채팅 요약을 포함
2. 모델 입력 토큰 한도 내에서 요약 길이를 예산화
3. 요약 실패 시 폴백 제공

---

## 🔍 원인 분석

- 새 세션 진입 시 AI는 과거 채팅 컨텍스트를 자동으로 기억하지 않음.
- 긴 대화/대용량 PDF 동시 사용 시 입력 토큰 한도 초과 위험.

---

## ✅ 해결 조치

1. `models.get`으로 모델 input/output 토큰 한도를 조회해 요약 예산 계산
2. 최근 채팅 메시지를 요약해 “최근 채팅 요약” 섹션으로 추가
3. 요약 실패 시 최근 메시지 발췌 폴백 적용

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 모델 한도 조회/캐시 + 채팅 요약 유틸 추가 |
| `src/components/CultureMapFlow.tsx` | 보고서 프롬프트에 요약 섹션 추가 |
| `.agent/brain/implementation_plan.md` | 계획 갱신 |
| `.agent/brain/task.md` | 체크리스트 갱신 |

---

## 🧪 검증

1. 보고서 생성 시 “최근 채팅 요약” 섹션 포함 여부 확인
2. 긴 대화에서도 요약이 1200자 이내인지 확인
3. 요약 실패 시 폴백 텍스트가 포함되는지 확인

---

# Walkthrough: 보고서 생성 응답 누락 방어

## 완료 일시
2026-01-21

## 변경 사항 요약

### 🎯 목표
1. 보고서 생성 중 AI 응답이 비어 있을 때 발생하는 런타임 에러 방지
2. 학술 검색 도구 응답 누락 시 안전한 폴백 처리

---

## 🔍 원인 분석

- `sendChatMessage()`에서 `result.response`가 `undefined`인 경우가 있어 `response.candidates` 접근 시 예외 발생.
- 학술 검색 도구 응답 또한 비어 있을 수 있어 후속 파싱 단계에서 오류 위험.

---

## ✅ 해결 조치

1. `sendChatMessage()`에서 빈 응답 방어 및 사용자 안내 오류 메시지 추가
2. `response.text`를 텍스트 폴백으로 사용
3. 학술 도구 응답 누락 시 경고 로그 및 안전한 텍스트 업데이트

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 빈 응답 방어 및 텍스트 폴백 처리 | 

---

## 🧪 검증

1. 보고서 생성 시 `Cannot read properties of undefined (reading 'candidates')` 오류 재현 여부 확인
2. 학술 도구 응답 누락 상황에서도 보고서 생성 흐름이 중단되지 않는지 확인

---

# Walkthrough: 이미지 리사이즈 + PDF/이미지 분리 제한

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 대형 마인드맵 이미지 업로드 실패를 자동 리사이즈로 해결
2. PDF/이미지 각각 10개 업로드 제한으로 분리
3. UI에서 타입별 카운트 표기

---

## 🔍 원인 분석

- 3600x3600 초과 이미지가 업로드 단계에서 즉시 차단됨.
- 학술 파일 제한이 합산 10개라 PDF 업로드 여지가 줄어듦.

---

## ✅ 해결 조치

1. 업로드 전에 이미지 크기를 측정하고 3600px 초과 시 자동 리사이즈
2. PDF/이미지 각각 최대 10개 제한 적용
3. UI에 PDF/이미지 카운트 분리 표시

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 이미지 리사이즈 및 타입별 제한 적용 |
| `src/components/AIConfigModal.tsx` | 타입별 업로드 카운트 표시 |
| `.agent/brain/task.md` | 체크리스트 갱신 |

---

## 🧪 검증

1. 대형 마인드맵 이미지 업로드 시 자동 리사이즈 확인
2. PDF/이미지 각각 10개 업로드 가능 확인

---

# Walkthrough: 토큰 초과 방지 + 마인드맵 이미지 지식 활용

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 다중 PDF 첨부로 발생하는 토큰 초과 오류 방지
2. 노트북LM 마인드맵 이미지를 학술 지식 소스로 활용
3. PDF/이미지 혼합 첨부 규칙과 폴백 안정화

---

## 🔍 원인 분석

- load_academic_knowledge에서 복수 PDF 첨부 시 입력 토큰 한도(1048576) 초과 발생.
- 학술 업로드가 PDF에만 제한되어 마인드맵 이미지를 활용할 수 없었음.

---

# Walkthrough: ELK 기반 auto_layout 및 edge 겹침 완화

## 완료 일시
2026-01-23

## 변경 사항 요약

### 🎯 목표
1. ELK layered 레이아웃 도입으로 연결선 겹침/교차 최소화
2. spacing preset에 따라 간격을 과도하게 늘리지 않도록 제어
3. 레이아웃 실패 시 기존 앵커 보존 레이아웃으로 fallback

---

## 🔍 원인 분석

- 기존 auto_layout은 노드 위치만 재배치하며 edge routing을 처리하지 않아 연결선/노드 겹침이 잦았음.

---

## ✅ 해결 조치

1. `elkjs` 도입 및 `getElkLayoutedElements` 구현
2. `safeAutoLayout` 및 AI 일괄 생성 레이아웃을 async 처리
3. spacing preset에 따라 ELK 옵션을 조정하고 실패 시 fallback 처리

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | elkjs 의존성 추가 |
| `src/utils/flowAutoLayout.ts` | ELK 레이아웃 함수/옵션 추가 |
| `src/components/CultureMapFlow.tsx` | auto_layout async 적용 |
| `.agent/brain/implementation_plan.md` | 계획 갱신 |
| `.agent/brain/task.md` | 체크리스트 갱신 |

---

## 🧪 검증

1. auto_layout 실행 시 연결선 겹침 완화 여부 확인
2. spacing preset(좁게/보통/넓게) 반영 여부 확인

---

## ✅ 해결 조치

1. 학술 첨부를 PDF 1개 + 이미지 1개로 제한
2. 토큰 초과 오류 감지 시 무첨부 재시도 및 일반 지식 폴백
3. 학술 업로드에 이미지(PNG/JPEG/WebP) 허용 및 해상도 제한(3600x3600) 검증
4. 마인드맵 이미지에서 키워드를 추출하고 이를 기반으로 PDF 후보를 우선 선택
5. 채팅 첨부 업로드를 PDF/이미지 공통 업로드로 전환

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 첨부 제한/토큰 폴백, 이미지 업로드/검증 추가 |
| `src/components/AIConfigModal.tsx` | 학술 업로드 PDF+이미지 지원 |
| `src/components/AIChatSidebar.tsx` | 첨부 업로드 공통화 |
| `.agent/brain/task.md` | 체크리스트 갱신 |

---

## 🧪 검증

1. 로빈스/커밍스 요청 시 1048576 토큰 오류가 발생하지 않는지 확인
2. 마인드맵 이미지 업로드 후 관련 질문에서 이미지가 첨부되는지 확인

---

# Walkthrough: 학술 PDF 다중 매칭/폴백 응답 개선

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 업로드된 학술 PDF를 주제 기반으로 다중 매칭하여 활용
2. 주제 불일치 시 단일 폴백 PDF 사용을 중단하고 일반 지식 답변 제공
3. 매칭/로딩 로그로 진단 가능성 향상

---

## 🔍 원인 분석

- load_academic_knowledge에서 단일 PDF만 선택하도록 되어 있어 주제 불일치 시 잘못된 폴백 파일이 사용됨.
- 매칭 실패 시 "자료에 없음" 응답으로 이어져 일반 지식 답변이 차단됨.

---

## ✅ 해결 조치

1. `selectRelevantFilesForTopic()`을 다중 파일 반환으로 변경하고 상위 N개 선택
2. 매칭 실패 시 단일 폴백 PDF 사용 제거
3. 일반 지식 답변을 유도하는 시스템 지시 추가
4. 선택된 파일/전체 파일 로그 출력 추가

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 다중 PDF 매칭/로딩 및 폴백 응답 개선 |
| `.agent/brain/implementation_plan.md` | 작업 계획 갱신 |
| `.agent/brain/task.md` | 작업 체크리스트 갱신 |

---

## 🧪 검증

1. “SMART 원칙이 뭐야?” 질문 시 단일 폴백 PDF 사용 로그가 출력되지 않는지 확인
2. 매칭 실패 시 일반 지식 답변이 제공되는지 확인
3. 콘솔에서 선택된 파일 목록이 출력되는지 확인

---

# Walkthrough: AIChatSidebar UI 변경 미반영 이슈 분석/해결

## 완료 일시
2026-01-17

## 변경 사항 요약

### 🎯 목표
1. UI 변경이 반영되지 않는 원인 분석
2. CSS 중복 블록 제거 및 실제 스타일 적용
3. 재발 방지 규칙 추가(스킬 업데이트)

---

## 📊 MCP 조사 결과

### Context7 조사
| 출처 | 핵심 발견 |
|------|-----------|
| Vite 공식 문서 | CSS는 import 순서와 캐스케이드 규칙을 따르며 동일 셀렉터는 마지막 정의가 우선됨 |

### Tavily 조사
| 출처 | 핵심 발견 |
|------|-----------|
| CSS Debugging 가이드 | CSS가 적용되지 않을 때 중복/우선순위(캐스케이드) 확인을 최우선으로 수행 |

---

## 🔍 원인 분석

- `src/components/AIChatSidebar.css`에 **새 스타일 블록 뒤에 기존 Glassmorphism 스타일 블록이 통째로 중복**되어 있었음.
- 동일 셀렉터가 파일 하단에서 다시 정의되어 **기존 스타일이 우선 적용**됨.
- 결과적으로 UI 변경이 사용자에게 보이지 않음.

추가 확인:
- 배포 환경에서 `.chat-input-field`의 렌더 폭/높이가 0으로 계산되어 입력 필드가 보이지 않는 현상 확인.
- 입력 영역의 폭 축소를 방지하기 위해 `width`/`min-width` 보강 필요.
 - `src/App.css`의 `.left-panel button` 전역 스타일이 사이드바 내부 모든 버튼에 적용되어 입력 필드 공간을 잠식함.

---

## ✅ 해결 조치

1. 중복된 기존 스타일 블록을 제거
2. 파일 내 중복 헤더 문자열이 존재하지 않는지 확인
3. UI Design Patterns 스킬에 **CSS 중복 블록 방지 규칙** 추가
4. `.input-row`와 `.chat-input-field`에 폭/최소폭 보강 적용

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/AIChatSidebar.css` | 중복 블록 제거 및 캐스케이드 충돌 해소 |
| `.agent/skills/ui-design-patterns/SKILL.md` | CSS 중복 블록 방지 규칙 추가 |
| `.agent/brain/task.md` | 이슈 대응 체크리스트 갱신 |
| `.agent/brain/implementation_plan.md` | 리스크/대응 반영 |

---

## 🧪 검증

- `Premium Glassmorphism` 문자열이 CSS 파일에 없는지 확인
- 브라우저 DevTools에서 `.ai-chat-sidebar` 스타일이 새 정의로 적용되는지 확인

### 배포 자산 확인 (2026-01-17)
- 프로덕션 HTML에서 로딩된 CSS: `assets/index-rnmjKtiD.css`
- 해당 CSS에 `chat-footer { position: sticky; }` 규칙 포함 확인
- Vercel 최신 프로덕션 배포 커밋: `0780406` (fix: remove duplicate chat sidebar styles)

---

## ✅ 다음 단계

1. UI 변경 반영 확인(브라우저 새로고침/캐시 무효화)
2. 필요 시 배포 재빌드/재배포 확인

---

# Walkthrough: 설정 모달 디자인 미반영 해결

## 완료 일시
2026-01-17

## 변경 사항 요약

### 🎯 목표
1. 설정 모달 디자인이 기존 스타일로 보이는 원인 제거
2. AIConfigModal 전용 스타일의 우선순위 확보

---

## 🔍 원인 분석

- `.modal-header`, `.modal-body`, `.modal-footer` 등 범용 클래스가 다른 모달 CSS와 충돌할 가능성 높음.
- 로드 순서/캐스케이드에 의해 AIConfigModal 스타일이 덮어쓰기 되는 상황 발생 가능.

---

## ✅ 해결 조치

1. `src/components/AIConfigModal.css`의 셀렉터를 `.ai-config-modal` 스코프로 전부 한정
2. 전역/다른 모달 CSS가 영향 주지 않도록 우선순위 강화

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/AIConfigModal.css` | 모달 관련 셀렉터 전체 스코프화 |

---

## 🧪 검증

1. 설정 모달의 헤더/탭/버튼/토글 스타일이 스코프 내 규칙으로 적용되는지 확인
2. 다른 모달(예: Help/ConnectionGuide)과 스타일이 교차 적용되지 않는지 확인

---

# Walkthrough: 전역 모달 스타일 정비

## 완료 일시
2026-01-17

## 변경 사항 요약

### 🎯 목표
1. 전역 `.modal-*` 셀렉터 제거로 충돌 차단
2. 채팅 UI와 톤이 맞는 공통 모달 베이스 적용

---

## ✅ 해결 조치

1. 공통 모달 베이스 스타일 `ModalBase.css` 추가
2. Help/ConnectionGuide/Checkbox/Gateway 모달을 `.cm-modal-*` 클래스로 교체
3. 각 모달 CSS를 컴포넌트 스코프로 정리

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/ModalBase.css` | 공통 모달 스타일 추가 |
| `src/components/HelpModal.tsx` | 공통 모달 클래스 적용 |
| `src/components/HelpModal.css` | 스코프화 및 불필요 전역 제거 |
| `src/components/ConnectionGuideModal.tsx` | 공통 모달 클래스 적용 |
| `src/components/ConnectionGuideModal.css` | 스코프화 및 톤 업그레이드 |
| `src/components/CheckboxPopupModal.tsx` | 공통 모달 클래스 적용 |
| `src/components/CheckboxPopupModal.css` | 스코프화 및 버튼 톤 정리 |
| `src/components/Gateway.tsx` | 공통 모달 클래스 적용 |
| `src/components/Gateway.css` | 전역 모달 셀렉터 제거 및 레이아웃 보강 |
| `src/components/SessionManager.tsx` | 공통 모달 클래스 적용 |
| `src/components/SessionManager.css` | 스코프화 및 톤 업그레이드 |
| `src/components/MobileGestureGuide.tsx` | 공통 모달 클래스 적용 |
| `src/components/MobileGestureGuide.css` | 스코프화 및 톤 업그레이드 |

---

## 🧪 검증

1. 각 모달이 동일한 헤더 그라데이션/오버레이 톤으로 표시되는지 확인
2. 입력/복사/닫기 버튼의 hover·focus 상태 확인

---

# Walkthrough: 설정창 컨설팅 모드 전환

## 완료 일시
2026-01-17

## 변경 사항 요약

### 🎯 목표
1. 설정창에서 컨설팅 모드 전환 버튼 제공
2. 비밀번호 입력(대소문자 구분 없음) 필수화

---

## ✅ 해결 조치

1. `AIConfigModal`에 비밀번호 입력/전환 버튼 추가
2. `LiveblocksService.updateSessionType()`으로 세션 타입 갱신
3. 전환 성공 시 화면 리로드로 모드 반영

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/AIConfigModal.tsx` | 컨설팅 모드 전환 UI 및 검증 로직 추가 |
| `src/components/AIConfigModal.css` | 전환 UI 스타일 추가 |
| `src/services/LiveblocksService.ts` | 세션 타입 업데이트 메서드 추가 |

---

# Walkthrough: 배치 노드/연결 생성 + 좌표 이동 지원

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 노드와 연결선을 단일 호출로 생성
2. 좌표 기반 이동 지원
3. Gemini 프롬프트/컨텍스트에 배치 생성 규칙 반영

---

## ✅ 해결 조치

1. add_nodes_with_connections 도구 스키마 추가 및 propertyOrdering 적용
2. CultureMapFlow에서 배치 생성 및 tempId→실제 ID 매핑 처리
3. AI 컨텍스트에 노드 좌표 포함, 시스템 프롬프트에 배치/좌표 규칙 추가

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/actions.ts` | 배치 생성 도구/타입 및 스키마 추가 |
| `src/components/CultureMapFlow.tsx` | 배치 생성 실행 로직, 좌표 업데이트 반영 |
| `src/components/AIChatSidebar.tsx` | 노드 좌표 컨텍스트 및 배치 도구 안내 추가 |
| `src/services/AIService.ts` | 배치 생성/좌표 이동 규칙 및 예시 추가 |
| `src/utils/flowAutoLayout.ts` | 엣지 기반 정렬 개선(연결 흐름 반영) |

---

## 🧪 검증

1. 사용자 요청이 “노드+연결”을 포함할 때 add_nodes_with_connections 호출되는지 확인
2. 배치 생성 후 자동 정렬이 동작하는지 확인
3. update_node(x,y)로 좌표 이동이 반영되는지 확인

---

# Walkthrough: 학술 응답 누락(ContentUnion 관련) 복구

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 학술 지식 로드 후 응답이 끊기는 현상 해소
2. sendMessage 후속 응답 파싱을 SDK 규격에 맞춤

---

## ✅ 해결 조치

1. sendMessage 결과에서 response 기반으로 candidates/parts 추출
2. functionResponse 후속 응답도 동일 파싱 방식 적용

---

# Walkthrough: 도구 호출 누락(코드 출력) 방지 + 규칙/문서 최신화

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. AI가 도구 호출을 코드 텍스트로 출력하지 않도록 유도
2. "그렇게 해" 등 확인 응답을 실제 도구 실행으로 연결
3. MCP-VSCODE 기준으로 규칙/문서 최신화

---

## ✅ 해결 조치

1. AIService systemInstruction에 코드 출력 금지 및 확인 응답 트리거 규칙 추가
2. AIChatSidebar 컨텍스트에 도구 호출 코드 출력 금지 문구 추가
3. .cursorrules 및 .agent/brain 문서 업데이트

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 도구 호출 규칙 보강 (코드 출력 금지/확인 응답 트리거) |
| `src/components/AIChatSidebar.tsx` | 컨텍스트 경고 문구 추가 |
| `.cursorrules` | MCP-VSCODE 우선 규칙 반영 |
| `.agent/brain/implementation_plan.md` | 이슈 범위로 재정의 |
| `.agent/brain/task.md` | 본 작업 체크리스트로 재구성 |
| `.agent/brain/walkthrough.md` | 변경 요약 추가 |

---

## 🧪 검증

1. "노드를 생성해줘" 요청 시 function call 발생 확인
2. "그렇게 해" 응답 시 직전 제안 실행 확인

---

# Walkthrough: MCP-VSCODE 도구 선택 로직 재개편

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 현재 세션에서 사용 가능한 MCP 도구를 먼저 파악
2. MCP+VSCODE 문서에 도구 선택 로직을 반영

---

## ✅ 해결 조치

1. MCP 도구 스냅샷(목록 조회) 단계 추가
2. 작업 유형별 MCP 우선순위/대체 도구 매트릭스 추가
3. 세션 기준 사용 가능 도구 목록 섹션 추가

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `.agent/workflows/MCP-VSCODE.md` | 도구 선택 로직/스냅샷 단계 추가 |

---

## 🧪 검증

1. MCP 도구 목록 조회 결과에 따라 사용 가능 도구가 문서에 반영되는지 확인

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 후속 응답 파싱을 response 기반으로 통일 |

---

## 🧪 검증

1. load_academic_knowledge 호출 후 바로 답변이 출력되는지 확인
2. “찾았다/검색하겠다” 멘트만 남고 끊기는 현상이 사라지는지 확인

---

# Walkthrough: 미연결 업데이트 가드

## 완료 일시
2026-01-22

## 변경 사항 요약

### 🎯 목표
1. Liveblocks 미연결 상태에서 로컬-only 업데이트 차단
2. 데이터 유실 시나리오 방지

---

## ✅ 해결 조치

1. 주요 변경 경로에 `ensureLiveblocksConnected` 가드 추가
2. 경고 쿨다운 적용(3초)

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/CultureMapFlow.tsx` | 미연결 업데이트 가드 및 경고 쿨다운 추가 |

---

## 🧪 검증

1. 미연결 상태에서 노드/연결 변경이 차단되는지 확인
2. 연결 복구 후 정상 편집 가능한지 확인


# Walkthrough: 새로고침 시 세션 자동 재접속

## 완료 일시
2026-01-22

## 변경 사항 요약

### 🎯 목표
1. 새로고침 후 마지막 세션으로 자동 재접속
2. 나가기 선택 시 자동 재접속 해제

---

## ✅ 해결 조치

1. 마지막 세션 코드 저장/복구 로직 추가
2. 세션 나가기 시 저장값 제거

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/Gateway.tsx` | 마지막 세션 저장/복구 및 자동 재접속 |
| `src/components/CultureMapFlow.tsx` | 나가기 시 저장값 제거 |

---

## 🧪 검증

1. 세션 입장 후 새로고침 시 자동 재접속되는지 확인
2. 나가기 후 새로고침 시 게이트 화면이 보이는지 확인


# Walkthrough: 동기화 완료 후 IndexedDB 캐시 리셋

## 완료 일시
2026-01-22

## 변경 사항 요약

### 🎯 목표
1. Liveblocks 서버 동기화 완료 이후에만 로컬 캐시 제거
2. 브라우저별 캐시 불일치로 인한 구버전 표시 방지

---

## ✅ 해결 조치

1. `LiveblocksYjsProvider.on("sync")`에서 동기화 완료 시점 감지
2. `IndexeddbPersistence.clearData()`를 1회만 실행하도록 플래그 적용

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/LiveblocksService.ts` | 동기화 완료 후 IndexedDB 캐시 리셋 로직 추가 |

---

## 🧪 검증

1. 크롬/엣지 동시 접속 시 동일 상태 표시 확인
2. 새로고침 후 서버 최신 상태 유지 확인


# Walkthrough: DEV-LOCAL 채팅 내역 초기화

## 완료 일시
2026-01-22

## 변경 사항 요약

### 🎯 목표
1. DEV-LOCAL 세션의 채팅 기록 즉시 초기화
2. Liveblocks 채팅 스토리지와 AI 세션 히스토리 동시 리셋

---

## ✅ 해결 조치

1. `LiveblocksService.clearChatMessages()` 추가
2. `AIService.resetChatSession()` 추가
3. DEV-LOCAL 전용 초기화 버튼 추가 및 확인 팝업 적용

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/LiveblocksService.ts` | 채팅 메시지 초기화 메서드 추가 |
| `src/services/AIService.ts` | 채팅 세션/히스토리 리셋 메서드 추가 |
| `src/components/AIChatSidebar.tsx` | DEV-LOCAL 초기화 버튼/핸들러 추가 |
| `src/components/AIChatSidebar.css` | 초기화 버튼 스타일 추가 |

---

## 🧪 검증

1. DEV-LOCAL 접속 후 초기화 버튼 클릭 시 채팅이 비워지는지 확인
2. 초기화 직후 새 메시지 전송이 정상 동작하는지 확인


# Walkthrough: 세션 재접속 시 데이터 유지

## 완료 일시
2026-01-18

## 변경 사항 요약

### 🎯 목표
1. 로그아웃/재접속 시 마지막 상태가 유지되도록 복원
2. 세션 나가기 시 데이터 삭제 옵션 제거

---

## ✅ 해결 조치

1. 세션 나가기 시 데이터는 유지하도록 복원
2. delete_node 오용 방지 규칙 추가

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/CultureMapFlow.tsx` | 세션 나가기 시 데이터 유지 복원 |
| `src/services/AIService.ts` | delete_node 오용 방지 규칙 추가 |
| `src/types/actions.ts` | delete_node 도구 설명 강화 |

---

## 🧪 검증

1. 나가기 후 재접속 시 마지막 상태가 유지되는지 확인
2. delete_node가 명시적 요청 없이 호출되지 않는지 확인


# Walkthrough: 모델 목록/추론 설정 정비

## 완료 일시
2026-01-17

## 변경 사항 요약

### 🎯 목표
1. 사용 불가 모델(1.5/2.0) 제거 및 최신 모델 목록 제공
2. Gemini 2.5/3.0 모델의 추론 설정 자동 전환

---

## ✅ 해결 조치

1. `AIService.getAvailableGeminiModels()`에서 1.5/2.0 모델 제거
2. `AIService.getAvailableClaudeModels()`로 최신 Claude 모델 목록 제공
3. `getThinkingConfig()`로 모델 세대별 thinking 설정 자동 적용
4. 설정 모달 기본 모델/목록 최신화

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 모델 목록/정규화/추론 설정 자동화 |
| `src/components/AIConfigModal.tsx` | 모델 기본값/목록/설명 갱신 |

---

# Walkthrough: Gemini Function Calling mode 조건 오류 수정

## 완료 일시
2026-01-23

## 변경 사항 요약

### 🎯 목표
1. allowedFunctionNames를 mode=ANY에서만 전달하도록 수정
2. AUTO/NONE 모드에서도 내부 도구 제한 동작 유지

---

## 🔍 원인 분석

- @google/genai 문서상 allowedFunctionNames는 mode=ANY일 때만 허용되는데, AUTO 모드에서도 전달되어 400 INVALID_ARGUMENT 발생.

---

## ✅ 해결 조치

1. mode=ANY일 때만 allowedFunctionNames 포함
2. AUTO/NONE에서는 tools 선언을 이름 기준으로 필터링하여 내부 도구만 노출

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | functionCallingConfig 조건 분기 및 tools 필터링 적용 |
| `.agent/brain/implementation_plan.md` | 계획 섹션 추가 |
| `.agent/brain/task.md` | 체크리스트 추가 |

---

## 🧪 검증

1. 채팅 스트림 호출에서 400 INVALID_ARGUMENT 오류 재발 여부 확인
2. allowExternalTools=false 경로에서 내부 도구만 호출되는지 확인

---

# Walkthrough: 전체/1:1 채팅 분리

## 완료 일시
2026-01-23

## 변경 사항 요약

### 🎯 목표
1. 전체 채팅과 1:1 채팅 메시지가 섞이는 문제 해결
2. 탭별로 분리된 대화 목록 제공

---

## 🔍 원인 분석

- chatScope 탭은 존재했지만 메시지에 범위 정보가 없어서 필터링이 사용자/역할 기준으로만 수행됨.
- Liveblocks와 로컬 메시지가 동일 배열에서 렌더링되어 탭 간 대화가 섞임.

---

## ✅ 해결 조치

1. `ChatMessage.scope` 필드 추가 (group/direct)
2. Liveblocks 저장 메시지에 `scope: group` 지정
3. UI 필터를 scope 기반으로 변경하고 scope 미존재 시 group으로 보정
4. 로컬 메시지 생성 시 현재 탭 scope 기록

---

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/liveblocks.ts` | ChatMessage scope 타입/필드 추가 |
| `src/services/LiveblocksService.ts` | group 메시지 scope 저장 |
| `src/components/AIChatSidebar.tsx` | scope 기반 필터/로컬 메시지 분리 |
| `.agent/brain/implementation_plan.md` | 계획 섹션 추가 |
| `.agent/brain/task.md` | 체크리스트 추가 |

---

## 🧪 검증

1. 전체 탭에서 1:1 메시지가 보이지 않는지 확인
2. 1:1 탭에서 전체 메시지가 섞이지 않는지 확인
