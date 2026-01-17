---
name: 코드 안전성 체크 (Code Safety Checks)
description: 코드 수정 시 변수 스코프, 의존성 배열, 서비스 호출 등 런타임 오류 방지 규칙
source: Culture-MAP V2 개발 중 발견된 오류 패턴
---

# 코드 안전성 체크 Skill

코드 수정 시 **런타임 오류(ReferenceError, TypeError 등)**를 방지하기 위한 필수 체크리스트입니다.

---

## 🚨 발생 사례

### 사례: `ReferenceError: initialNotes is not defined`

**원인**: `handleGenerateReport` 함수 내에서 `initialNotes` 변수를 사용했으나, 해당 변수가 컴포넌트 스코프에 정의되어 있지 않음.

**잘못된 코드:**
```typescript
const handleGenerateReport = useCallback(async () => {
  const notesList = initialNotes || [];  // ❌ initialNotes 미정의
  const connectionsList = initialConnections || [];  // ❌ initialConnections 미정의
}, [isGeneratingReport, initialNotes, initialConnections]);  // ❌ 의존성 배열에 undefined 변수
```

**올바른 코드:**
```typescript
const handleGenerateReport = useCallback(async () => {
  // ✅ 서비스에서 직접 가져오기
  const notesList = liveblocksService.getNotesArray();
  const connectionsList = liveblocksService.getConnectionsArray();
}, [isGeneratingReport]);  // ✅ 외부 서비스 호출이므로 의존성 불필요
```

---

## ✅ 필수 체크리스트

### 1. 변수 스코프 확인

코드 수정 전 **반드시** 사용하려는 변수가 어디서 오는지 확인:

```
[ ] 컴포넌트 props에 정의되어 있는가?
[ ] useState/useRef로 선언되어 있는가?
[ ] 상위 스코프에서 정의되어 있는가?
[ ] 서비스/유틸리티에서 가져와야 하는가?
```

**확인 방법:**
```bash
# 변수 정의 위치 검색
grep -n "const variableName" src/components/TargetFile.tsx
grep -n "variableName:" src/components/TargetFile.tsx  # props 확인
```

### 2. useCallback/useMemo 의존성 배열

| 상황 | 의존성 배열 처리 |
|------|-----------------|
| 컴포넌트 state 사용 | 의존성에 포함 |
| props 사용 | 의존성에 포함 |
| 서비스 싱글톤 호출 | 의존성 불필요 (외부에서 최신값 가져옴) |
| 상수/정적 값 | 의존성 불필요 |

**잘못된 예:**
```typescript
// ❌ undefined 변수를 의존성에 포함
}, [isGeneratingReport, undefinedVariable]);
```

### 3. 서비스 싱글톤 데이터 접근

Culture-MAP V2에서 공유 데이터는 **LiveblocksService**를 통해 접근:

```typescript
// ✅ 올바른 패턴
const notes = liveblocksService.getNotesArray();
const connections = liveblocksService.getConnectionsArray();
const chatMessages = liveblocksService.getChatMessages();

// ❌ 잘못된 패턴 (존재하지 않는 변수 사용)
const notes = initialNotes;
const connections = props.connections;  // props에 없는 경우
```

### 4. 수정 후 빌드 검증

**모든 코드 수정 후 반드시 빌드 테스트:**

```bash
npm run build
```

빌드 성공 시에도 **런타임 오류**가 발생할 수 있으므로:
- 브라우저 콘솔에서 `ReferenceError`, `TypeError` 확인
- 해당 기능 실제 테스트 필수

---

## 🔍 오류 패턴 및 해결

| 오류 | 원인 | 해결 |
|------|------|------|
| `ReferenceError: X is not defined` | 변수가 스코프에 없음 | 변수 정의 위치 확인 또는 서비스에서 가져오기 |
| `TypeError: Cannot read properties of undefined` | 객체가 undefined인데 속성 접근 | Optional chaining (`?.`) 또는 null 체크 |
| React 의존성 배열 경고 | 사용된 변수가 의존성에 없음 | ESLint exhaustive-deps 규칙 따르기 |

---

## 📋 수정 전 체크리스트

```
[ ] 사용하려는 모든 변수의 정의 위치를 확인했는가?
[ ] useCallback/useMemo 의존성 배열이 올바른가?
[ ] 서비스 싱글톤에서 데이터를 가져오는 경우 올바른 메서드를 사용했는가?
[ ] npm run build 성공했는가?
[ ] 브라우저에서 런타임 오류 없이 동작하는가?
```
