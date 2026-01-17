# Implementation Plan: AI 레이어 도구 활용 + Edge-aware 레이아웃 + 좌표 이동

## 목표
1. AI가 레이어 높이 도구(adjust_layer_height)를 이해하고 활용하도록 컨텍스트/프롬프트 보강
2. auto_layout이 연결선 흐름을 고려해 가시적으로 배치되도록 개선
3. update_node에서 좌표(x/y) 이동을 지원해 직접 배치 가능하도록 확장

---

## 핵심 변경 범위

### 1) 레이어 도구 정보 제공
- AIChatSidebar에 layerHeights 전달
- 컨텍스트에 현재 층위 높이와 adjust_layer_height 사용 가이드 포함

### 2) AI 시스템 프롬프트 보강
- 레이아웃 겹침/가림 발생 시 adjust_layer_height 사용 규칙 추가

### 3) Edge-aware 레이아웃
- flowAutoLayout에서 연결선 기반 정렬(인접 레이어 평균 인덱스) 적용

### 4) 좌표 이동 지원
- update_node가 x/y 좌표를 수용하고 React Flow position + Liveblocks 동기화
- AI 컨텍스트에 노드 좌표 포함, 시스템 프롬프트에 좌표 이동 규칙/예시 추가

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 레이어 정보 추가 | 컨텍스트 길이 증가 | 요약형으로 표시 |
| 레이아웃 변경 | 사용자 배치 혼란 | auto_layout 실행 시에만 적용, 수동 배치 유지 |

---

## 롤백 계획

### 트리거 조건
- AI 컨텍스트에서 노드 ID/층위 표시 오류 재발
- PDF 로드 실패가 증가
- 레이아웃 변경 후 가시성 악화

### 롤백 절차
```bash
git checkout -- src/components/CultureMapFlow.tsx
git checkout -- src/services/AIService.ts
git checkout -- src/components/AIChatSidebar.tsx
git checkout -- src/utils/flowAutoLayout.ts
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run lint
npm run type-check
```

### 수동 검증
1. AI 응답에서 레이어 높이 조절 안내/도구 호출 확인
2. auto_layout 실행 후 연결선 흐름에 맞는 정렬 확인
