# 🧹 Firebase 웹서비스 전용 클린업 플랜

## 📋 현재 상황
- ✅ **메인**: Firebase 웹서비스 (https://culturemapwithai.vercel.app/)
- ❌ **레거시**: Electron 데스크톱 버전
- ❌ **레거시**: Socket.IO 서버 버전

---

## 🎯 목표
Firebase 기반 웹서비스 전용으로 정리하여 코드베이스 단순화

---

## 🗑️ 제거할 항목

### 1. Electron 관련 파일/폴더
```
electron/
  └── main.js
```

### 2. Socket.IO 서버 파일
```
server.js
```

### 3. package.json 클린업
**제거할 dependencies:**
- `socket.io`
- `socket.io-client`
- `express` (Firebase 전용이면 불필요)
- `qrcode-terminal` (서버 전용)

**제거할 devDependencies:**
- `electron`
- `electron-builder`
- `concurrently`
- `wait-on`

**제거할 scripts:**
- `electron:dev`
- `electron:build`
- `electron:pack`
- `electron:dist`

**제거할 build 설정:**
- `build` 섹션 전체 (Electron Builder 설정)

### 4. 실행 스크립트 정리
**제거/업데이트:**
- `run-multiuser.bat` → Firebase 전용으로 단순화
- `run-multiuser.ps1` → Firebase 전용으로 단순화
- `run-multiuser-fixed.bat` → 제거 (Firebase에서 불필요)
- `kill-ports.bat` → 제거 또는 단순화

**유지:**
- `run-simple.bat` → `npm run dev` 만 실행하도록 단순화

### 5. 코드 내 Electron 참조 제거

**src/App.tsx:**
```typescript
// 제거: Line 358-390
// Electron 메뉴 이벤트 핸들러 useEffect
useEffect(() => {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    // ... Electron 관련 코드
  }
}, [...]);
```

**src/utils/promptLoader.ts:**
```typescript
// 수정: Line 63
// Electron 파일 프로토콜 체크 제거
```

### 6. 문서 정리
**업데이트:**
- `README.md` → Firebase 웹서비스 전용으로 재작성
- `MULTIUSER_GUIDE.md` → Socket.IO 참조 제거, Firebase 가이드로 변경

**제거:**
- `README_FIREBASE.md` → 메인 README로 통합

---

## ✅ 유지할 항목

### Firebase 관련
- `src/lib/firebase.ts` (Firebase 설정)
- `src/services/FirebaseMultiUserService.ts`
- `firebase` 패키지

### 웹 전용 기능
- `react-router-dom`
- `html2canvas`
- `jspdf`
- `docx`
- `file-saver`

### UI 컴포넌트
- 모든 `src/components/*`
- 모든 `src/styles/*`

---

## 🔄 업데이트할 항목

### 1. package.json
```json
{
  "name": "org_culture_analyzer_web",
  "description": "조직문화 분석기 - Firebase 기반 웹서비스",
  "main": "src/main.tsx",  // 제거 (웹 전용)
  "scripts": {
    "dev": "vite --force --mode firebase",
    "build": "vite build --mode firebase",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,css,md}\"",
    "test:e2e": "npx playwright test"
  }
}
```

### 2. vite.config.ts
```typescript
// mode !== 'firebase' 조건 제거 (항상 Firebase 모드)
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  // proxy 제거 (Firebase 직접 통신)
});
```

### 3. src/main.tsx
```typescript
// 멀티유저 모드 감지 단순화
const isFirebaseMode = true; // 항상 Firebase 모드
const multiUserMode = true;  // 항상 멀티유저 모드
```

---

## 📦 최종 package.json (클린업 후)

```json
{
  "name": "org_culture_analyzer_web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "조직문화 분석기 - Firebase 기반 웹서비스",
  "author": "안영규 with AI Agent",
  "license": "PROPRIETARY",
  "scripts": {
    "dev": "vite --force",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,css,md}\"",
    "test:e2e": "npx playwright test"
  },
  "dependencies": {
    "@types/qrcode": "^1.5.5",
    "@types/react-router-dom": "^5.3.3",
    "@types/uuid": "^10.0.0",
    "docx": "^8.5.0",
    "file-saver": "^2.0.5",
    "firebase": "^12.1.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1",
    "qrcode": "^1.5.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.7.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@playwright/test": "^1.54.2",
    "@types/file-saver": "^2.0.7",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "eslint": "^9.30.1",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "prettier": "^3.6.2",
    "typescript": "~5.8.3",
    "typescript-eslint": "^8.35.1",
    "vite": "^7.0.4"
  }
}
```

---

## 🚀 실행 방법 (클린업 후)

### 개발 모드
```bash
npm run dev
```
브라우저에서 `http://localhost:5173` 자동 접속

### 프로덕션 빌드
```bash
npm run build
```
`dist/` 폴더에 최적화된 파일 생성

### Vercel 배포
```bash
vercel --prod
```

---

## ⚠️ 주의사항

1. **데이터 마이그레이션 불필요**
   - 모든 데이터는 Firebase에 저장되므로 기존 데이터 유지

2. **사용자 영향 없음**
   - 웹서비스는 계속 작동
   - URL 변경 없음

3. **버전 관리**
   - 클린업 전 현재 상태 태그 생성 권장
   ```bash
   git tag -a v1.0.0-with-electron -m "Before cleanup"
   git push origin v1.0.0-with-electron
   ```

---

## 📈 기대 효과

- ✅ **코드베이스 30% 감소**
- ✅ **의존성 패키지 50% 감소** (약 500MB → 250MB)
- ✅ **빌드 시간 단축**
- ✅ **유지보수 복잡도 감소**
- ✅ **명확한 아키텍처** (Firebase 웹서비스 단일 버전)

---

## 🔄 롤백 계획

문제 발생 시 이전 버전으로 복귀:
```bash
git checkout v1.0.0-with-electron
```
