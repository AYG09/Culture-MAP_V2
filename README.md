# 🎯 Culture-MAP v2 - 조직문화 분석기

> **Live Demo**: https://culture-map-v2.vercel.app/

Liveblocks + Yjs 기반의 실시간 협업 웹서비스입니다. 조직문화를 4층위 모델로 분석하고 시각화하며, Gemini 3.0 Flash Thinking 모델을 통한 지능형 분석을 지원합니다.

---

## ✨ 주요 특징

- 🌐 **웹 기반 서비스** - 어디서나 브라우저로 접속
- 🔗 **Liveblocks 실시간 동기화** - CRDT 기반의 충돌 없는 완벽한 실시간 협업
- 🧠 **AI 통합** - Google Gemini 3.0 Flash Thinking 탑재 (사고 과정 가시화)
- � **오프라인 지원** - IndexedDB를 통한 데이터 영속성 확보
- 🎨 **React Flow v12 에디터** - 직관적인 노드 기반 인터페이스
- 📊 **전문가용 기능** - Excel, Word, 이미지(이미지, PDF) 내보내기 지원
- 📋 **진단 리포트 분석** - 버크만 진단 PDF 및 일반 문서 RAG 분석
- 📚 **문서 RAG 자동화** - PDF 자동 청킹/임베딩/검색으로 수동 분할 없이 근거 검색

---

## 🚀 빠른 시작

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 정보를 입력합니다:

```env
VITE_LIVEBLOCKS_PUBLIC_KEY=your_key
VITE_GEMINI_API_KEY=your_key
VITE_SKIP_GATE=true # 개발 시 게이트웨이 건너뛰기
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 🎯 주요 기능 가이드

### 👥 실시간 협업 (Workshop Mode)
1. **세션 생성**: "새 세션 만들기" 클릭 시 고유한 6자리 코드 생성
2. **초대 및 공유**: QR코드 또는 링크 복사를 통해 팀원 초대
3. **공동 편집**: 모든 참여자의 마우스 커서와 편집 내용이 실시간으로 동기화됨

> 세션 생성 시 **세션 코드(3~12자 영문/숫자/하이픈)** 를 직접 지정할 수 있습니다. 비워두면 6자리 코드가 자동 생성됩니다.

### 🤖 AI 컨설턴트 (Chat Sidebar)
- **자율 편집**: "행동 층위에 노드 추가해줘" 등의 자연어 명령으로 맵 편집
- **심층 분석**: Gemini 3.0 Flash Thinking을 사용하여 조직의 암묵적 가정을 추론
- **문서 분석**: 전문가 리포트(PDF)를 업로드하여 컬쳐맵에 즉시 반영

### 🗺️ 컬쳐맵 조작
- **노드 추가**: 빈 공간 우클릭 또는 모바일 FAB(+) 버튼 사용
- **연결**: 노드 핸들을 드래그하여 인과관계 형성
- **자동 레이아웃**: 상단 도구 모음의 '자동 정렬' 버튼 클릭

---

## 🏗️ 기술 스택

| 분류 | 기술 |
|------|------|
| **Frontend** | React 19.1, TypeScript 5.8, Vite 7.0 |
| **Logic/Flow** | React Flow 12.8, Framer Motion 12.23 |
| **Backend/Sync** | Liveblocks (CRDT), Yjs |
| **AI/LLM** | Google Gemini 3.0 Flash Thinking |
| **Styling** | Vanilla CSS (Modern Premium UI) |

---

## 🔧 프로젝트 스크립트

```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드 (dist/ 생성)
npm run type-check   # TypeScript 타입 검사
npm run lint         # 코드 컨벤션 검사
npm run test:e2e     # Playwright E2E 테스트
```

## 📝 라이선스

**PROPRIETARY** © 2024-2026 안영규 with AI Agent. All rights reserved.

---

**Happy Culture Mapping! 🚀**
