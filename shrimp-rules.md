# 조직문화 분석기 개발 가이드

## 프로젝트 개요

- **목적**: 워크샵/컨설팅 모드를 통한 조직문화 맵 생성 및 분석
- **기술 스택**: React 19, TypeScript, Vite, Firebase Realtime Database, React Flow
- **핵심 기능**: 다중 사용자 실시간 협업, AI 프롬프트 생성, 보고서 편집

---

## 프로젝트 아키텍처

### 디렉토리 구조

```
src/
├── components/          # React 컴포넌트
│   ├── AdminGateway.tsx        # 비밀번호 관리 (관리자용)
│   ├── Gateway.tsx             # 세션 입장 게이트웨이
│   ├── CultureMapFlow.tsx      # 메인 컬쳐맵 컴포넌트
│   ├── PromptGenerator.tsx     # AI 프롬프트 생성기
│   ├── ReportEditor.tsx        # 보고서 편집기
│   └── ConsultingContextPanel.tsx  # 컨설팅 컨텍스트 UI
├── services/           # Firebase 서비스
│   ├── GatewayAdminService.ts  # 비밀번호 CRUD
│   └── FirebaseMultiUserService.ts  # 세션 관리
├── types/             # TypeScript 타입 정의
└── lib/               # Firebase 설정
```

### 모듈 분할

- **Gateway 모듈**: 비밀번호 인증 및 세션 생성/참가
- **Culture Map 모듈**: React Flow 기반 시각화
- **Prompt 모듈**: AI 프롬프트 생성 (워크샵/컨설팅)
- **Report 모듈**: React Quill 기반 편집 및 내보내기

---

## 코드 표준

### 명명 규칙

- **컴포넌트**: PascalCase (예: `CultureMapFlow.tsx`)
- **서비스/유틸**: PascalCase + Service/Utils 접미사 (예: `FirebaseMultiUserService.ts`)
- **타입/인터페이스**: PascalCase + Props/Type 접미사 (예: `PromptGeneratorProps`)
- **상수**: UPPER_SNAKE_CASE (예: `TOP_BAR_HEIGHT`)
- **함수**: camelCase (예: `handleGenerateMap`)

### TypeScript 규칙

- **필수**: 모든 props, state, 함수 매개변수에 타입 명시
- **금지**: `any` 타입 사용 (unknown 또는 구체적 타입 사용)
- **권장**: Union 타입으로 세션 타입 정의 (`'workshop' | 'consulting' | 'admin'`)

### 포맷팅

- **들여쓰기**: 2 spaces
- **줄바꿈**: LF (Unix)
- **따옴표**: 단일 따옴표 ('') 우선, JSX는 쌍따옴표 ("")

---

## 기능 구현 표준

### 세션 타입 시스템

**필수 규칙**:
- 비밀번호 생성 시 `type: 'workshop' | 'consulting' | 'admin'` 필드 필수
- 세션 생성 시 비밀번호 타입을 상속하여 `sessions/{code}/type` 저장
- 세션 타입은 생성 후 **변경 불가** (immutable)
- CultureMapFlow에서 세션 타입을 읽어 PromptGenerator에 `mode` prop 전달

**예시**:
```typescript
// ✅ 올바른 방법
const session = await FirebaseMultiUserService.createSession('컨설팅 세션', 'consulting');

// ❌ 잘못된 방법
const session = await FirebaseMultiUserService.createSession('세션'); // type 누락
```

### PromptGenerator 모드별 분기

**필수 규칙**:
- `mode: 'workshop' | 'consulting'` prop으로 Step 개수 제어
- 워크샵 모드: Step 1-3 (포스트잇 분석 → 컬쳐맵 → 종합 분석)
- 컨설팅 모드: Step 0-5 (음성변환 → 데이터 추출 → Gemini → Claude → 진단 → 전략)
- Step 2-3에서 ConsultingContext 공유 (톤앤매너, 긍부정성, 한국문화)

**조건부 렌더링 패턴**:
```tsx
{mode === 'consulting' && (
  <Step stepNumber={0} title="음성-텍스트 변환">
    {/* 컨설팅 전용 Step */}
  </Step>
)}

{/* 공통 Step */}
<Step stepNumber={mode === 'consulting' ? 2 : 1} title="컬쳐맵 그리기">
  <ConsultingContextPanel context={consultingContext} onChange={setConsultingContext} />
</Step>
```

### ConsultingContext 상태 관리

**필수 규칙**:
- Context API 사용 (React 19 공식 권장)
- `useMemo`로 context 값 메모이제이션 (불필요한 리렌더링 방지)
- Step 2와 Step 3에서 동일한 context 공유

**인터페이스 정의**:
```typescript
interface ConsultingContextValue {
  toneAndManner: string;
  positivity: string;
  negativity: string;
  observationNote: string;
  koreanCulture: {
    silence: boolean;
    faceSaving: boolean;
    humor: boolean;
    consideration: boolean;
    hierarchy: boolean;
    collectivism: boolean;
    other: string;
  };
}
```

### 프롬프트 생성 로직

**필수 규칙**:
- 컨설턴트 관찰 노트 → 인터뷰 맥락 → 한국문화 특성 → 기본 프롬프트 순서
- 각 섹션은 `---` 구분선으로 분리
- 빈 값은 프롬프트에 포함하지 않음

**생성 함수 시그니처**:
```typescript
const generateContextualPrompt = (
  basePrompt: string,
  context: ConsultingContextValue
): string => {
  // 1. 관찰 노트
  // 2. 톤앤매너/긍부정성
  // 3. 한국문화 특성
  // 4. 기본 프롬프트
};
```

---

## Framework/라이브러리 사용 표준

### React 19

- **함수형 컴포넌트만 사용** (클래스 컴포넌트 금지)
- **Hooks 규칙 준수**: 최상위 레벨에서만 호출, 조건부 호출 금지
- **성능 최적화**: `React.memo`, `useMemo`, `useCallback` 적극 활용

### Firebase Realtime Database

- **데이터 구조**: 최대한 평탄(flat)하게 유지
- **리스너**: 가능한 한 깊은 경로에 배치 (예: `sessions/{code}/users` 대신 `sessions/{code}/users/{userId}`)
- **쿼리**: `orderByKey()` 우선 사용 (성능 최적화)
- **보안 규칙**: `.read`, `.write` 규칙을 database.rules.json에 명시

**스키마 예시**:
```json
{
  "gateway": {
    "passwords": {
      "{passwordId}": {
        "password": "exc2025",
        "type": "consulting",
        "description": "컨설팅용 비밀번호",
        "createdAt": 1234567890,
        "expiresAt": 1234654290,
        "maxUses": 10,
        "usedCount": 3
      }
    }
  },
  "sessions": {
    "{sessionCode}": {
      "type": "consulting",
      "name": "조직A 컨설팅",
      "code": "ABC123",
      "host": "user_xyz",
      "createdAt": 1234567890,
      "userCount": 3,
      "users": { ... },
      "notes": { ... },
      "connections": { ... }
    }
  }
}
```

### React Flow

- **노드 타입**: StickyNoteNode 커스텀 컴포넌트 사용
- **엣지 타입**: 직접(실선), 간접(점선) 구분
- **성능**: `nodesDraggable`, `nodesConnectable`, `elementsSelectable` 최적화

### React Quill (react-quill-new)

- **주의**: `react-quill-new` 사용 (React 19 호환)
- **CSS**: `main.tsx`에서 전역 import (`import 'react-quill-new/dist/quill.snow.css'`)

---

## 워크플로우 표준

### 세션 생성 흐름

```
1. Gateway 비밀번호 입력
   ↓
2. GatewayAdminService.validatePassword()
   → { isValid: true, isAdmin: boolean, passwordType: 'workshop' | 'consulting' }
   ↓
3. SessionManager에서 세션 생성 버튼 클릭
   ↓
4. FirebaseMultiUserService.createSession(name, passwordType)
   → sessions/{code}/type = passwordType
   ↓
5. CultureMapFlow 렌더링
   → currentSession.type 읽어서 PromptGenerator에 mode 전달
```

### AI 프롬프트 생성 흐름

```
[워크샵 모드]
Step 1: 포스트잇 사진 → AI 분석 → Culture Map 텍스트
Step 2: Culture Map 텍스트 → parseAIOutput() → React Flow 노드
Step 3: 종합 분석 프롬프트 복사 → AI에 입력 → 보고서 생성

[컨설팅 모드]
Step 0: 음성 파일 → NotebookLM → 텍스트 전사
Step 1: 전사 텍스트 → 핵심 데이터 추출
Step 2: Gemini 1차 분석 (+ 톤앤매너/긍부정성/한국문화)
Step 3: Claude 컬쳐맵 생성 (+ 동일 컨텍스트)
Step 4a: 조직문화 진단 (4a-1, 4a-2, 4a-3)
Step 4b: 실행 전략
```

---

## 핵심 파일 상호작용 표준

### GatewayAdminService ↔ AdminGateway

- **AdminGateway**에서 비밀번호 생성 시 `type` 선택 필수
- **GatewayAdminService.createPassword()**에 `type` 전달
- 비밀번호 목록에서 `type` 배지 표시 (🎓 워크샵 / 💼 컨설팅 / 🔑 관리자)

### Gateway ↔ FirebaseMultiUserService

- **Gateway**에서 비밀번호 검증 후 `passwordType` 획득
- **SessionManager**에서 세션 생성 시 `type` 파라미터 전달
- **FirebaseMultiUserService.createSession(name, type)**으로 세션 생성

### CultureMapFlow ↔ PromptGenerator

- **CultureMapFlow**에서 `currentSession.type` 읽기
- **PromptGenerator**에 `mode={currentSession.type}` prop 전달
- **워크샵↔컨설팅 전환 버튼 완전 제거** (세션 타입은 불변)

### PromptGenerator ↔ ConsultingContextPanel

- **ConsultingContext**를 Provider로 래핑
- Step 2, 3에서 동일한 `consultingContext` state 공유
- 프롬프트 복사 시 `generateContextualPrompt()` 호출

---

## AI 의사결정 표준

### 세션 타입 불일치 시

```
IF currentSession.type !== expectedType THEN
  → 경고 로그 출력
  → 세션 타입에 맞는 UI 강제 적용
  → 사용자에게 세션 타입 안내 모달 표시
END IF
```

### 컨설팅 컨텍스트 누락 시

```
IF mode === 'consulting' AND consultingContext is empty THEN
  → Step 2, 3에 "컨설팅 컨텍스트를 먼저 입력하세요" 안내
  → 프롬프트 복사 버튼 비활성화
END IF
```

### Firebase 연결 실패 시

```
IF firebase.onDisconnect() THEN
  → 로컬 state 유지 (오프라인 모드)
  → 재연결 시 자동 동기화
  → 사용자에게 "오프라인 모드" 배지 표시
END IF
```

---

## 금지 사항

### ❌ 절대 금지

1. **세션 타입 런타임 변경**
   ```typescript
   // ❌ 금지: 세션 생성 후 타입 변경
   await set(ref(database, `sessions/${code}/type`), 'consulting');
   ```

2. **any 타입 사용**
   ```typescript
   // ❌ 금지
   const data: any = parseAIOutput(text);
   
   // ✅ 올바른 방법
   const data: { notes: NoteData[]; connections: ConnectionData[] } = parseAIOutput(text);
   ```

3. **Context 값 직접 변경**
   ```tsx
   // ❌ 금지
   consultingContext.toneAndManner = 'formal';
   
   // ✅ 올바른 방법
   setConsultingContext({ ...consultingContext, toneAndManner: 'formal' });
   ```

4. **Firebase 데이터 직접 수정**
   ```typescript
   // ❌ 금지
   const notes = database.ref('sessions/ABC123/notes');
   notes.value = { ... };
   
   // ✅ 올바른 방법
   await set(ref(database, 'sessions/ABC123/notes'), { ... });
   ```

5. **React Quill findDOMNode 사용**
   ```tsx
   // ❌ 금지: react-quill (React 19 비호환)
   import ReactQuill from 'react-quill';
   
   // ✅ 올바른 방법: react-quill-new 사용
   import ReactQuill from 'react-quill-new';
   ```

### ⚠️ 주의 사항

1. **Props Drilling 과다**
   - 3 depth 이상 props 전달 시 Context 또는 상태 관리 라이브러리 검토

2. **useEffect 의존성 배열**
   - 모든 의존성 명시 (ESLint exhaustive-deps 규칙 준수)

3. **Firebase 리스너 정리**
   - `useEffect` cleanup 함수에서 `off()` 호출 필수

---

## 예시: 할 수 있는 것 vs 할 수 없는 것

### ✅ 할 수 있는 것

```typescript
// 1. 비밀번호 생성 시 타입 선택
await gatewayAdminService.createPassword({
  password: 'exc2025',
  type: 'consulting',
  description: '컨설팅 전용',
});

// 2. 세션 생성 시 타입 전달
const sessionCode = await FirebaseMultiUserService.createSession('세션A', 'consulting');

// 3. PromptGenerator 모드별 렌더링
{mode === 'consulting' && <Step stepNumber={0} title="음성-텍스트 변환" />}

// 4. Context 값 메모이제이션
const contextValue = useMemo(() => ({ 
  consultingContext, 
  setConsultingContext 
}), [consultingContext]);
```

### ❌ 할 수 없는 것

```typescript
// 1. 세션 타입 변경 시도
await set(ref(database, `sessions/${code}/type`), 'workshop'); // ❌

// 2. 워크샵 모드에서 컨설팅 Step 표시
{mode === 'workshop' && <Step title="음성-텍스트 변환" />} // ❌

// 3. Context 없이 직접 state 공유
// Step2에서 setToneAndManner → Step3에서 읽기 불가 ❌

// 4. react-quill 사용 (React 19 비호환)
import ReactQuill from 'react-quill'; // ❌
```

---

## 우선순위 판단 기준

### P0 (즉시 수정)
- 세션 타입 누락으로 인한 UI 깨짐
- Firebase 연결 실패로 데이터 손실
- TypeScript 컴파일 오류

### P1 (당일 수정)
- ConsultingContext 미적용으로 Step 2-3 설정 공유 안됨
- 워크샵↔컨설팅 전환 버튼 미제거
- 비밀번호 타입 선택 UI 누락

### P2 (주 단위 개선)
- 프롬프트 생성 로직 최적화
- CSS 스타일링 개선
- 성능 최적화 (useMemo, React.memo)

### P3 (월 단위 기능 추가)
- 추가 AI 프롬프트 템플릿
- 보고서 내보내기 형식 확장
- 다국어 지원

---

## 파일 수정 시 동시 업데이트 필요 항목

### GatewayAdminService.ts 수정 시
- ✅ **AdminGateway.tsx**: 비밀번호 생성 UI 업데이트
- ✅ **Gateway.tsx**: validatePassword 반환 타입 업데이트

### FirebaseMultiUserService.ts 수정 시
- ✅ **CultureMapFlow.tsx**: 세션 타입 읽기 로직 업데이트
- ✅ **database.rules.json**: Firebase 보안 규칙 동기화

### PromptGenerator.tsx 수정 시
- ✅ **CultureMapFlow.tsx**: mode prop 전달 로직 확인
- ✅ **ConsultingContextPanel.tsx**: Context 인터페이스 동기화

### types/culture.ts 수정 시
- ✅ **모든 컴포넌트**: 타입 import 업데이트
- ✅ **FirebaseMultiUserService.ts**: 인터페이스 동기화

---

## 개발 환경 설정

### 필수 도구
- Node.js 18+
- npm 9+
- VS Code (권장 확장: ESLint, Prettier, TypeScript)

### 실행 명령어
```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 타입 체크
npm run type-check

# Firebase 배포
npx firebase-tools deploy --only database
```

### 환경 변수
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
```

---

## 버전 관리

### 커밋 메시지 규칙
```
feat: 새 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
docs: 문서 수정
style: 코드 포맷팅
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

### 브랜치 전략
- `main`: 프로덕션 배포
- `develop`: 개발 통합
- `feature/*`: 기능 개발
- `fix/*`: 버그 수정

---

이 문서는 AI Agent가 프로젝트를 이해하고 올바르게 수정할 수 있도록 작성되었습니다.
일반적인 개발 지식은 포함하지 않으며, **프로젝트 특화 규칙**만을 명시합니다.
