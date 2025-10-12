# 🔥 조직문화 분석기 - Firebase 웹서비스# 🔥 조직문화 분석기 - Firebase 버전



> **Live Demo**: https://culturemapwithai.vercel.app/Firebase 기반의 웹서비스 버전입니다. Socket.IO 대신 Firebase Realtime Database를 사용하여 실시간 멀티유저 협업을 지원합니다.



Firebase 기반의 실시간 협업 웹서비스입니다. 조직문화를 4층위 모델로 분석하고 시각화합니다.## ✨ 주요 특징



---- **🌐 글로벌 웹서비스**: Vercel/Netlify 등에 배포 가능

- **🔥 Firebase 실시간 동기화**: Socket.IO 대신 Firebase Realtime Database 사용

## ✨ 주요 특징- **📱 모바일 지원**: 반응형 디자인으로 모든 기기에서 사용 가능

- **🔐 사용자 인증**: Firebase Auth 지원 (선택사항)

- 🌐 **웹 기반 서비스** - 어디서나 브라우저로 접속- **💾 클라우드 저장**: Firestore를 통한 영구 데이터 저장

- 🔥 **Firebase 실시간 동기화** - Firebase Realtime Database 기반

- 👥 **실시간 협업** - 여러 사용자가 동시에 컬쳐맵 편집## Expanding the ESLint configuration

- 📱 **반응형 디자인** - 모바일/태블릿/데스크톱 지원

- 🎨 **직관적 UI** - 드래그 & 드롭, 컨텍스트 메뉴If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

- 🤖 **AI 통합** - Google Gemini, Claude API 지원

```js

---export default tseslint.config([

  globalIgnores(['dist']),

## 🚀 빠른 시작  {

    files: ['**/*.{ts,tsx}'],

### 1. 설치    extends: [

      // Other configs...

```bash

npm install      // Remove tseslint.configs.recommended and replace with this

```      ...tseslint.configs.recommendedTypeChecked,

      // Alternatively, use this for stricter rules

### 2. Firebase 설정      ...tseslint.configs.strictTypeChecked,

      // Optionally, add this for stylistic rules

`src/lib/firebase.ts` 파일에 Firebase 설정 추가:      ...tseslint.configs.stylisticTypeChecked,



```typescript      // Other configs...

const firebaseConfig = {    ],

  apiKey: "YOUR_API_KEY",    languageOptions: {

  authDomain: "YOUR_AUTH_DOMAIN",      parserOptions: {

  databaseURL: "YOUR_DATABASE_URL",        project: ['./tsconfig.node.json', './tsconfig.app.json'],

  projectId: "YOUR_PROJECT_ID",        tsconfigRootDir: import.meta.dirname,

  // ...      },

};      // other options...

```    },

  },

### 3. 개발 서버 실행]);

```

```bash

# Windows - 스크립트 실행 (권장)You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

run-simple.bat

```js

# 또는 npm 명령어// eslint.config.js

npm run devimport reactX from 'eslint-plugin-react-x';

```import reactDom from 'eslint-plugin-react-dom';



브라우저에서 `http://localhost:5173` 자동 접속export default tseslint.config([

  globalIgnores(['dist']),

---  {

    files: ['**/*.{ts,tsx}'],

## 📦 배포    extends: [

      // Other configs...

### Vercel (추천)      // Enable lint rules for React

      reactX.configs['recommended-typescript'],

```bash      // Enable lint rules for React DOM

npm i -g vercel      reactDom.configs.recommended,

vercel --prod    ],

```    languageOptions: {

      parserOptions: {

### Netlify        project: ['./tsconfig.node.json', './tsconfig.app.json'],

        tsconfigRootDir: import.meta.dirname,

```bash      },

npm i -g netlify-cli      // other options...

npm run build    },

netlify deploy --prod --dir=dist  },

```]);

```

---

## 🎯 사용 방법

### 세션 생성
1. "새 세션 만들기" 클릭
2. 6자리 코드 생성 (예: `ABC123`)
3. 팀원들에게 코드 공유

### 세션 참가
1. "기존 세션 참가" 클릭
2. 6자리 코드 입력
3. 실시간 협업 시작

### 컬쳐맵 작업
- **노트 추가**: 보드 우클릭
- **노트 편집**: 더블클릭
- **연결선 추가**: 우클릭 → 연결 시작
- **저장/불러오기**: JSON/이미지 내보내기

---

## 🏗️ 기술 스택

| 분류 | 기술 |
|------|------|
| **Frontend** | React 19, TypeScript, Vite |
| **Backend** | Firebase Realtime Database |
| **AI/LLM** | Google Gemini, Claude API |
| **Utils** | html2canvas, jsPDF, docx |

---

## 📊 4층위 문화 모델

```
┌─────────────────────────────┐
│ 결과 (Artifacts)            │ ← 가시적 요소
├─────────────────────────────┤
│ 행동 (Behaviors)            │ ← 관찰 행동
├─────────────────────────────┤
│ 유형_레버 (Norms & Values)  │ ← 규범/가치
├─────────────────────────────┤
│ 무형_레버 (Assumptions)     │ ← 기본 가정
└─────────────────────────────┘
```

---

## 🔧 스크립트

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # 코드 린팅
npm run format   # 코드 포맷팅
```

---

## 🐛 문제 해결

| 문제 | 해결방법 |
|------|---------|
| Firebase 연결 오류 | Firebase 설정 파일 확인 |
| 세션 참가 실패 | 세션 코드 재확인 (2시간 제한) |
| 동기화 안됨 | 페이지 새로고침 |

---

## 📝 라이선스

PROPRIETARY © 2024 안영규 with AI Agent

---

## 🎉 더 알아보기

- 📖 [멀티유저 가이드](./MULTIUSER_GUIDE.md)
- 🧹 [클린업 플랜](./CLEANUP_PLAN.md)

---

**Happy Culture Mapping! 🚀**
