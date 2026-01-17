---
name: SDK/라이브러리 버전 검증
description: 기존 코드의 SDK/라이브러리가 deprecated되지 않았는지 최신 문서로 검증
lastUpdated: 2026-01-17
source: 프로젝트 경험
applies_to: 모든 프로젝트, SDK 관련 작업
---

# SDK/라이브러리 버전 검증 Skill

기존 코드를 수정하거나 확장하기 전에 **반드시** 사용 중인 SDK/라이브러리의 최신 상태를 검증합니다.

---

## 🎯 적용 시점

- 기존 서비스 파일 수정 시 (특히 외부 API 호출 코드)
- AI/LLM 관련 코드 작업 시
- 1년 이상 된 코드 수정 시

---

## ✅ 체크리스트

### 1단계: 현재 패키지 확인
```bash
# package.json에서 해당 패키지 버전 확인
npm list <package-name>
```

### 2단계: 최신 상태 검증 (필수)

// turbo
1. **Context7로 공식 문서 조회**
   ```
   mcp_context7_resolve-library-id → mcp_context7_query-docs
   쿼리 예시: "migration deprecated new SDK latest version 2025"
   ```

2. **Tavily로 최신 정보 검색**
   ```
   search_web: "<패키지명> deprecated migration new SDK 2025"
   ```

### 3단계: Deprecated 여부 판단

| 신호 | 의미 |
|------|------|
| "end-of-life", "deprecated" | 즉시 마이그레이션 필요 |
| "legacy", "maintenance mode" | 마이그레이션 권장 |
| "new SDK", "unified SDK" | 신규 SDK 존재 확인 |

### 4단계: 마이그레이션 수행 (필요 시)

1. 신규 패키지 설치:
   ```bash
   npm uninstall <old-package> && npm install <new-package>
   ```

2. import 문 변경

3. API 호출 방식 변경 (공식 문서 참조)

---

## 📝 주요 사례

### Google Gemini SDK (2025년 기준)

| 패키지 | 상태 |
|--------|------|
| `@google/generative-ai` | ❌ **Deprecated** (EOL) |
| `@google/genai` | ✅ **권장** (GA, 2025.05~) |

**차이점:**
- 새 SDK: 통합 클라이언트 객체 (`GoogleGenAI`)
- 새 SDK: File API 지원 (`ai.files.upload()`)
- 새 SDK: Gemini 2.5, 3.0 모델 완벽 지원

### 기타 주의 패키지
- Firebase SDK v9 vs v8 (modular vs namespaced)
- React Router v6 vs v5 (API 완전 변경)
- Anthropic Claude SDK 버전 확인

---

## ⚠️ 경고 신호

기존 코드에서 다음을 발견하면 **반드시** 최신 문서 검증:

1. 2년 이상 전에 작성된 코드
2. AI/ML 관련 SDK (빠르게 변화)
3. 메이저 버전이 낮은 패키지 (1.x → 2.x 등)
4. 공식 문서와 코드 스타일이 다른 경우
