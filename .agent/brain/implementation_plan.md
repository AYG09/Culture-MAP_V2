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
