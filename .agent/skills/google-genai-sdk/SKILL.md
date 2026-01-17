---
name: Google GenAI SDK (@google/genai) 사용 가이드
description: Gemini 2.5/3.0 모델의 @google/genai SDK 사용 시 주요 함정과 올바른 패턴 정리
lastUpdated: 2026-01-17
source: Context7 (@google/genai 공식 문서), 프로젝트 경험
applies_to: @google/genai, Gemini API, TypeScript
---

# Google GenAI SDK (@google/genai) 사용 가이드

이 문서는 `@google/genai` SDK (2025.05~ GA 버전)를 사용할 때 발생하는 주요 오류와 올바른 해결 패턴을 정리합니다.

---

## 🚨 핵심 주의사항

### 1. SDK 버전 혼동 금지

| 패키지 | 상태 | 비고 |
|--------|------|------|
| `@google/generative-ai` | ❌ **Deprecated** | 2025년 이전 레거시 |
| `@google/genai` | ✅ **권장** | 2025.05~ GA, 통합 SDK |

**확인 방법:**
```bash
npm list @google/genai
npm list @google/generative-ai  # 이게 있으면 제거 필요
```

---

## ⚠️ 자주 발생하는 오류와 해결법

### 오류 1: `ContentUnion is required`

**원인**: `sendMessageStream`이나 `sendMessage` 호출 시 잘못된 파라미터 형식

**잘못된 코드:**
```typescript
// ❌ parts 배열을 직접 전달하면 안 됨
await chat.sendMessageStream(parts);

// ❌ { parts: [...] } 형식도 안 됨  
await chat.sendMessageStream({ parts: parts });
```

**올바른 코드:**
```typescript
// ✅ 단일 텍스트: { message: string } 형식
await chat.sendMessageStream({ message: 'Hello' });

// ✅ 파일 첨부 포함: { message: PartUnion[] } 형식
await chat.sendMessageStream({ message: parts });
```

---

### 오류 2: `Cannot read properties of undefined (reading 'Symbol(Symbol.asyncIterator)')`

**원인**: `sendMessageStream` 반환값에서 `.stream` 속성 접근 시도

**잘못된 코드:**
```typescript
// ❌ .stream 속성이 없음 (구 SDK 패턴)
const result = await chat.sendMessageStream({ message: 'Hi' });
for await (const chunk of result.stream) { ... }
```

**올바른 코드:**
```typescript
// ✅ 반환값 자체가 AsyncIterable
const result = await chat.sendMessageStream({ message: 'Hi' });
for await (const chunk of result) {
  console.log(chunk.text);
}
```

---

### 오류 3: Tool Calling 시 `parametersJsonSchema` vs `parameters`

**원인**: SDK 버전에 따라 함수 선언 스키마 형식이 다름

**올바른 코드 (v2.0+):**
```typescript
const tools = [{
  functionDeclarations: [{
    name: 'add_node',
    description: '노드를 추가합니다',
    parametersJsonSchema: {  // ✅ parametersJsonSchema 사용
      type: 'object',
      properties: {
        label: { type: 'string', description: '노드 레이블' }
      },
      required: ['label']
    }
  }]
}];
```

---

## � 모델별 Function Calling 지원 여부 (2026.01 기준)

> ⚠️ **중요**: 2.0 버전과 2.5 버전은 완전히 다릅니다!

| 모델 | Function Calling | Parallel | Compositional | 권장 용도 |
|------|------------------|----------|---------------|-----------|
| **gemini-2.5-flash-lite** | ✅ | ✅ | ✅ | 저비용/고속 챗봇 **(기본 권장)** |
| gemini-2.5-flash | ✅ | ✅ | ✅ | 균형 잡힌 성능 |
| gemini-2.5-pro | ✅ | ✅ | ✅ | 복잡한 추론 |
| gemini-3-flash | ✅ | ✅ | ✅ | 초고속 에이전틱 |
| gemini-3-pro | ✅ | ✅ | ✅ | 플래그십 |
| gemini-2.0-flash | ✅ | ✅ | ✅ | 2세대 표준 |
| gemini-2.0-flash-lite | ❌ | ❌ | ❌ | **도구 사용 불가!** |
| gemini-1.5-flash | ✅ | ✅ | ❌ | 레거시 호환 |

### 🚨 흔한 실수: 2.0-flash-lite vs 2.5-flash-lite

```
❌ gemini-2.0-flash-lite → Function Calling 미지원 (도구 호출 불가!)
✅ gemini-2.5-flash-lite → Function Calling 완벽 지원 (권장 모델)
```

버전 숫자 하나 차이로 도구 사용 가능 여부가 완전히 달라집니다.

---

## �🧠 Thinking Mode 설정

### Gemini 2.5 계열
```typescript
thinkingConfig: {
  includeThoughts: true,
  thinkingBudget: 1024  // E2E 테스트 시 낮게, 프로덕션은 8192+ 권장
}
```

### Gemini 3.0 계열
```typescript
thinkingConfig: {
  includeThoughts: true,
  thinkingLevel: 'HIGH'  // 'LOW', 'MEDIUM', 'HIGH'
}
```

---

## 📝 스트리밍 응답 파싱 패턴

```typescript
for await (const chunk of streamResult) {
  // 1. 텍스트 추출 (가장 간단한 방법)
  const text = chunk.text || '';
  
  // 2. 상세 파싱 (사고 과정, 함수 호출 등)
  const candidates = (chunk as any).candidates;
  const parts = candidates?.[0]?.content?.parts || [];
  
  for (const part of parts) {
    if (part.thought) {
      // Thinking 모델의 사고 과정
      console.log('Thought:', part.text);
    } else if (part.text) {
      // 일반 텍스트 응답
      console.log('Text:', part.text);
    } else if (part.functionCall) {
      // 함수 호출 요청
      console.log('Function:', part.functionCall.name);
    }
  }
}
```

---

## 🔧 디버깅 체크리스트

문제 발생 시 순서대로 확인:

1. **패키지 버전 확인**
   ```bash
   npm list @google/genai
   ```

2. **API 호출 형식 확인**
   - `{ message: ... }` 형식 사용 여부
   - 반환값 직접 순회 여부

3. **Context7 문서 조회**
   ```
   mcp_context7_resolve-library-id: "@google/genai"
   mcp_context7_query-docs: "sendMessageStream message format example"
   ```

4. **브라우저 콘솔 로그**
   - Vite 번들 경로에서 에러 발생 위치 확인
   - `@google_genai.js` 내부 `tContent` 함수 호출 확인

---

## 📚 참고 자료

- [공식 GitHub](https://github.com/googleapis/js-genai)
- [API Reference](https://googleapis.github.io/js-genai/)
- Context7 Library ID: `/googleapis/js-genai`
