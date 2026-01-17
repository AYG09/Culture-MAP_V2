# Implementation Plan: Firebase 의존성 제거 후 빌드 안정화

## 목표
1. 빌드 실패 원인("firebase/app" 엔트리) 재발 방지
2. Firebase 관련 흔적(빌드 모드/타입/표기)을 제거해 혼선을 없앰
3. 동일 이슈가 다른 프로젝트에서도 반복되지 않도록 Skill 문서화

---

## 핵심 변경 범위

### 1) 빌드 커맨드 정리
- Vercel/Netlify 빌드에서 firebase 모드 제거

### 2) 구성 및 표기 정리
- Vite manualChunks에서 제거된 SDK 항목 정리
- index.html 및 env 타입 정의에서 Firebase 표기 제거

### 3) 재발 방지 Skill 추가
- Vite 엔트리/rollup input/빌드 커맨드/의존성 체크리스트 문서화

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 빌드 모드 변경 | 환경 변수 차이 | 기본 build로 통일 후 필요 시 별도 문서화 |

---

## 롤백 계획

### 트리거 조건
- 배포 빌드가 실패하거나 환경 변수 로딩 문제 발생

### 롤백 절차
```bash
git checkout -- vercel.json
git checkout -- netlify.toml
git checkout -- vite.config.ts
git checkout -- src/vite-env.d.ts
git checkout -- index.html
```

---

## 검증 계획

### 자동화 테스트
```bash
npm run build
```

### 수동 검증
1. Vercel/Netlify 빌드 로그에서 firebase/app 관련 오류가 재발하지 않는지 확인
2. 앱 타이틀 및 설정 문구에서 Firebase 표기가 제거됐는지 확인
