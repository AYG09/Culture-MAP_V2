# Claude Code 작업지시서: Gemini 모델 동적 조회 및 선택 로직 정비

## 배경

2026-05-19 기준 Google AI 공식 문서에서 `gemini-3.1-flash-lite`가 Stable 모델 코드로 공개되어 있다. 현재 앱은 Gemini 모델 목록을 동적으로 조회하는 코드가 일부 존재하지만, 기본 모델명과 필터링/별칭/프록시 설정에 특정 모델명이 하드코딩되어 있어 최신 호출 가능 모델을 안정적으로 반영하지 못할 수 있다.

공식 근거:
- Google AI Models 문서: Gemini 3.1 Flash-Lite Stable 항목 존재, 모델 코드 `gemini-3.1-flash-lite`
- Gemini 3.1 Flash-Lite 문서: Stable version `gemini-3.1-flash-lite`, Function calling/Structured outputs/Thinking 지원
- Gemini API `models.list`: API로 호출 가능 모델과 `supportedGenerationMethods`, token limits 등 메타데이터를 조회 가능

## 현재 코드 검토 결과

주요 파일:
- `src/services/AIService.ts`
- `src/components/AIConfigModal.tsx`
- `src/components/AIChatSidebar.tsx`
- `litellm-proxy/config.yaml`
- `playwright/helpers.ts`
- 관련 테스트: `src/components/__tests__/AIConfigModal.test.tsx`, `src/services/__tests__/AIService.academicGrounding.test.ts`

문제점:
- `AIService.getAvailableGeminiModels()`가 캐시가 없으면 하드코딩된 목록만 반환한다.
- 기본 모델이 여러 곳에서 `gemini-3.1-flash-lite-preview` 또는 `gemini-2.5-flash-lite`로 하드코딩되어 있다.
- `filterOfficialGeminiModels()`가 `^gemini-3`만 허용하므로, API에서 여전히 호출 가능한 `gemini-2.5-flash`, `gemini-2.5-pro`, 임베딩/특수 모델 등은 선택지에서 제외된다.
- 모델 필터가 이름 문자열만 보고 판단하며, `supportedGenerationMethods`의 `generateContent` 지원 여부를 확인하지 않는다.
- `normalizeModelConfig()`가 현재 동적 API 조회 결과가 아니라 정적 fallback 목록만 기준으로 저장 모델을 강제로 바꾼다.
- `resolveModelAlias()`가 `gemini-3.1-flash-lite-preview` 중심으로 매핑되어 있어 Stable `gemini-3.1-flash-lite`를 우선하지 않는다.
- `AIConfigModal.tsx`, `AIChatSidebar.tsx`에는 여전히 `gemini-2.5-flash-lite` fallback 라벨이 남아 있다.
- `litellm-proxy/config.yaml`은 완전히 정적이며 `gemini-3-pro-preview`처럼 공식 문서상 종료된 모델명도 포함한다.

## 목표

앱이 특정 Gemini 모델명을 전제로 동작하지 않도록 정비한다. API 키가 있으면 Gemini API의 `models.list()` 결과를 기준으로 현재 호출 가능한 모델을 가져오고, 사용자가 그중 원하는 모델을 선택할 수 있어야 한다. API 키가 없거나 조회 실패 시에만 최소 fallback을 사용한다.

## 권장 구현 방향

1. `AIService`에 모델 메타데이터 타입을 추가한다.
   - 예: `GeminiModelOption`
   - 필드: `id`, `name`, `displayName`, `description`, `inputTokenLimit`, `outputTokenLimit`, `supportedGenerationMethods`, `thinking`, `isPreview`, `family`, `priority`

2. `fetchAvailableModels()`를 문자열 배열이 아니라 메타데이터 배열 기반으로 재구성한다.
   - `this.geminiClient.models.list()` 결과에서 `name`, `baseModelId`, `displayName`, `supportedActions` 또는 `supportedGenerationMethods`, `inputTokenLimit`, `outputTokenLimit`, `thinking`을 수집한다.
   - `generateContent` 또는 SDK의 대응 필드인 `supported_actions`에 `generateContent`가 있는 모델만 채팅/분석용 선택지에 포함한다.
   - `models/` prefix는 저장/호출 시 일관되게 제거한다.

3. 모델 필터를 `gemini-3` 하드코딩에서 기능 기반 필터로 변경한다.
   - 포함 기준: `id.startsWith('gemini-')` 및 `generateContent` 지원.
   - 기본 UI 목록은 text generation에 적합한 모델을 우선 정렬한다.
   - 이미지/비디오/TTS/Live/embedding 전용 모델은 별도 용도 모델이므로 일반 채팅 모델 목록에서 제외하거나 비활성 그룹으로 분리한다.

4. 기본 모델 선택 로직을 동적으로 만든다.
   - API 조회 성공 시 우선순위:
     1. `gemini-3.1-flash-lite`
     2. `gemini-3.1-flash-lite-preview`
     3. `gemini-3-flash-preview`
     4. `gemini-2.5-flash-lite`
     5. 첫 번째 `generateContent` 지원 Gemini 모델
   - 단, 이 목록은 fallback 선호도일 뿐, 실제 선택 가능 여부는 `models.list()` 결과로 판단한다.

5. 별칭 매핑을 최신 Stable 우선으로 갱신한다.
   - `gemini-2.5-flash-lite` → 조회 결과에 있으면 그대로 유지, 없으면 `gemini-3.1-flash-lite`
   - `gemini-3.1-flash-lite-preview` → `gemini-3.1-flash-lite`가 있으면 Stable로 마이그레이션
   - `gemini-3-pro-preview` → `gemini-3.1-pro-preview`
   - 별칭 대상도 반드시 현재 조회된 available 목록에 있는 경우만 적용한다.

6. `AIConfigModal`을 개선한다.
   - 모달이 열리고 API 키가 있으면 최신 모델 목록을 비동기 조회한다.
   - 조회 중 로딩 상태를 표시한다.
   - 조회 실패 시 “모델 목록 조회 실패, fallback 목록 사용 중” 상태를 표시한다.
   - 저장된 모델이 현재 목록에 없으면 자동 대체 후보를 선택하되, 사용자에게 표시한다.
   - `gemini-2.5-flash-lite` 하드코딩 fallback을 제거한다.

7. 호출 경로의 fallback을 단일 상수/함수로 통합한다.
   - `createChatSession`, `analyzeWithPDF`, `callGemini`, `getModelTokenLimits`, sidebar label 등에서 각자 다른 문자열을 쓰지 않는다.
   - 예: `getCurrentModelName()` 또는 `getDefaultGeminiModelId(availableModels)`.

8. `litellm-proxy/config.yaml` 정비 여부를 결정한다.
   - 앱이 LiteLLM proxy를 실제로 사용하지 않는다면 README에 “수동 샘플”임을 명시한다.
   - 사용한다면 `gemini-3.1-flash-lite`를 추가하고 종료된 `gemini-3-pro-preview`를 제거 또는 `gemini-3.1-pro-preview`로 교체한다.

## 테스트 요구사항

추가/수정할 테스트:
- `models.list()` mock이 `gemini-3.1-flash-lite`를 반환하면 UI 선택 목록에 Stable 모델이 표시되는지.
- 저장된 값이 `gemini-3.1-flash-lite-preview`이고 Stable이 available이면 `gemini-3.1-flash-lite`로 마이그레이션되는지.
- `supportedGenerationMethods` 또는 `supportedActions`에 `generateContent`가 없는 모델은 일반 채팅 모델 목록에서 제외되는지.
- API 조회 실패 시 fallback 목록으로 동작하되, fallback의 첫 번째가 `gemini-3.1-flash-lite`인지.
- `gemini-3-pro-preview` 저장값이 있을 때 `gemini-3.1-pro-preview`로 대체되는지.

권장 실행:
- `npm test -- --run`
- `npm run build`

## Claude 모델 선택 권장

이 작업은 단순 문자열 교체가 아니라 SDK 응답 형태, UI 상태, 저장 설정 마이그레이션, 테스트 갱신이 얽혀 있다. **Sonnet 사용을 권장**한다.

Haiku가 적합한 경우:
- `litellm-proxy/config.yaml`만 최신 모델명으로 바꾸는 수준
- 테스트 없이 명확한 문자열 fallback만 정리하는 아주 작은 패치

Sonnet이 적합한 이유:
- 동적 모델 조회 로직을 기능 기반으로 재설계해야 한다.
- 기존 저장값 마이그레이션과 UI 선택 상태를 함께 다뤄야 한다.
- SDK의 모델 목록 응답 필드 차이(`supportedActions`, `supportedGenerationMethods`)를 방어적으로 처리해야 한다.
- 회귀 테스트를 함께 보강해야 한다.
