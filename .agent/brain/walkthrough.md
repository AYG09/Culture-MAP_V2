# Walkthrough: AI 연결선 생성 지시 개선 + 구조화

## 완료 일시
2026-01-17

## 변경 사항 요약

### 🎯 목표
1. Context7/Tavily 조사 결과 기반으로 시스템 프롬프트 개선
2. VSCode+GitHub 호환 구조로 Skills 파일 통합
3. MCP 5단계 워크플로우 준수

---

## 📊 MCP 조사 결과

### Context7 조사
| 출처 | 핵심 발견 |
|------|-----------|
| `@google/genai` SDK | `propertyOrdering` 필수 (공식 문서 확인) |
| Gemini API Function Calling | `required` 배열에 필수 파라미터 명시 |

### Tavily 조사
| 출처 | 핵심 발견 |
|------|-----------|
| Vertex AI Best Practices | "examples of what to do and what NOT to do" 권장 |
| Google AI for Developers | 명확한 function 선언, 구조화된 스키마 권장 |

---

## 📁 변경된 파일

### 신규 생성
| 파일 | 설명 |
|------|------|
| `.agent/skills/gemini-function-calling/SKILL.md` | Gemini Function Calling 스키마 규칙 |
| `.agent/skills/culture-map-ai/SKILL.md` | Culture-MAP AI 도구 사용 규칙 |
| `.agent/brain/implementation_plan.md` | 구현 계획서 |
| `.agent/brain/task.md` | 작업 체크리스트 |

### 수정
| 파일 | 변경 내용 |
|------|-----------|
| `src/services/AIService.ts` | 연결선 생성 규칙에 DO/DON'T 예시 추가 |
| `src/components/AIChatSidebar.tsx` | 층위 구조 + 연결 방향 안내 추가 |
| `.agent/workflows/MCP.md` | 신규 스킬 참조 추가 |
| `.cursor/rules/gemini-api-rules.mdc` | deprecated 표시 + .agent 참조 |
| `.cursor/rules/ai-service-guard.mdc` | deprecated 표시 + .agent 참조 |

---

## 🧪 테스트 결과

### 빌드 테스트
```
✅ npm run build - 성공 (14.64s)
⚠️ CSS 경고 (기존 이슈, 기능 영향 없음)
```

### Git 커밋
```
✅ Commit: d662941
✅ Push: main -> main
```

---

## 📐 아키텍처 변경

### Before
```
.cursor/rules/           # Cursor IDE 전용
├── gemini-api-rules.mdc
└── ai-service-guard.mdc

.agent/skills/           # 기존 스킬
├── google-genai-sdk/
├── doc-guided-optimization/
└── sdk-version-check/
```

### After
```
.cursor/rules/           # deprecated 표시
├── gemini-api-rules.mdc  → .agent 참조
└── ai-service-guard.mdc  → .agent 참조

.agent/skills/           # 통합 위치 (VSCode/GitHub 호환)
├── google-genai-sdk/
├── doc-guided-optimization/
├── sdk-version-check/
├── gemini-function-calling/  # 🆕
└── culture-map-ai/           # 🆕
```

---

## ✅ 다음 단계

1. **Vercel 배포 확인**: https://culture-map-v2.vercel.app
2. **동작 테스트**: AI에게 "리더십 관련 노드 3개 만들어줘" 요청
3. **콘솔 확인**: `create_connection` 호출 로그 확인
