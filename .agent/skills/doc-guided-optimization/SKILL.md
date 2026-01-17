---
name: 라이브러리 및 문서 기반 최적화 (Doc-Guided Optimization)
description: 라이브러리 공식 문서와 베스트 프랙티스를 기반으로 코드를 검토하고 최신 표준으로 최적화하는 절차
lastUpdated: 2026-01-17
source: 프로젝트 경험
applies_to: 모든 프로젝트
---

# 라이브러리 및 문서 기반 최적화 Skill

단순히 버전을 올리는 것을 넘어, 라이브러리 개발사가 권장하는 최신 패턴과 성능 최적화 기법을 코드에 반영합니다.

---

## 🎯 적용 시점

- 새로운 메이저 버전 라이브러리 도입 시
- 대규모 데이터 처리나 실시간 협업 로직 구현 시
- AI 모델 API 호출 최적화가 필요할 시
- "Clean Code"와 "High Performance"가 요구되는 핵심 모듈 작업 시

---

## ✅ 최적화 워크플로우

### 1단계: 공식 문서 기반 패턴 수집 (MCP 활용)
- **Context7**: 핵심 클래스/함수의 최신 시그니처와 예제 코드 수집
- **Tavily**: "Performance optimization", "Best practices 2025", "Memory leak prevention" 등의 키워드로 최신 블로그/벤치마크 검색

### 2단계: 패턴 대조 (Code Audit)
- **Anti-patterns**: `any` 타입 남용, 불필요한 리렌더링, 대량의 데이터 전역 상태 관리 등을 체크
- **Performance**: 메모이제이션(`React.memo`, `useMemo`), 가상화(Virtualization), 데이터 압축(V2 Encoding) 적용 여부 확인

### 3단계: 단계별 최적화 적용
1. **타입 안전성 확보**: `any` 타입을 구체적인 라이브러리 인터페이스로 교체
2. **성능 패치**: 렌더링 최적화 및 네트워크 트래픽 최적화(Batching) 적용
3. **API 고도화**: 더 효율적인 API 호출 방식(예: Yjs의 YKeyValue)으로 변경

### 4단계: 검증 및 벤치마크
- **Build**: 프로덕션 빌드 성공 여부 확인
- **Performance**: 렌더링 속도 또는 API 응답 속도 체감/측정

---

## 📝 주요 라이브러리 최적화 팁 (2025)

### 1. @google/genai (Gemini)

> ⚠️ **중요**: 상세 사용 가이드는 `.agent/skills/google-genai-sdk/SKILL.md` 참조

- **모델 선택**: `gemini-2.5-flash-lite` (기본), `gemini-3-flash` (최신)
- **Chat API 호출**:
  - `sendMessage({ message: string })` - 단일 텍스트
  - `sendMessageStream({ message: string | PartUnion[] })` - 스트리밍
  - ❌ **주의**: `{ parts: [...] }` 형식 사용 금지 (ContentUnion 오류 발생)
- **스트리밍 반환값**: 반환값 자체가 AsyncIterable (`.stream` 속성 없음)
  ```typescript
  const result = await chat.sendMessageStream({ message: 'Hi' });
  for await (const chunk of result) { console.log(chunk.text); }
  ```
- **Thinking 모델 설정**:
  - Gemini 2.x: `thinkingBudget: 1024` (테스트), `thinkingBudget: 8192` (프로덕션)
  - Gemini 3.x: `thinkingLevel: 'HIGH'`
- **Tool Calling**: `parametersJsonSchema` 사용 (구 `parameters` 아님)
- **세션 관리**: `chats.create()`로 세션을 유지하여 컨텍스트 토큰 절약
- **File API**: `ai.files.upload()`로 대형 컨텍스트 처리

### 2. Liveblocks & Yjs
- **V2 Encoding**: `yDoc.getMap('...').observe(...)` 대신 효율적인 동기화 인코딩 옵션 확인
- **YKeyValue**: 대량의 키-값 쌍 관리 시 `y-utility`의 `YKeyValue` 사용 권장
- **Presence**: `updateMyPresence` 호출 시 `throttle` 적용 고려

### 3. XYFlow (React Flow v12)
- **Custom Nodes**: 모든 커스텀 노드는 `useMemo`나 `React.memo`로 감싸기
- **Hiding Elements**: 뷰포트 밖의 요소는 렌더링하지 않는 옵션 활성화
- **Handles**: 불필요한 Handle 업데이트 방지

---

## ⚠️ 주의사항

1. **Breaking Changes**: 최적화 과정에서 API가 변경될 경우 반드시 영향 범위를 전체 검색(`grep_search`)하여 수정
2. **Regression**: 성능을 위해 가독성을 심하게 해치는 최적화는 지양
3. **Environment**: API 키나 환경 변수 설정 방식이 변경되었는지 확인
