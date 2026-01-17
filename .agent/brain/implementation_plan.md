# Implementation Plan: AI 연결선 생성 지시 개선 + 구조화

## 목표
1. Context7/Tavily 조사 결과를 기반으로 시스템 프롬프트 개선
2. VSCode+GitHub 호환 구조로 Skills 파일 통합
3. 기존 `.cursor/rules/` → `.agent/skills/` 마이그레이션

---

## 📊 Before/After 다이어그램

### Before: 현재 구조
```
.cursor/rules/                    # Cursor IDE 전용
├── gemini-api-rules.mdc         # globs로 자동 로드
└── ai-service-guard.mdc

.agent/skills/                    # 범용 스킬
├── google-genai-sdk/SKILL.md    # SDK 오류 패턴
├── doc-guided-optimization/     # 문서 기반 최적화
└── sdk-version-check/           # 버전 체크
```

### After: 통합 구조
```
.agent/skills/                    # 📁 통합 위치
├── google-genai-sdk/SKILL.md    # ✅ 유지
├── doc-guided-optimization/     # ✅ 유지
├── sdk-version-check/           # ✅ 유지
├── gemini-function-calling/     # 🆕 신규 (propertyOrdering 등)
│   └── SKILL.md
└── culture-map-ai/              # 🆕 신규 (연결선 규칙, 레이어 등)
    └── SKILL.md

.cursor/rules/                    # ⚠️ deprecated 표시, .agent 참조 안내
├── gemini-api-rules.mdc         # → .agent/skills/gemini-function-calling 참조
└── ai-service-guard.mdc         # → .agent/skills/culture-map-ai 참조
```

---

## 사용자 검토 필요 항목

### ⚠️ 결정 필요: `.cursor/rules/` 파일 처리
**옵션 A**: 삭제하고 `.agent/skills/`로 완전 이동
- 장점: 중복 제거, 단일 소스
- 단점: Cursor IDE 사용자 영향

**옵션 B**: 유지하되 deprecated 표시 + `.agent/skills/` 참조 안내
- 장점: Cursor IDE 호환성 유지
- 단점: 파일 중복

**현재 선택**: 옵션 B (호환성 우선)

---

## 컴포넌트별 변경 사항

### 1. 시스템 프롬프트 개선 (AIService.ts)
- **위치**: `src/services/AIService.ts` Line 169-175
- **변경**: 연결선 생성 규칙에 **구체적 예시** 추가
- **근거**: Vertex AI Best Practices "examples of what to do and what NOT to do"

### 2. 신규 스킬 파일 생성
| 파일 | 내용 |
|------|------|
| `.agent/skills/gemini-function-calling/SKILL.md` | propertyOrdering, required, 스키마 규칙 |
| `.agent/skills/culture-map-ai/SKILL.md` | 연결선 규칙, 레이어 구조, 도구 사용 지침 |

### 3. 기존 `.cursor/rules/` 파일 수정
- `gemini-api-rules.mdc`: deprecated 헤더 추가, `.agent/skills/` 참조 안내
- `ai-service-guard.mdc`: 동일

### 4. MCP.md 업데이트
- `.agent/skills/` 신규 스킬 참조 추가

---

## 롤백 계획

### 트리거 조건
- AI 도구 호출 실패율 증가
- 빌드 오류 발생

### 롤백 절차
```bash
git revert HEAD~3  # 최근 3개 커밋 되돌리기
# 또는
git checkout <이전 커밋 해시> -- src/services/AIService.ts
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run build  # 빌드 성공 확인
npm run lint   # 린트 오류 없음
```

### 수동 검증
1. AI 채팅에서 "리더십 관련 노드 3개 만들어줘" 요청
2. 콘솔에서 `create_connection` 호출 로그 확인
3. 연결선이 레이어 간 인과 방향에 맞게 생성되는지 확인
