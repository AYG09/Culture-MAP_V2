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
