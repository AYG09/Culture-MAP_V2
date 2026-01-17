# Implementation Plan: AI 챗 사이드바 UI 전면 개편

## 목표
1. AIChatSidebar UI/UX 전면 개편(시각적 계층, 마이크로인터랙션, 접근성)
2. CSS 변수 기반 라이트/다크 테마 일관성 강화
3. 기존 서비스/상태 로직 유지(UX 개선에 집중)

---

## 핵심 변경 범위

### 1) AIChatSidebar.tsx 구조/접근성
- 헤더/메시지 리스트/컴포저 영역을 명확한 래퍼 구조로 정리
- 아이콘 버튼에 `aria-label`/`title` 추가
- 기존 Liveblocks/AIService 로직 유지

### 2) AIChatSidebar.css 전면 개편
- 헤더/메시지/입력 영역의 배경/테두리/그림자 재정의
- 메시지 카드/버블의 radius/spacing 통일
- 입력 영역 sticky 처리 및 focus-within 강화
- 150~200ms 전환 규칙으로 미세 인터랙션 정리

### 3) AIConfigModal.css 톤 정리
- 사이드바 톤과 일관된 색상/그림자/테두리로 보정
- 버튼/토글 hover/focus 상태 정리

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| Glassmorphism 과용으로 가독성 저하 | 텍스트 대비 문제 | 배경 불투명도/테두리 강화, 제한적 적용 |
| sticky 입력 바 레이아웃 충돌 | 입력 영역 잘림 | 높이/패딩 재확인 및 min-height 유지 |
| CSS 중복 블록으로 기존 스타일 재적용 | UI 변경 미반영 | 파일 내 중복 헤더/블록 제거 및 검증 절차 추가 |
| 입력 필드 폭 0으로 축소 | 텍스트 입력 불가 | input-row/textarea에 width·min-width 보강 |

---

## 롤백 계획

### 트리거 조건
- UI 가독성 문제 발생
- 레이아웃 깨짐/스크롤 오류

### 롤백 절차
```bash
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- src/components/AIChatSidebar.css
git checkout -- src/components/AIConfigModal.css
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run build
```

### 수동 검증
1. 메시지 전송/첨부/복사/설정 모달 정상 동작
2. 라이트/다크 모드 대비 확인
3. 입력 바 sticky 및 포커스/호버 상태 확인
