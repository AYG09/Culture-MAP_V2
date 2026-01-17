---
name: Vite 빌드 엔트리/의존성 점검
description: Vite/Rollup 빌드에서 "Could not resolve entry module" 오류 재발 방지 체크리스트
lastUpdated: 2026-01-18
source: Vite 공식 문서(Context7) + 프로젝트 경험
applies_to: Vite, Rollup, Vercel/Netlify 빌드
---

# Vite 빌드 엔트리/의존성 점검

빌드 중 `Could not resolve entry module` 오류가 발생할 때, **원인 추적 및 재발 방지**를 위한 점검 절차입니다.

---

## 핵심 원칙

1. Vite는 `index.html`을 **모듈 그래프의 진입점**으로 사용합니다.
2. `build.rollupOptions.input`를 지정하면 **명시된 입력만** 크롤링합니다.
3. 제거된 의존성은 `manualChunks`/`external` 목록에서도 제거해야 합니다.

---

## ✅ 점검 체크리스트

### 1) 엔트리 확인
- [ ] index.html의 `<script type="module" src="/src/main.tsx">` 경로가 존재하는가?
- [ ] `build.rollupOptions.input`에 잘못된 엔트리가 지정되지 않았는가?

### 2) 빌드 커맨드 정합성
- [ ] 배포 플랫폼의 buildCommand가 실제 프로젝트 모드와 일치하는가?
- [ ] 제거된 기능(firebase 등)과 연관된 `--mode` 플래그가 남아있지 않은가?

### 3) 의존성 정리
- [ ] package.json에서 제거한 패키지가 `manualChunks`에 남아있지 않은가?
- [ ] 제거한 패키지 import가 코드 어딘가에 남아있지 않은가?
  - grep: `firebase/app`, `@anthropic-ai/sdk` 등

### 4) 타입/표기 정리
- [ ] env 타입 정의에 제거한 기능의 환경 변수가 남아있지 않은가?
- [ ] index.html/README에 불필요한 표기가 남아있지 않은가?

---

## ✅ 올바른 예시 (DO)

- Vercel/Netlify 빌드 커맨드에 firebase 모드 제거
- `manualChunks`에서 삭제된 SDK 항목 제거
- `vite-env.d.ts`에서 사용하지 않는 env 타입 제거

## ❌ 잘못된 예시 (DON'T)

- `build.rollupOptions.input: 'firebase/app'`처럼 존재하지 않는 엔트리 지정
- 삭제한 패키지를 `manualChunks`에 남겨두기
- 배포 명령이 더 이상 사용하지 않는 기능 모드를 계속 사용하기

---

## 적용 체크리스트

- [ ] Vite 엔트리 설정 점검 완료
- [ ] 빌드 커맨드 정합성 확인 완료
- [ ] manualChunks/의존성 동기화 완료
- [ ] env 타입/문서 표기 정리 완료
