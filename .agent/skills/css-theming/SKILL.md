---
name: CSS Dark Mode Theming System
description: prefers-color-scheme 미디어 쿼리 기반 라이트/다크 모드 테마 시스템
lastUpdated: 2026-01-17
source: 프로젝트 경험
applies_to: CSS, React, 모든 프론트엔드
---

# CSS Dark Mode Theming System Skill

## 개요

브라우저의 `prefers-color-scheme` 미디어 쿼리를 활용하여 라이트/다크 모드를 자동으로 감지하고 적용하는 CSS 변수 기반 테마 시스템입니다.

## 핵심 원칙

### 1. CSS 변수 네이밍 규칙

```css
/* 배경 관련 */
--bg-primary: #ffffff;      /* 메인 배경 */
--bg-secondary: #f8fafc;    /* 보조 배경 (카드, 섹션) */
--bg-tertiary: #f1f5f9;     /* 3차 배경 (호버 상태) */
--bg-glass: rgba(255, 255, 255, 0.85); /* 글래스모피즘 */

/* 텍스트 관련 */
--text-primary: #1e293b;    /* 메인 텍스트 */
--text-secondary: #475569;  /* 보조 텍스트 */
--text-muted: #64748b;      /* 약한 텍스트 */

/* 테두리/입력 */
--border-color: #e2e8f0;    /* 기본 테두리 */
--input-bg: #ffffff;        /* 입력 필드 배경 */
--input-border: #e2e8f0;    /* 입력 필드 테두리 */
--input-focus: #6366f1;     /* 포커스 색상 */

/* 그림자 */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.15);

/* 액센트 */
--accent-primary: #6366f1;  /* 주요 강조색 */
--accent-glow: rgba(99, 102, 241, 0.1); /* 글로우 효과 */
```

### 2. 다크 모드 색상 팔레트

**Tailwind CSS Slate 기반 권장**:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0f172a;      /* slate-900 */
    --bg-secondary: #1e293b;    /* slate-800 */
    --bg-tertiary: #334155;     /* slate-700 */
    --bg-glass: rgba(15, 23, 42, 0.85);
    
    --text-primary: #f1f5f9;    /* slate-100 */
    --text-secondary: #cbd5e1;  /* slate-300 */
    --text-muted: #94a3b8;      /* slate-400 */
    
    --border-color: #334155;    /* slate-700 */
    --input-bg: #1e293b;
    --input-border: #475569;
    
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
  }
}
```

### 3. WCAG 접근성 규칙

- **대비율**: 최소 4.5:1 (AA 표준), 권장 7:1 (AAA 표준)
- **순수 검정 피하기**: `#000000` 대신 `#0f172a` 사용 (눈의 피로 감소)
- **순수 흰색 피하기**: 다크모드에서 `#ffffff` 대신 `#f1f5f9` 사용

### 4. 폴백 패턴

기존 코드와의 호환성을 위해 항상 폴백 값 포함:

```css
/* 권장 패턴 */
.element {
  background: var(--bg-primary, white);
  color: var(--text-primary, #1e293b);
  border: 1px solid var(--border-color, #e2e8f0);
}
```

## 적용 체크리스트

### CSS 파일 마이그레이션

1. [ ] `index.css` 또는 전역 CSS에 CSS 변수 정의
2. [ ] 라이트 모드 변수 (`:root` 블록)
3. [ ] 다크 모드 변수 (`@media (prefers-color-scheme: dark)` 블록)

### 컴포넌트별 마이그레이션

1. [ ] 하드코딩된 배경색 → `var(--bg-*, fallback)` 형식으로 변경
2. [ ] 하드코딩된 텍스트색 → `var(--text-*, fallback)` 형식으로 변경
3. [ ] 하드코딩된 테두리색 → `var(--border-color, fallback)` 형식으로 변경
4. [ ] 하드코딩된 그림자 → `var(--shadow-*, fallback)` 형식으로 변경

### 검증

1. [ ] 브라우저 개발자 도구에서 다크모드 시뮬레이션 테스트
2. [ ] 대비율 검사 도구로 텍스트 가독성 확인
3. [ ] 빌드 에러 없음 확인

## 색상 매핑 가이드

| 기존 하드코딩 값 | CSS 변수 |
|-----------------|----------|
| `white`, `#fff`, `#ffffff` | `var(--bg-primary)` |
| `#f8f9fa`, `#f9fafb`, `#f8fafc` | `var(--bg-secondary)` |
| `#e9ecef`, `#f1f5f9` | `var(--bg-tertiary)` |
| `rgba(255,255,255,0.85)` | `var(--bg-glass)` |
| `#1a1a1a`, `#1e293b`, `#333` | `var(--text-primary)` |
| `#4b5563`, `#475569`, `#555` | `var(--text-secondary)` |
| `#6b7280`, `#64748b`, `#888` | `var(--text-muted)` |
| `#e2e8f0`, `#e5e7eb`, `#dee2e6` | `var(--border-color)` |

## 도구 및 리소스

- **대비율 검사**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- **색상 팔레트**: [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- **다크모드 미리보기**: Chrome DevTools → Rendering → Emulate CSS media feature prefers-color-scheme

## 예시 코드

### Before (하드코딩)
```css
.sidebar {
  background: rgba(255, 255, 255, 0.85);
  color: #1e293b;
  border-right: 1px solid rgba(226, 232, 240, 0.8);
}
```

### After (CSS 변수)
```css
.sidebar {
  background: var(--bg-glass, rgba(255, 255, 255, 0.85));
  color: var(--text-primary, #1e293b);
  border-right: 1px solid var(--border-color, rgba(226, 232, 240, 0.8));
}
```

## 관련 파일

이 프로젝트에서 이 Skill이 적용된 파일들:
- [src/index.css](../../../src/index.css) - CSS 변수 정의
- [src/components/AIChatSidebar.css](../../../src/components/AIChatSidebar.css)
- [src/components/AIConfigModal.css](../../../src/components/AIConfigModal.css)
- [src/components/SessionInfoPanel.css](../../../src/components/SessionInfoPanel.css)
- [src/components/ConsultingContextPanel.css](../../../src/components/ConsultingContextPanel.css)
- [src/components/HelpModal.css](../../../src/components/HelpModal.css)
- [src/components/ConsultingToolsPanel.css](../../../src/components/ConsultingToolsPanel.css)
