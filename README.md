# Culture-MAP V2

> English summary
> Culture-MAP V2 is a real-time collaborative culture mapping tool for workshops and consulting sessions.
> It combines React 19, React Flow, Liveblocks/Yjs, and Gemini-based AI assistance.
> Teams can co-edit a 4-layer culture map, discuss causal links, and generate analysis outputs.
> PDF-based RAG and export features support evidence-backed reporting workflows.
> This demo is experimental and not intended for sensitive or regulated data.

실시간 협업 기반 조직문화 분석 도구입니다. 4층위 컬쳐맵을 공동 편집하고 AI 보조 분석을 통해 인사이트를 구조화할 수 있습니다.

라이브 데모: https://culture-map-v2.vercel.app/

주의: 현재 데모는 실험용입니다. 민감정보, 개인정보, 고객 기밀 문서는 업로드하지 마세요.

## 스크린샷

- TODO: docs/screenshots/overview.png
- TODO: docs/screenshots/collaboration.gif

## 핵심 기능

- Liveblocks + Yjs 기반 실시간 협업 편집
- 4층위 컬쳐맵 모델(무형 레버 → 유형 레버 → 행동 → 결과)
- AI 컨설턴트 기반 노드 생성/정리/분석 보조
- 문서 기반 RAG 분석(PDF)
- 내보내기 기능(이미지, Word, Excel 등)

## 아키텍처 개요

```text
Client (React 19 + Vite + React Flow)
  ├─ Realtime Sync: Liveblocks + Yjs
  ├─ AI Layer: Gemini integration
  ├─ Workspace UI: Canvas, Sidebar, Report Editor
  └─ API Routes (Vercel functions): auth/session/web-search
```

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite 7 |
| Canvas/Flow | @xyflow/react (React Flow 12), dagre/elkjs |
| Realtime | Liveblocks, Yjs |
| AI | @google/genai (Gemini) |
| Export/Docs | exceljs, docx, html2canvas, jspdf |
| Testing | Vitest, Playwright |

## 시작하기

### 요구사항

- Node.js 20 이상 권장
- npm 10 이상 권장

### 설치

```bash
npm ci
```

### 환경 변수 설정

1. .env.local.example 파일을 참고해 .env.local 파일을 생성합니다.
2. 실제 키는 로컬에만 저장하고 저장소에 커밋하지 않습니다.
3. 발급 링크:
   - Liveblocks: https://liveblocks.io/dashboard
   - Gemini API: https://aistudio.google.com/apikey

### 개발 서버 실행

```bash
npm run dev
```

## 스크립트

```bash
npm run dev
npm run build
npm run preview
npm run type-check
npm run lint
npm run format
npm run format:check
npm run test
npm run test:watch
npm run test:e2e
npm run test:e2e:debug
npm run test:e2e:all
npm run liveblocks:audit
npm run liveblocks:lockdown
```

## 디렉토리 구조

```text
api/               서버리스 API (auth, sessions, web-search)
src/               앱 소스코드 (컴포넌트, 서비스, 훅, 타입)
public/            정적 자산
playwright/        E2E 테스트
scripts/           운영/보안 점검 스크립트
docs/              공개 문서
```

## 배포

- Vercel 기준으로 빌드 커맨드는 npm run build를 사용합니다.
- 런타임/빌드 환경 변수는 플랫폼의 Secret 관리 기능으로 설정합니다.
- 저장소에는 실제 키를 포함하지 않습니다.

## Contributing

- 이 저장소는 Public이며 이슈/PR 제안을 환영합니다.
- 큰 변경은 먼저 이슈로 배경과 범위를 공유해 주세요.
- PR에는 재현 방법과 테스트 결과를 함께 남겨 주세요.
- 보안 이슈나 비밀정보 노출은 공개 이슈 대신 비공개 채널로 알려 주세요.
- 코드 스타일과 기존 구조를 우선 존중해 주세요.

## 라이선스

MIT License. 자세한 내용은 LICENSE 파일을 참고하세요.

## 저자

- GitHub: https://github.com/AYG09

## 로드맵 / 알려진 제약

- TODO: 공개용 합성 데모 데이터셋 examples/ 추가
- TODO: 문서 업로드 제한 정책 및 자동 마스킹 가이드 정리
