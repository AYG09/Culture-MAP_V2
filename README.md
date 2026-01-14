# 🎯 Culture-MAP v2 - 조직문화 분석기

> **Live Demo**: https://culturemapwithai.vercel.app/

Liveblocks + Yjs 기반의 실시간 협업 웹서비스입니다. 조직문화를 4층위 모델로 분석하고 시각화합니다.

---

## ✨ 주요 특징

- 🌐 **웹 기반 서비스** - 어디서나 브라우저로 접속
- 🔗 **Liveblocks 실시간 동기화** - CRDT 기반 충돌 없는 동기화
- 💾 **오프라인 지원** - IndexedDB 로컬 저장
- 👥 **실시간 협업** - 여러 사용자가 동시에 컬쳐맵 편집
- 📱 **완전 반응형** - 모바일/태블릿/데스크톱 최적화
- 🎨 **React Flow 기반** - 직관적인 노드 기반 에디터
- 🤖 **AI 통합** - Google Gemini (PDF RAG), Claude API 지원
- 📊 **다양한 내보내기** - Excel, Word, 이미지 저장
- 📋 **버크만 분석** - PDF 진단 리포트 AI 분석

---

## 🚀 빠른 시작

### 1. 설치

```bash
npm install
```

### 2. Firebase 설정

`src/lib/firebase.ts` 파일에 Firebase 설정 추가:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  // ...
};
```

### 3. 개발 서버 실행

```bash
# Windows - 스크립트 실행 (권장)
run-simple.bat

# 또는 npm 명령어
npm run dev
```

브라우저에서 `http://localhost:5173` 자동 접속

---

## 📦 배포

### Vercel (추천)

```bash
npm i -g vercel
vercel --prod
```

### Netlify

```bash
npm i -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

---

## 🎯 사용 방법

### 🏠 게이트웨이
- 비디오 인트로 재생 후 자동으로 게이트웨이 표시
- "Skip" 버튼으로 인트로 건너뛰기 가능
- 워크숍/컨설팅 모드 선택

### 🎬 워크숍 모드 (간편 협업)
1. **세션 생성**: "새 세션 만들기" → 6자리 코드 생성 (예: `ABC123`)
2. **팀원 초대**: 
   - 🔗 버튼 클릭 → QR코드/URL/코드 공유
   - 팀원들이 "기존 세션 참가"에서 코드 입력
3. **실시간 협업**: 모든 변경사항 자동 동기화

### 💼 컨설팅 모드 (전문가용)
- 보고서 탭 추가 (React Quill 에디터)
- 분석 결과를 Excel/Word로 내보내기
- 세션 관리 기능 동일

### 🗺️ 컬쳐맵 작업

#### 데스크톱
- **포스트잇 추가**: 빈 공간 우클릭 → 타입 선택
- **포스트잇 편집**: 더블클릭
- **포스트잇 이동**: 드래그
- **연결선 추가**: 핸들 드래그 또는 우클릭 메뉴
- **캔버스 이동**: 중간/우클릭 드래그 또는 스페이스바 + 드래그
- **확대/축소**: 마우스 휠

#### 모바일
- **포스트잇 추가**: 우측 하단 ➕ FAB 버튼
- **포스트잇 편집**: 더블탭
- **포스트잇 이동**: 포스트잇 드래그
- **캔버스 이동**: 빈 공간 드래그
- **확대/축소**: 두 손가락 핀치
- **사이드바 열기**: 좌측 상단 ☰ 햄버거 메뉴

### 📊 데이터 관리
- **저장**: 자동 Firebase 동기화 (수동 저장 불필요)
- **내보내기**: Excel, Word, 이미지 형식 지원
- **불러오기**: JSON 파일 import 지원

---

## 🏗️ 기술 스택

| 분류 | 기술 |
|------|------|
| **Frontend** | React 19.1, TypeScript 5.8, Vite 7.0 |
| **UI Library** | React Flow 12.8, Framer Motion 12.23 |
| **Backend** | Firebase Realtime Database, Firestore |
| **문서 생성** | ExcelJS 4.4, docx 8.5 |
| **에디터** | React Quill 3.6 |
| **AI/LLM** | Google Gemini, Claude API |
| **배포** | Vercel, Netlify |

---

## 📊 4층위 문화 모델

```
┌─────────────────────────────┐
│ 🎯 결과 (Artifacts)         │ ← 가시적 요소 (Layer 1)
├─────────────────────────────┤
│ 👥 행동 (Behaviors)         │ ← 관찰 행동 (Layer 2)
├─────────────────────────────┤
│ 📋 유형 레버 (Norms/Values) │ ← 규범/가치 (Layer 3)
├─────────────────────────────┤
│ 💡 무형 레버 (Assumptions)  │ ← 기본 가정 (Layer 4)
└─────────────────────────────┘
```

---

## 🎨 주요 기능

### React Flow 에디터
- ✅ 드래그 & 드롭 노드 편집
- ✅ 자동 레이아웃 (Dagre 알고리즘)
- ✅ 미니맵 네비게이션
- ✅ 줌/팬 컨트롤
- ✅ 컨텍스트 메뉴 (데스크톱)
- ✅ 모바일 FAB 버튼 (모바일)

### 실시간 협업
- ✅ Firebase Realtime Database 동기화
- ✅ 편집 중 잠금 (다른 사용자 충돌 방지)
- ✅ 세션 코드 기반 참가
- ✅ QR코드/URL 공유

### 모바일 최적화
- ✅ 반응형 레이아웃 (768px, 1024px 브레이크포인트)
- ✅ 햄버거 메뉴 사이드바
- ✅ FAB 버튼 (포스트잇 생성)
- ✅ 터치 제스처 가이드
- ✅ 핀치 줌 지원

### AI 기능
- ✅ PromptGenerator (AI 텍스트 일괄 생성)
- ✅ 문화 진단 프롬프트 (Gemini/Claude)
- ✅ 이론 기반 분석 프롬프트
- ✅ 편향 분석 프롬프트

---

## 🔧 스크립트

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 미리보기
npm run lint         # ESLint 검사
npm run format       # Prettier 포맷팅
npm run format:check # 포맷팅 검사만
npm run type-check   # TypeScript 타입 체크
npm run test:e2e     # Playwright E2E 테스트
```

---

## 📱 반응형 디자인

| 디바이스 | 너비 | 특징 |
|---------|------|------|
| **모바일** | 0-767px | 햄버거 메뉴, FAB 버튼, 핀치 줌 |
| **태블릿** | 768-1023px | 적응형 레이아웃 |
| **데스크톱** | 1024px+ | 사이드바, 컨텍스트 메뉴 |

---

## 🐛 문제 해결

| 문제 | 해결방법 |
|------|---------|
| **Firebase 연결 오류** | `src/lib/firebase.ts` 설정 확인 |
| **세션 참가 실패** | 세션 코드 재확인 (대소문자 구분 없음) |
| **동기화 안됨** | 페이지 새로고침 또는 Firebase 콘솔 확인 |
| **모바일에서 포스트잇 생성 안됨** | ➕ FAB 버튼 사용 (우측 하단) |
| **모바일에서 캔버스 이동 안됨** | 빈 공간(배경)을 드래그하세요 |
| **린트 에러** | `npm run lint` 실행 후 수정 |
| **타입 에러** | `npm run type-check` 실행 |

---

## 📝 라이선스

**PROPRIETARY** © 2024 안영규 with AI Agent

모든 권리 보유. 무단 복제 및 배포 금지.

---

## 📚 추가 문서

- 📖 [멀티유저 가이드](./MULTIUSER_GUIDE.md) - 세션 관리 상세 설명
- 📱 [모바일 최적화 제안](./MOBILE_OPTIMIZATION_PROPOSAL.md) - 모바일 UX 개선 계획
- 🔥 [Firebase 설정](./FIREBASE_SETUP.md) - Firebase 초기 설정 가이드
- 🧪 [성능 테스트](./PERFORMANCE_TEST_REPORT.md) - React Flow 성능 측정
- 🎨 [React Flow 마이그레이션](./REACTFLOW_MIGRATION_PROGRESS.md) - 레거시 → React Flow 전환 기록

---

## 🎉 기여자

- **안영규** - 기획 및 개발
- **AI Agent** - 코드 작성 및 최적화 지원
- **Gemini Veo3** - 인트로 비디오 생성

---

**Happy Culture Mapping! 🚀**
