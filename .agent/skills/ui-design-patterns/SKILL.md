# UI Design Patterns Skill

## 목적
UI/디자인 실수를 반복하지 않기 위한 패턴과 규칙 정의

## 2026 UI 트렌드

### 핵심 원칙
1. **Expressive Minimalism**: 불필요한 요소 제거, 핵심 기능에 집중
2. **Microinteractions**: 미묘하지만 의미 있는 애니메이션
3. **Contextual Input**: 상황에 맞는 입력 방식
4. **Clean Visual Hierarchy**: 명확한 시각적 계층 구조

### 권장 패턴
- **Sticky Input Bar**: 입력창 항상 접근 가능
- **Glassmorphism**: 배경 블러 + 반투명 효과 (적절하게 사용)
- **Neumorphism**: 부드러운 그림자로 입체감 표현

## CSS 필수 규칙

### 1. 입력 필드 (Input Fields)
```css
/* ✅ 필수: 최소 크기 지정 */
.input-field {
    min-height: 40px;
    min-width: 0; /* flexbox에서 축소 방지 */
}

/* ❌ 금지: min 없이 height만 지정 */
.input-field {
    height: 40px; /* flexbox에서 사라질 수 있음 */
}
```

### 2. Hover 애니메이션
```css
/* ✅ 권장: 미묘한 스케일 변화 */
.button:hover {
    transform: scale(1.05);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ❌ 금지: 과도한 회전 (유치해 보임) */
.button:hover {
    transform: rotate(30deg);
}

/* ❌ 금지: 과도한 스케일 (공격적) */
.button:hover {
    transform: scale(1.3);
}
```

### 3. 아이콘 버튼 크기
```css
/* ✅ 권장: 터치 영역 확보하면서 시각적 균형 */
.icon-button {
    width: 32px;
    height: 32px;
    padding: 6px;
}

/* 아이콘 크기 가이드 */
/* - 헤더 아이콘: 18-20px */
/* - 인라인 아이콘: 14-16px */
/* - 대형 액션 버튼: 20-24px */
```

### 4. 텍스트 버튼 → 아이콘 변환 규칙
```tsx
// ❌ 비직관적 텍스트 버튼
<button>{showKey ? "숨기기" : "보기"}</button>

// ✅ 직관적 아이콘 버튼 (접근성을 위한 title 필수)
<button title={showKey ? "숨기기" : "보기"}>
    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
</button>
```

## 컴포넌트 패턴

### 1. 설정 버튼
```css
.config-button {
    width: 32px;
    height: 32px;
    padding: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.config-button:hover {
    background: var(--bg-tertiary);
    transform: scale(1.05); /* 미묘한 확대만 */
}
```

### 2. 입력 영역 (채팅창 등)
```css
.input-container {
    min-height: 52px; /* 컨테이너 최소 높이 */
    display: flex;
    align-items: flex-end;
}

.input-textarea {
    min-height: 40px;
    min-width: 0;
    flex: 1;
    resize: vertical;
}
```

### 3. 토글 버튼
```css
.toggle-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    transition: all 0.2s;
}

.toggle-button:hover {
    background: var(--bg-secondary);
    border-color: var(--border-color-hover);
}
```

## 금지 패턴 체크리스트

| 패턴 | 문제 | 해결책 |
|------|------|--------|
| `transform: rotate(30deg)` on hover | 유치해 보임 | `scale(1.05)` 사용 |
| 텍스트 토글 버튼 ("보기/숨기기") | 비직관적 | Eye/EyeOff 아이콘 |
| `height` without `min-height` | flexbox에서 축소 | `min-height` 추가 |
| 큰 버튼 패딩 (12px+) in header | 불균형 | 6-8px 패딩 |
| opacity 0.3 이하 hover | 너무 미묘함 | opacity 0.7+ |
| 300ms+ transition | 느린 반응 | 150-200ms |

## 아이콘 선택 가이드

### lucide-react 권장 아이콘
| 용도 | 아이콘 | 크기 |
|------|--------|------|
| 보기/숨기기 토글 | `Eye` / `EyeOff` | 16px |
| 설정 | `Settings` | 18px |
| 닫기 | `X` | 18px |
| 전송 | `Send` | 18px |
| 추가 | `Plus` | 16px |
| 삭제 | `Trash2` | 16px |
| 복사 | `Copy` | 16px |
| 다운로드 | `Download` | 16px |

## 코드 리뷰 체크리스트

### CSS 작성 시
- [ ] 모든 input/textarea에 `min-height` 있는가?
- [ ] flex 컨테이너 내 요소에 `min-width: 0` 있는가?
- [ ] hover 애니메이션이 미묘한가? (scale ≤ 1.05, no rotate)
- [ ] transition 시간이 200ms 이하인가?
- [ ] CSS 변수를 사용하는가? (하드코딩 색상 금지)

### 버튼 작성 시
- [ ] 아이콘 버튼에 `title` 또는 `aria-label` 있는가?
- [ ] 터치 타겟 크기가 32px+ 인가?
- [ ] hover 상태가 정의되어 있는가?
- [ ] focus 상태가 정의되어 있는가?

## 관련 파일
- [AIChatSidebar.css](../../../src/components/AIChatSidebar.css)
- [AIConfigModal.css](../../../src/components/AIConfigModal.css)
- [css-theming/SKILL.md](../css-theming/SKILL.md)
