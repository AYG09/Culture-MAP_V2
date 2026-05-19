# Claude Code 추가 작업지시서: Gemini 3/2.5 Thinking 설정 분기 처리

## 배경

Gemini 모델 동적 조회를 확장하면 사용자가 Gemini 3 계열뿐 아니라 Gemini 2.5 계열 모델도 선택할 수 있다. Google 공식 문서 기준 Gemini 3 계열과 2.5 계열은 thinking 제어 파라미터가 다르다.

공식 근거:
- Gemini Thinking 문서: Gemini 2.5 계열은 `thinkingLevel`을 지원하지 않으며 `thinkingBudget`을 사용해야 한다.
- Gemini 3 Developer Guide: Gemini 3 계열은 `thinkingLevel` 사용을 권장하며, `thinkingBudget`은 하위 호환용으로만 받아들여질 수 있고 예측하기 어려운 성능을 낼 수 있다. 같은 요청에서 둘을 함께 쓰면 안 된다.
- OpenAI compatibility 문서: reasoning effort 대응도 Gemini 3은 `thinking_level`, Gemini 2.5는 `thinking_budget`으로 매핑된다.

참고 URL:
- https://ai.google.dev/gemini-api/docs/thinking
- https://ai.google.dev/gemini-api/docs/gemini-3
- https://ai.google.dev/gemini-api/docs/openai

## 현재 코드 상태

주요 파일:
- `src/services/AIService.ts`
- `src/components/AIConfigModal.tsx`
- 관련 테스트: `src/services/__tests__/AIService.academicGrounding.test.ts`, 필요 시 신규 테스트 파일

현재 `AIService.getThinkingConfig(modelName)` 구현은 다음 구조다.

- `gemini-3` 포함 모델이면:
  - `includeThoughts: true`
  - `thinkingLevel: 'HIGH'`
- 그 외 모델이면:
  - `null`

따라서 현 상태에서 2.5 모델을 선택했을 때 `thinkingLevel`이 전송되어 즉시 에러가 나는 구조는 아니다. 하지만 Gemini 2.5에 thinking 제어가 아예 적용되지 않으며, UI 문구는 “Gemini 2.5: thinkingBudget 기반 추론(자동 적용)”이라고 표시할 수 있어 실제 동작과 불일치한다.

또한 `thinkingLevel: 'HIGH'` 값이 SDK 타입에서 허용되더라도 공식 JavaScript 문서 예시는 `"high"`, `"low"` 등 소문자 문자열을 사용한다. SDK 타입을 확인해 실제 허용 값과 공식 문서 표기를 맞추는 것이 좋다.

## 리스크

동적 모델 조회가 2.5 모델까지 포함하도록 바뀐 뒤 다음 문제가 발생할 수 있다.

- 2.5 모델 선택 시 thinking 제어가 누락되어 UI 설명과 실제 호출이 다르다.
- 향후 공통 옵션으로 `thinkingLevel`을 무조건 넣도록 리팩터링하면 2.5 모델 호출이 실패할 수 있다.
- 3 계열에 `thinkingBudget`을 쓰거나, 2.5 계열에 `thinkingLevel`을 쓰거나, 둘을 동시에 넣는 회귀가 생길 수 있다.
- 2.5 Pro는 thinking을 끌 수 없고, 2.5 Flash/Flash-Lite는 `thinkingBudget: 0`으로 끌 수 있는 등 모델별 제약이 다르다.

## 목표

모델 ID와 모델 계열에 따라 올바른 `thinkingConfig`만 생성한다.

- Gemini 3 / 3.1 계열: `thinkingLevel`
- Gemini 2.5 계열: `thinkingBudget`
- 그 외 모델: thinkingConfig 생략
- 한 요청에 `thinkingLevel`과 `thinkingBudget`을 동시에 넣지 않는다.

## 권장 구현 방향

1. 모델 계열 판별 유틸리티를 추가한다.
   - 예:
     - `getGeminiModelFamily(modelName): 'gemini-3' | 'gemini-2.5' | 'other'`
     - `isGemini3Model(modelName)`
     - `isGemini25Model(modelName)`
   - 단순 `includes('gemini-3')`보다는 정규식 기반으로 `gemini-3`, `gemini-3.1`을 명확히 판별한다.

2. `getThinkingConfig()`를 계열별로 분기한다.
   - Gemini 3:
     - 기본값은 공식 권장에 맞춰 `thinkingLevel: 'high'` 또는 앱 설정에 따라 `'low' | 'medium' | 'high' | 'minimal'`
     - `includeThoughts`는 실제 UI에서 thought stream을 표시할 때만 유지한다.
   - Gemini 2.5:
     - 기본은 Google 기본 동작을 존중하기 위해 `thinkingConfig`를 생략하거나, 명시 제어가 필요하면 `thinkingBudget: -1`을 사용한다.
     - 비용/지연시간을 줄이는 앱 기본값이 필요하면 모델별로 다음을 검토한다.
       - 2.5 Pro: thinking off 불가. 명시 제어 시 `thinkingBudget: -1` 또는 허용 범위 내 양수.
       - 2.5 Flash: `0` 가능, `-1` dynamic 가능.
       - 2.5 Flash-Lite: 기본은 thinking 없음. 필요 시 `-1` dynamic 또는 허용 범위 내 budget.
   - Other:
     - `null`

3. 앱 차원의 reasoning preset을 도입할지 결정한다.
   - 예: `'default' | 'low' | 'medium' | 'high' | 'off'`
   - 매핑 예:
     - Gemini 3:
       - `default`: config 생략
       - `low`: `{ thinkingLevel: 'low' }`
       - `medium`: Flash/Flash-Lite에서만 `{ thinkingLevel: 'medium' }`, Pro는 `high` 또는 `low` 중 정책 결정
       - `high`: `{ thinkingLevel: 'high' }`
       - `off`: Gemini 3은 완전 off 불가. Flash/Flash-Lite는 `minimal`로 대체 가능
     - Gemini 2.5:
       - `default`: config 생략
       - `low`: `{ thinkingBudget: 1024 }`
       - `medium`: `{ thinkingBudget: 8192 }`
       - `high`: `{ thinkingBudget: 24576 }`
       - `off`: 2.5 Flash/Flash-Lite만 `{ thinkingBudget: 0 }`, 2.5 Pro는 불가하므로 config 생략 또는 경고

4. 현재 UI 문구를 실제 동작과 맞춘다.
   - `AIConfigModal.tsx`의 “Gemini 2.5: thinkingBudget 기반 추론(자동 적용)” 문구는 실제로 `thinkingBudget`을 넣을 때만 표시한다.
   - 기본 동작을 생략하는 정책이면 “모델 기본 thinking 설정 사용”처럼 표시한다.

5. 호출 경로 전체에 동일한 `getThinkingConfig()` 결과만 사용한다.
   - `createChatSession`
   - `analyzeWithPDF`
   - `callGemini`
   - 기타 `models.generateContent` 호출부

6. thought signature 처리 방식을 확인한다.
   - Google GenAI SDK를 그대로 쓰는 chat session에서는 SDK가 thought signature를 자동 처리한다고 문서에 설명되어 있다.
   - 단, 앱이 `chatHistory`를 직접 누적/재구성하고 있으므로 function calling이 포함된 멀티턴에서 SDK 자동 처리가 깨지지 않는지 확인한다.
   - 직접 history parts를 수정한다면 thought signature가 붙은 part를 누락/병합하지 않도록 주의한다.

## 테스트 요구사항

추가 테스트:
- `getThinkingConfig('gemini-3.1-flash-lite')`는 `thinkingLevel`만 포함하고 `thinkingBudget`은 포함하지 않는다.
- `getThinkingConfig('gemini-3-flash-preview')`는 `thinkingLevel`만 포함한다.
- `getThinkingConfig('gemini-2.5-flash')`는 정책에 따라 `thinkingBudget`만 포함하거나 `null`을 반환하되, `thinkingLevel`은 절대 포함하지 않는다.
- `getThinkingConfig('gemini-2.5-pro')`는 `thinkingBudget: 0`을 반환하지 않는다.
- `getThinkingConfig('gemini-2.5-flash-lite')`는 정책에 따라 `null`, `thinkingBudget: -1`, 또는 허용 범위 내 budget만 반환한다.
- 모든 generateContent/chat create 호출에서 `thinkingLevel`과 `thinkingBudget`이 동시에 전달되지 않는지 확인한다.

권장 실행:
- `npm run type-check`
- `npm test -- --run`
- `npm run build`

## Claude 모델 선택 권장

이 작업은 **Sonnet 권장**이다.

이유:
- Google 공식 문서의 모델별 제약을 코드 정책으로 옮겨야 한다.
- Gemini 3/2.5 모델 계열, Pro/Flash/Flash-Lite 세부 차이, UI 문구, 테스트가 함께 얽혀 있다.
- 잘못 구현하면 사용자가 선택한 모델에서 런타임 API 오류가 발생할 수 있다.

Haiku가 가능한 범위:
- 단순히 2.5 모델에 `thinkingLevel`을 보내지 않는 방어 테스트만 추가하는 수준
- UI 문구만 “모델 기본값 사용”으로 바꾸는 수준
