# Claude Code 작업지시서: Gemini Reasoning Preset UI 구현

## 배경

현재 Gemini 모델 선택 로직은 동적 모델 조회와 모델 계열별 thinking 설정을 안정성 중심으로 정리했다.

현재 정책:
- Gemini 3 / 3.1 계열: `thinkingConfig.thinkingLevel = 'high'`
- Gemini 2.5 계열: `thinkingConfig` 생략, Google 모델 기본값 사용
- 그 외 모델: `thinkingConfig` 생략

이 정책은 API 오류를 피하는 데는 안전하지만, 사용자가 비용/지연시간/품질을 직접 조절할 수 없다. 특히 Gemini 3과 2.5는 thinking 제어 파라미터가 서로 다르므로, 모델별 API 차이를 사용자가 알 필요 없이 “빠름/균형/깊게/기본값” 같은 reasoning preset으로 추상화하는 UI가 필요하다.

공식 근거:
- Gemini 3 계열: `thinkingLevel` 사용 권장
- Gemini 2.5 계열: `thinkingBudget` 사용
- 한 요청에서 `thinkingLevel`과 `thinkingBudget`을 동시에 사용하면 안 됨
- 2.5 Flash-Lite는 기본적으로 thinking을 하지 않으며, `thinkingBudget: -1`을 주면 dynamic thinking이 켜질 수 있음

참고:
- https://ai.google.dev/gemini-api/docs/thinking
- https://ai.google.dev/gemini-api/docs/gemini-3
- https://ai.google.dev/gemini-api/docs/openai

## 목표

AI 설정 모달에서 사용자가 reasoning preset을 선택할 수 있게 한다. 앱은 선택된 preset과 현재 모델 계열을 조합해 올바른 Gemini `thinkingConfig`를 생성해야 한다.

사용자는 Gemini 3인지 2.5인지, `thinkingLevel`인지 `thinkingBudget`인지 몰라도 된다.

## UX 요구사항

위치:
- `src/components/AIConfigModal.tsx`
- “모델 선택” 아래 또는 바로 다음 섹션

컨트롤:
- select 또는 segmented control
- 권장: compact select. 설정 모달은 이미 입력 항목이 많으므로 과도한 카드형 UI는 피한다.

프리셋:
- `default`: 모델 기본값
- `fast`: 빠름 / 낮은 지연
- `balanced`: 균형
- `deep`: 깊게

선택지는 모든 모델에 동일하게 보여도 되지만, 설명 문구는 모델 계열에 따라 달라져야 한다.

예시 문구:
- Gemini 3:
  - default: 모델 기본값
  - fast: 낮은 thinkingLevel
  - balanced: 중간 thinkingLevel, 지원 모델에서만 적용
  - deep: 높은 thinkingLevel
- Gemini 2.5:
  - default: 모델 기본값
  - fast: 낮은 thinkingBudget
  - balanced: 중간 thinkingBudget
  - deep: 높은 thinkingBudget

주의:
- 화면에 API 내부 파라미터를 길게 설명하지 않는다.
- 현재처럼 “thinkingLevel=high 자동 적용” 같은 문구는 개발자에게는 유용하지만 일반 사용자에게는 노출을 줄인다.
- 설정 저장 후 재오픈 시 preset이 유지되어야 한다.

## 데이터 모델

`AIConfig`에 필드 추가:

```ts
export type ReasoningPreset = 'default' | 'fast' | 'balanced' | 'deep';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  tavilyApiKey?: string;
  modelName?: string;
  reasoningPreset?: ReasoningPreset;
  ragSearchScope?: RagSearchScope;
  autoExecuteFunctionCalls?: boolean;
  sharedApiKeyMode?: boolean;
}
```

마이그레이션:
- 기존 localStorage 설정에는 `reasoningPreset`이 없다.
- 없으면 `'default'`로 처리한다.
- 저장 시에는 명시적으로 포함한다.

## Thinking 매핑 정책

`getThinkingConfig(modelName, reasoningPreset)` 형태로 변경한다.

### Gemini 3 / 3.1

기본 정책:
- `default`: `null` 또는 Google 기본값 사용. 단 현재 앱이 thought stream 표시를 위해 `includeThoughts`를 필요로 한다면 `{ includeThoughts: true }`만 허용 가능한지 SDK 동작을 확인한다.
- `fast`: `{ includeThoughts: true, thinkingLevel: 'low' }`
- `balanced`: 
  - Gemini 3 Flash / Flash-Lite: `{ includeThoughts: true, thinkingLevel: 'medium' }`
  - Gemini 3 Pro 계열: Pro가 `medium`을 지원하지 않는 경우 `{ includeThoughts: true, thinkingLevel: 'high' }` 또는 `{ thinkingLevel: 'low' }` 중 정책 결정
- `deep`: `{ includeThoughts: true, thinkingLevel: 'high' }`

주의:
- Gemini 3 Pro와 Gemini 3 Flash/Flash-Lite의 지원 level이 다를 수 있으므로 모델명 기준 세부 분기 필요
- Gemini 3에서는 `thinkingBudget`을 넣지 않는다.
- `thinkingLevel` literal은 공식 JS 예시 기준 소문자 사용

### Gemini 2.5

기본 정책:
- `default`: `null`, 모델 기본값 사용
- `fast`: `{ includeThoughts: true, thinkingBudget: 1024 }`
- `balanced`: `{ includeThoughts: true, thinkingBudget: 8192 }`
- `deep`: `{ includeThoughts: true, thinkingBudget: 24576 }`

주의:
- 2.5 Pro는 thinking off 불가. 이번 preset에는 `off`를 만들지 않는다.
- 2.5 Flash-Lite에서 `default`는 반드시 `null`이어야 한다. 저비용/저지연 모델의 기본 동작을 보존한다.
- Gemini 2.5에서는 `thinkingLevel`을 넣지 않는다.

### Other

- 항상 `null`

## 구현 세부사항

수정 대상:
- `src/services/AIService.ts`
- `src/components/AIConfigModal.tsx`
- `src/components/AIChatSidebar.tsx` 필요 시 현재 preset 표시
- 테스트 파일

구현 포인트:
- `normalizeModelConfig()`에서 `reasoningPreset` 기본값을 `'default'`로 보정
- `setConfig()` 저장 시 preset 포함
- 모든 `getThinkingConfig(modelName)` 호출부를 `getThinkingConfig(modelName, this.currentConfig?.reasoningPreset)`로 변경
- 모델 변경 시 preset은 유지한다. 단 해당 모델에서 의미가 달라지는 경우 설명 문구만 변경한다.
- UI에서 preset 저장 누락이 없도록 `handleSave()`에 포함

## 테스트 요구사항

서비스 테스트:
- 기존 설정에 `reasoningPreset`이 없으면 `default`로 보정된다.
- Gemini 3 + `fast` → `thinkingLevel: 'low'`, `thinkingBudget` 없음
- Gemini 3 + `deep` → `thinkingLevel: 'high'`, `thinkingBudget` 없음
- Gemini 2.5 + `default` → `null`
- Gemini 2.5 + `balanced` → `thinkingBudget: 8192`, `thinkingLevel` 없음
- Gemini 2.5 Flash-Lite + `default` → `null`
- unknown model + any preset → `null`
- 어떤 조합에서도 `thinkingLevel`과 `thinkingBudget`이 동시에 들어가지 않는다.

UI 테스트:
- 설정 모달에 reasoning preset select가 표시된다.
- preset 선택 후 저장하면 `aiService.setConfig()`에 `reasoningPreset`이 포함된다.
- 기존 config에 preset이 있으면 모달 재오픈 시 값이 유지된다.
- 모델이 3.x일 때와 2.5일 때 설명 문구가 서로 다르다.

검증:
- `npm run type-check`
- `npm test -- --run`
- `npm run build`

## 품질 기준

- 모델별 API 차이를 사용자에게 노출하지 않고 preset으로 추상화한다.
- API 요청에는 반드시 현재 모델 계열에 맞는 thinking 파라미터만 들어간다.
- `default` preset은 모델의 기본 동작을 존중한다.
- 2.5 Flash-Lite 기본 선택 시 비용/지연 특성을 망가뜨리지 않는다.
- UI는 설정 모달의 기존 밀도와 스타일을 유지한다.

## Claude 모델 선택 권장

**Sonnet 권장.**

이 작업은 UI, 저장 설정 마이그레이션, 모델 계열별 API 매핑, 테스트가 함께 얽혀 있다. Haiku는 문구 수정이나 단일 테스트 보강 정도에는 가능하지만, 전체 기능 구현에는 Sonnet이 적합하다.
