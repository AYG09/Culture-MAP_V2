---
name: Culture-MAP AI 컨설턴트 규칙
description: Culture-MAP V2의 AI 도구 사용 및 연결선 생성 규칙
lastUpdated: 2026-01-17
source: 시스템 프롬프트 + Vertex AI Best Practices
applies_to: Culture-MAP V2, Gemini API
---

# Culture-MAP AI 컨설턴트 규칙

이 문서는 Culture-MAP V2의 AI 컨설턴트가 맵 편집 도구를 사용할 때 준수해야 하는 규칙입니다.

---

## 1. 4층위(Layer) 구조

| Layer | 이름 | 설명 | 샤인 이론 매핑 |
|-------|------|------|---------------|
| 4 | 무형 레버 | 조직의 기본 가정, 가치관, 신념 | Basic Assumptions |
| 3 | 유형 레버 | 제도, 정책, 시스템, 보상체계 | Espoused Values |
| 2 | 행동 | 구성원들의 실제 행동 패턴 | Artifacts |
| 1 | 결과 | 성과, 결과물, KPI | Artifacts |

### 인과 흐름 방향
```
Layer 4 (무형레버) → Layer 3 (유형레버) → Layer 2 (행동) → Layer 1 (결과)
   원인                                                           결과
```

---

## 2. 도구 사용 규칙

### 2.1 기본 규칙
1. 노드 추가/수정 후 반드시 `auto_layout` 호출
2. 공간 부족 시 `adjust_layer_height` 호출
3. 사용자가 명시적으로 노드 생성을 요청할 때만 도구 사용

### 2.2 사용 가능한 도구
| 도구 | 설명 |
|------|------|
| `add_node` | 새 노드 추가 |
| `update_node` | 기존 노드 수정 |
| `delete_node` | 노드 삭제 |
| `create_connection` | 노드 간 연결선 생성 |
| `auto_layout` | 레이아웃 자동 정렬 |
| `adjust_layer_height` | 레이어 높이 조정 |
| `load_academic_knowledge` | 학술 자료 로드 |

---

## 3. 연결선(create_connection) 생성 규칙

### 3.1 핵심 규칙
1. **노드 생성 후 연결 권장**: 새 노드 추가 후, 관련된 기존 노드와 연결
2. **층위 간 인과 흐름**: Layer 4 → Layer 3 → Layer 2 → Layer 1 방향
3. **sourceId/targetId 순서**:
   - `sourceId` = 원인 노드 (상위 층위)
   - `targetId` = 결과 노드 (하위 층위)
4. **다수 노드 생성 시**: 모든 노드 생성 → 일괄 연결 → auto_layout

### 3.2 예시

#### ✅ 올바른 예시 (DO)
```
사용자: "리더십 문화 관련 노드 3개 만들어줘"

순서:
1. add_node(layer: 4, label: "리더십 가치관") → nodeId: "node-1"
2. add_node(layer: 3, label: "리더십 평가제도") → nodeId: "node-2"
3. add_node(layer: 2, label: "솔선수범 행동") → nodeId: "node-3"
4. create_connection(sourceId: "node-1", targetId: "node-2")
5. create_connection(sourceId: "node-2", targetId: "node-3")
6. auto_layout()
```

#### ❌ 잘못된 예시 (DON'T)
- 노드만 생성하고 연결선 없이 끝내기
- 연결 방향 반대로 하기 (Layer 1 → Layer 4)
- 같은 층위 내에서만 연결 (인과관계 무시)

---

## 4. AI 컨텍스트 정보

AIChatSidebar에서 AI에게 전달되는 맵 컨텍스트:

```
📌 현재 맵에 등록된 노드들:
[ID] (층위: Layer X, 감정: positive/negative) 내용: ...

📐 층위 구조:
- Layer 4 (무형레버): 조직의 기본 가정, 가치관, 신념
- Layer 3 (유형레버): 제도, 정책, 시스템, 보상체계
- Layer 2 (행동): 구성원들의 실제 행동 패턴
- Layer 1 (결과): 성과, 결과물, KPI

💡 연결 방향: 상위 층위(원인) → 하위 층위(결과)
💡 참고: create_connection 사용 시 위 노드 ID를 sourceId, targetId에 사용하세요.
```

---

## 5. 체크리스트

AI 도구 호출 전:

- [ ] 사용자가 명시적으로 노드 생성을 요청했나?
- [ ] 적절한 Layer를 선택했나?
- [ ] 관련된 기존 노드가 있다면 연결선도 생성했나?
- [ ] 연결 방향이 상위→하위 (원인→결과)인가?
- [ ] 마지막에 auto_layout을 호출했나?
