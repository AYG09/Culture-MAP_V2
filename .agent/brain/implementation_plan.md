# Implementation Plan: 학술 PDF 다중 매칭 + 폴백 응답 개선

## 목표
1. load_academic_knowledge에서 업로드된 다중 PDF를 주제 기반으로 매칭해 활용
2. 주제 불일치 시 단일 폴백 PDF 사용을 중단하고 일반 지식 답변을 제공
3. 매칭/로딩 흐름을 로그로 명확히 하여 진단 가능성 향상

---

## 핵심 변경 범위

### 1) 학술 PDF 선택 로직
- `selectRelevantFilesForTopic()`을 배열 반환으로 변경
- 키워드/주제 스코어링 기반 상위 N개 선택
- 대용량 PDF 제외 규칙 유지

### 2) load_academic_knowledge 처리
- 선택된 복수 PDF를 PartUnion으로 전달
- 매칭 실패 시 static knowledge + 일반 지식 응답 유도
- 선택된 파일 목록과 전체 파일 목록 로그 추가

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 다중 PDF 로딩으로 토큰 증가 | 응답 지연/비용 증가 | 상위 N개 제한(기본 2개) 유지 |
| 매칭 실패 시 품질 저하 | 빈약한 답변 가능성 | static knowledge 요약 + 일반 지식 안내 프롬프트 사용 |
| 잘못된 파일 매칭 | 근거 왜곡 | 키워드/저자 매칭 스코어 개선 및 로그로 확인 |

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
2. 매칭 실패 시 일반 지식 답변이 제공되는지 확인
3. 콘솔에서 선택된 파일 목록이 출력되는지 확인
