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
