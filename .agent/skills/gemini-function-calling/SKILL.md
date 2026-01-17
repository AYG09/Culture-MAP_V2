---
name: Gemini Function Calling 규칙
description: Gemini API Function Calling 스키마 작성 시 필수 규칙
lastUpdated: 2026-01-17
source: Context7 (@google/genai SDK 공식 문서)
applies_to: @google/genai, Gemini API, Function Calling
---

# Gemini Function Calling 규칙

이 문서는 Context7을 통해 확인된 `@google/genai` SDK 공식 문서 기반의 Function Calling 규칙입니다.

---

## 1. 스키마 필수 요소

### 1.1 propertyOrdering (필수)

**공식 문서 출처**: js-genai `FunctionDeclaration.html`

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "integer" }
  },
  "additionalProperties": false,
  "required": ["name", "age"],
  "propertyOrdering": ["name", "age"]
}
```

**규칙**: 모든 `parametersJsonSchema`에 `propertyOrdering` 배열을 **반드시** 포함해야 합니다.

### 1.2 required 배열 (필수)

필수 파라미터는 `required` 배열에 명시합니다.

```typescript
const functionDeclaration = {
  name: 'controlLight',
  parameters: {
    type: Type.OBJECT,
    properties: {
      brightness: { type: Type.NUMBER },
      colorTemperature: { type: Type.STRING }
    },
    required: ['brightness', 'colorTemperature']  // 필수!
  }
};
```

---

## 2. 올바른 FunctionDeclaration 패턴

### 2.1 TypeScript 패턴 (권장)

```typescript
import { Type, FunctionDeclaration } from '@google/genai';

const addNodeDeclaration: FunctionDeclaration = {
  name: 'add_node',
  description: '문화 맵에 새 노드를 추가합니다',
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: {
        type: Type.STRING,
        description: '노드 레이블 (예: "고객 중심 가치")'
      },
      layer: {
        type: Type.NUMBER,
        description: '층위 번호 (1=결과, 2=행동, 3=유형레버, 4=무형레버)'
      }
    },
    required: ['label', 'layer'],
    propertyOrdering: ['label', 'layer']
  }
};
```

### 2.2 JSON Schema 패턴

```typescript
const addNodeDeclaration = {
  name: 'add_node',
  description: '문화 맵에 새 노드를 추가합니다',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: '...' },
      layer: { type: 'number', enum: [1, 2, 3, 4] }
    },
    required: ['label', 'layer'],
    propertyOrdering: ['label', 'layer']
  }
};
```

---

## 3. 흔한 실수 및 수정

### ❌ 잘못된 예시

```typescript
// propertyOrdering 누락
parametersJsonSchema: {
  type: 'object',
  properties: { label: {...}, layer: {...} },
  required: ['label', 'layer']
  // propertyOrdering 없음!
}
```

### ✅ 올바른 예시

```typescript
parametersJsonSchema: {
  type: 'object',
  properties: { label: {...}, layer: {...} },
  required: ['label', 'layer'],
  propertyOrdering: ['label', 'layer']  // 추가!
}
```

---

## 4. FunctionCallingConfigMode

| 모드 | 설명 |
|------|------|
| `AUTO` | 모델이 자동으로 도구 호출 여부 결정 (권장) |
| `ANY` | 강제로 도구 호출 |
| `NONE` | 도구 호출 비활성화 |

```typescript
toolConfig: {
  functionCallingConfig: {
    mode: FunctionCallingConfigMode.AUTO
  }
}
```

---

## 5. 체크리스트

Function Calling 스키마 작성 시:

- [ ] `propertyOrdering` 배열 포함?
- [ ] `required` 배열에 필수 파라미터 명시?
- [ ] `type: 'object'` 명시?
- [ ] 각 속성에 `description` 포함?
- [ ] `enum`으로 선택지 제한 (해당 시)?
