# Claude Code 추가 작업지시서: Gemini 모델 동적 선택 품질 보완

## 배경

Sonnet 4.6 작업 후 리뷰 결과, 타입 검사와 빌드는 통과했고 `src` 단위 테스트도 통과했다. 그러나 실제 사용 시 모델 선택 정책과 동적 조회 설계가 충돌하는 부분이 남아 있어 커밋 전 보완이 필요하다.

검증 결과:
- `npm run type-check`: 통과
- `npx vitest run src`: 통과
- `npm run build`: 통과
- `npm test -- --run`: 실패. 변경분 문제가 아니라 기존 `playwright/*.spec.ts`가 Vitest 수집 대상에 포함되어 Playwright test API 오류가 발생한다.

공식 근거:
- Gemini 3 계열은 `thinkingLevel` 사용 권장
- Gemini 2.5 계열은 `thinkingBudget` 사용
- Gemini 3에 `thinkingBudget`은 하위 호환용이며 권장되지 않음
- 한 요청에 `thinkingLevel`과 `thinkingBudget`을 동시에 쓰면 안 됨

참고:
- https://ai.google.dev/gemini-api/docs/thinking
- https://ai.google.dev/gemini-api/docs/gemini-3
- https://ai.google.dev/gemini-api/docs/openai

## 반드시 수정할 문제

### 1. 사용자가 2.5 모델을 선택해도 3.x로 강제 마이그레이션될 수 있음

현재 `resolveModelAlias()`는 다음처럼 2.5 모델을 3.x 모델로 자동 대체한다.

- `gemini-2.5-flash-lite` → `gemini-3.1-flash-lite`
- `gemini-2.5-flash` → `gemini-3-flash-preview`
- `gemini-2.5-pro` → `gemini-3.1-pro-preview`

이 로직은 “저장된 과거 모델명이 더 이상 사용 불가할 때 대체”에는 유효할 수 있지만, 동적 조회 결과에 2.5 모델이 포함되어 사용자가 명시적으로 선택한 경우까지 3.x로 바꿔버릴 수 있다.

요구사항:
- 사용자가 현재 `models.list()` 결과에 있는 2.5 모델을 선택하면 그 선택을 유지해야 한다.
- alias migration은 “선택/저장된 모델이 available에 없을 때만” 수행해야 한다.
- `validateModelAvailability()`와 `normalizeModelConfig()` 모두 같은 정책을 따라야 한다.

권장 로직:

```ts
const normalizedPreferred = normalizeModelId(preferredModel);
if (available.includes(normalizedPreferred)) {
  return normalizedPreferred;
}
return resolveUnavailableModelAlias(normalizedPreferred, available);
```

테스트 추가:
- available에 `gemini-2.5-flash-lite`와 `gemini-3.1-flash-lite`가 모두 있을 때, `normalizeModelConfig({ modelName: 'gemini-2.5-flash-lite' })`가 `gemini-2.5-flash-lite`를 유지해야 한다.
- available에 `gemini-2.5-flash-lite`가 없고 `gemini-3.1-flash-lite`만 있을 때만 3.1로 대체해야 한다.

### 2. `supportedGenerationMethods` 빈 배열을 generateContent 지원으로 간주하는 정책이 위험함

현재 `filterOfficialGeminiModels()`는 SDK 응답의 `supportedGenerationMethods`가 빈 배열이면 generateContent 지원으로 간주한다. 이 때문에 실제로는 텍스트 생성이 불가능한 모델이 일반 채팅 모델 목록에 들어갈 수 있다.

문제 예:
- 테스트에서 `{ id: 'imagen-3', supportedGenerationMethods: [] }`를 넣고 있지만, 이름 필터로만 제외된다.
- 새로운 특수 모델이 이름 패턴에 걸리지 않으면 잘못 포함될 수 있다.

요구사항:
- 모델 메타데이터 객체로 들어온 경우에는 `supportedGenerationMethods` 또는 `supportedActions`가 명시적으로 존재하면 반드시 `generateContent` 포함 여부를 기준으로 필터링한다.
- 필드 자체가 SDK에서 제공되지 않은 경우에만 fallback 정책을 적용한다.
- fallback 정책은 보수적으로 해야 한다. 가능하면 모델 ID allow pattern을 함께 사용한다.

권장:
- `methods === undefined`: SDK 필드 누락으로 보고 이름 기반 fallback 허용
- `methods.length === 0`: 지원 메서드 없음으로 보고 제외
- `methods.includes('generateContent')`: 포함

테스트 수정:
- `{ id: 'gemini-3.1-flash-lite', supportedGenerationMethods: [] }`는 제외되어야 한다.
- `{ id: 'gemini-3.1-flash-lite' }`처럼 필드가 아예 없을 때만 fallback 허용 여부를 별도 테스트한다.

### 3. Gemini 3 `thinkingLevel` 값은 공식 문서 표기와 맞춰 소문자 사용 검토

현재 구현:

```ts
thinkingLevel: 'HIGH' as ThinkingConfig['thinkingLevel']
```

Google 공식 JavaScript 예시는 `"high"`, `"low"`, `"medium"`, `"minimal"` 소문자를 사용한다. SDK 타입이 대문자를 허용하더라도 REST/문서 표기와 달라 런타임 호환성 리스크가 있다.

요구사항:
- `@google/genai` 타입 정의 또는 실제 SDK 문서를 확인해 허용 값을 확정한다.
- 가능하면 공식 예시에 맞춰 `thinkingLevel: 'high'`로 변경한다.
- UI 문구도 `HIGH 자동 적용` 대신 `high 자동 적용` 또는 `고수준 추론 자동 적용`처럼 API literal과 혼동되지 않게 조정한다.

테스트:
- Gemini 3 모델의 `thinkingLevel`이 공식 권장 literal과 일치하는지 검증한다.

### 4. 2.5 Flash-Lite에 `thinkingBudget: -1`을 강제하는 정책 재검토

Google 문서상 2.5 Flash-Lite 기본값은 “Model does not think”이고, `thinkingBudget: -1`은 dynamic thinking을 켠다. 현재 구현은 2.5 계열 전체에 `thinkingBudget: -1`을 넣으므로, 사용자가 저비용/저지연 목적으로 Flash-Lite를 선택해도 thinking이 켜질 수 있다.

요구사항:
- 앱 기본 정책을 명확히 정한다.
- 보수적 권장안: `default` preset에서는 2.5 모델에 thinkingConfig를 생략해 Google 모델 기본값을 따른다.
- 명시적 추론 설정 UI가 없다면 `thinkingBudget: -1` 자동 강제는 피한다.

권장 정책:
- Gemini 3: 현재처럼 `thinkingLevel`을 명시할지, 기본값 생략을 쓸지 결정
- Gemini 2.5: 기본값은 `null`, 추후 reasoning preset UI를 추가할 때 `thinkingBudget` 매핑
- 2.5 Flash-Lite: 기본값 유지가 특히 중요

테스트:
- `getThinkingConfig('gemini-2.5-flash-lite')`는 기본 정책에서 `null`을 반환하거나, 명시적으로 선택된 preset이 있을 때만 `thinkingBudget`을 반환해야 한다.

### 5. 테스트가 구현을 충분히 검증하지 못함

현재 `AIConfigModal.test.tsx`의 “generateContent를 지원하지 않는 모델은 선택 목록에 없다” 테스트는 mock이 이미 필터링된 목록만 반환하므로 실제 필터 로직을 검증하지 않는다.

요구사항:
- 필터 로직은 `AIService.modelResolution.test.ts`에서 직접 검증한다.
- UI 테스트는 “서비스가 반환한 목록을 표시한다”와 “조회 실패 시 fallback 안내” 정도로 역할을 좁힌다.
- private 메서드를 `as any`로 직접 테스트하는 방식은 유지하더라도, 핵심 정책은 public 메서드 경유 테스트도 추가한다.

### 6. Vitest가 Playwright spec을 수집하는 문제 정리

`npm test -- --run`이 Playwright 파일 때문에 실패한다. 이번 변경의 직접 원인은 아니지만, CI 또는 로컬 검증 기준을 흐리게 만든다.

요구사항:
- `vitest.config` 또는 `package.json` test script에서 `src/**/*.{test,spec}.{ts,tsx}`만 대상으로 제한한다.
- 또는 Playwright spec 경로를 Vitest exclude에 추가한다.
- 이후 `npm test -- --run`이 통과하도록 만든다.

## 커밋 기준

아래가 모두 만족되기 전에는 커밋하지 않는다.

- 사용자가 available 목록에 있는 2.5 모델을 선택하면 2.5 모델이 유지된다.
- unavailable legacy 모델만 alias migration된다.
- `supportedGenerationMethods: []`인 모델은 generateContent 가능 모델로 간주하지 않는다.
- Gemini 3 thinking literal이 공식 문서/SDK 타입과 일치한다.
- 2.5 Flash-Lite에 dynamic thinking을 강제하지 않는 정책이 반영된다.
- `npm run type-check` 통과
- `npm test -- --run` 통과 또는 Vitest/Playwright 분리 후 각 테스트 스크립트 기준이 명확함
- `npm run build` 통과

## Claude 모델 선택 권장

**Sonnet 권장.**

이 작업은 단순 테스트 수정이 아니라 사용자 선택 보존, unavailable 모델 마이그레이션, 모델 capability 필터링, thinking 비용/지연 정책을 함께 조정해야 한다. Haiku로 처리하기에는 회귀 가능성이 높다.
