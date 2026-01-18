# Task List: 도구 호출 누락(코드 출력) 방지 + 규칙/문서 최신화

## 진행 상황
- 🔲 미완료
- 🔄 진행 중
- ✅ 완료

---

## Task 1: 도구 호출 유도 규칙 보강
- [x] AIService systemInstruction에 코드 출력 금지 및 확인 응답 트리거 추가
- [x] AIChatSidebar 컨텍스트에 도구 호출 코드 출력 금지 문구 추가

## Task 2: 규칙/문서 최신화
- [x] .cursorrules에 MCP-VSCODE 우선 규칙 반영
- [x] implementation_plan.md를 본 이슈 범위로 갱신
- [ ] walkthrough.md에 변경 사항 기록

## Task 3: 검증
- [ ] “노드를 생성해줘” 요청 시 function call 발생 확인
- [ ] “그렇게 해” 응답 시 직전 제안 실행 확인
