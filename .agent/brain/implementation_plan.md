# Implementation Plan: 전역 모달 스타일 정비 및 통일

## 목표
1. 전역 `.modal-*` 셀렉터로 인한 스타일 충돌 제거
2. 채팅 UI 톤과 일관된 모달 베이스 스타일 제공
3. 각 모달의 고유 레이아웃은 유지하되 시각적 일관성 확보
4. 설정창에서 비밀번호 기반 컨설팅 모드 전환 제공

---

## 핵심 변경 범위

### 1) 공통 모달 베이스 도입
- `ModalBase.css`에 `.cm-modal-*` 공통 스타일 정의
- 오버레이/헤더/바디/푸터 스타일을 채팅 UI 컬러에 맞춤

### 2) 모달 컴포넌트 클래스 스코프 변경
- HelpModal, ConnectionGuideModal, CheckboxPopupModal, Gateway, SessionManager, MobileGestureGuide 모달에서
	전역 `.modal-*` 클래스 제거 후 `.cm-modal-*`로 교체
- 컴포넌트별 CSS는 전용 클래스 기반으로 한정

### 3) 시각적 톤 업그레이드
- 버튼/포커스/그라데이션을 채팅 UI 테마 변수로 통일

### 4) 컨설팅 모드 전환 버튼 구현
- 설정 모달에 비밀번호 입력/전환 버튼 추가
- 비밀번호 검증(대소문자 구분 없음) 후 세션 타입 업데이트

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 클래스 변경 누락 | 모달 레이아웃 깨짐 | TSX와 CSS를 함께 변경하고 확인 |
| 기존 모달별 특화 스타일 손실 | 정보 가독성 저하 | 컴포넌트별 CSS로 필요한 스타일 유지 |

---

## 롤백 계획

### 트리거 조건
- 모달 레이아웃/기능이 깨짐

### 롤백 절차
```bash
git checkout -- src/components/ModalBase.css
git checkout -- src/components/HelpModal.tsx
git checkout -- src/components/HelpModal.css
git checkout -- src/components/ConnectionGuideModal.tsx
git checkout -- src/components/ConnectionGuideModal.css
git checkout -- src/components/CheckboxPopupModal.tsx
git checkout -- src/components/CheckboxPopupModal.css
git checkout -- src/components/Gateway.tsx
git checkout -- src/components/Gateway.css
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run build
```

### 수동 검증
1. 각 모달(도움말/접속 안내/체크박스/게이트웨이)이 동일한 톤으로 표시되는지 확인
2. 닫기 버튼/복사 버튼/입력 필드 포커스 상태 확인
