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

## 📁 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 후속 응답 파싱을 response 기반으로 통일 |

---

## 🧪 검증

1. load_academic_knowledge 호출 후 바로 답변이 출력되는지 확인
2. “찾았다/검색하겠다” 멘트만 남고 끊기는 현상이 사라지는지 확인

---

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
