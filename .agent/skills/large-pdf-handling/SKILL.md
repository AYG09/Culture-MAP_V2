---
name: 대용량 PDF 지식 로딩 가이드
description: Gemini File API로 대형 PDF를 효율적으로 읽고 타임아웃을 방지하는 패턴
lastUpdated: 2026-01-18
source: Gemini File API 문서(Context7) + 프로젝트 경험
applies_to: @google/genai, Gemini File API, PDF 처리
---

# 대용량 PDF 지식 로딩 가이드

대형 PDF(수백~천 페이지)를 AI가 읽을 때 **타임아웃**과 **불필요한 통독**을 방지하는 규칙입니다.

---

## 핵심 원칙

1. **File API 사용**: 대형 파일은 `ai.files.upload` 후 `createPartFromUri`로 참조합니다.
2. **주제 중심 탐색**: 전체 통독 대신, **주제 관련 섹션/챕터**를 우선 탐색하도록 프롬프트에 명시합니다.
3. **긴 응답 대기**: 파일 첨부/학술 지식 요청 시 타임아웃을 늘립니다.
4. **페이지 제한 준수**: PDF는 최대 1000페이지 권장(초과 시 제외 리스트 관리).

---

## ✅ 올바른 예시 (DO)

```ts
// 주제 중심 지시 + File API
const followUp = await chat.sendMessage({
  message: [
    { text: `[시스템] "${topic}" 관련 섹션만 요약하고, 장/절 제목을 제시해 주세요.` },
    createPartFromUri(file.uri, file.mimeType)
  ]
});
```

## ❌ 잘못된 예시 (DON'T)

```ts
// 전체 통독 지시 또는 모호한 질문
{ text: "PDF 전체를 전부 읽고 요약해줘" }
```

---

## 재발 방지 체크리스트

- [ ] File API로 업로드 후 URI 참조했는가?
- [ ] 주제/섹션 우선 탐색 지시가 포함됐는가?
- [ ] 파일 포함 요청 시 타임아웃을 연장했는가?
- [ ] 1000페이지 초과 PDF는 제외했는가?
