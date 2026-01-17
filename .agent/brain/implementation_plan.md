# Implementation Plan: auto_layout 안정화 + PDF 첨부 인식 개선

## 목표
1. `create_connection` → `auto_layout` 시 노드/연결선 소실 문제를 방지하고 레이아웃 실행을 안전화
2. AI 채팅 첨부 PDF가 실제로 모델 입력에 포함되도록 보장하고, 지원되지 않는 provider는 명확히 처리

---

## 핵심 변경 범위

### 1) AI 액션 배치 처리 안정화
- `auto_layout` 실행 시점에 최신 노드/엣지 스냅샷을 사용하도록 보정
- `create_connection`이 로컬 엣지 상태에도 반영되도록 처리하여 레이아웃 기반 데이터 불일치 최소화

### 2) 데이터 소실 방지 안전장치 강화
- 레이아웃 결과 검증(노드 개수, 타입 누락) 실패 시 상태 업데이트 중단
- 레이아웃 이후 Liveblocks 동기화 시 기존 데이터 덮어쓰기를 방지

### 3) PDF 첨부 인식 개선
- 파일 업로드 성공 여부/URI 포함 여부를 명확히 확인
- 파일 첨부가 가능한 provider(Gemini)와 불가(provider: Claude) 동작을 분리 처리
- Claude 선택 시 사용자 안내 또는 Gemini로 안전 폴백

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 액션 배치 처리 변경 | 레이아웃 타이밍 변경 | 변경 전후 로그 비교 및 수동 검증으로 확인 |
| provider 분기 처리 | 예상과 다른 모델 사용 | UI 안내/로그로 명확히 표시 |

---

## 롤백 계획

### 트리거 조건
- 레이아웃 후 노드 위치/연결 상태가 더 악화됨
- PDF 첨부가 기존보다 실패율 증가

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- src/services/AIService.ts
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run build
```

### 수동 검증
1. AI가 `add_node`→`create_connection`→`auto_layout` 호출 후 노드/연결선이 유지되는지 확인
2. 자동 레이아웃 이후 맵이 빈 상태로 초기화되지 않는지 확인
3. PDF 첨부 후 AI가 파일 내용을 반영하는지 확인 (Gemini 선택)
4. Claude 선택 시 파일 첨부 불가 메시지가 표시되는지 확인
