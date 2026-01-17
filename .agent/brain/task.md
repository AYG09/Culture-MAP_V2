# Task List: AI 연결선 생성 지시 개선 + 구조화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 시스템 프롬프트에 구체적 예시 추가
- [x] AIService.ts 연결선 규칙 섹션에 예시 추가
- [x] "what to do" 예시 포함
- [x] "what NOT to do" 예시 포함

## Task 2: gemini-function-calling 스킬 생성
- [x] `.agent/skills/gemini-function-calling/SKILL.md` 생성
- [x] propertyOrdering 규칙 문서화
- [x] required 배열 규칙 문서화
- [x] Context7 출처 명시

## Task 3: culture-map-ai 스킬 생성
- [x] `.agent/skills/culture-map-ai/SKILL.md` 생성
- [x] 연결선 생성 규칙 문서화
- [x] 레이어 구조 설명
- [x] 도구 사용 지침

## Task 4: 기존 .cursor/rules 파일 deprecated 표시
- [x] `gemini-api-rules.mdc` 상단에 deprecated 안내 추가
- [x] `ai-service-guard.mdc` 상단에 deprecated 안내 추가
- [x] `.agent/skills/` 참조 링크 추가

## Task 5: MCP.md 스킬 참조 추가
- [x] 신규 스킬 참조 추가

## Task 6: AIChatSidebar 컨텍스트 개선
- [x] 층위 구조 정보 추가
- [x] 연결 방향 안내 추가

## Task 7: 빌드 및 검증
- [x] npm run build 성공
- [x] 에러 없음 확인

## Task 8: Git 커밋 및 배포
- [ ] git add/commit/push
- [ ] Vercel 배포 확인
