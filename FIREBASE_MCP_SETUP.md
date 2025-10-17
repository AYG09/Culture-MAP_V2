# Firebase MCP (Model Context Protocol) 공식 구축 가이드

## 📋 목표
Firebase Admin SDK를 기반으로 공식 MCP 표준을 따라 Firebase MCP 서버 구축

## 🏗️ 프로젝트 구조

### 1. 계층 1: Firebase 기본 설정
```
firebase-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # MCP 서버 진입점
│   ├── firebase/
│   │   ├── client.ts           # Firebase Admin SDK 초기화
│   │   ├── auth.ts             # Authentication 관련 작업
│   │   ├── database.ts         # Realtime Database 작업
│   │   ├── firestore.ts        # Cloud Firestore 작업
│   │   └── storage.ts          # Cloud Storage 작업
│   ├── mcp/
│   │   ├── tools.ts            # MCP Tool 정의
│   │   ├── resources.ts        # MCP Resource 정의
│   │   └── prompts.ts          # MCP Prompt 정의
│   └── types/
│       └── firebase.ts         # Firebase 관련 타입
├── .env.example
└── README.md
```

## 📌 공식 표준 준수 사항

### 1. Firebase Admin SDK 버전
- **SDK**: Node.js Admin SDK v12.1.0 이상
- **Node.js 버전**: 18 이상 (권장: 20 LTS)

### 2. 인증 방식 (3가지)
1. **Google 환경 (권장)**: Application Default Credentials (ADC)
2. **서비스 계정 키**: 환경 변수 `GOOGLE_APPLICATION_CREDENTIALS`
3. **OAuth 2.0 갱신 토큰**: 선택적 인증

### 3. MCP 표준 준수
- **프로토콜**: Model Context Protocol v1
- **전송 방식**: stdio (표준 입출력)
- **도구(Tools)**: Firebase 작업 노출
- **리소스(Resources)**: Firebase 설정/데이터 노출
- **프롬프트(Prompts)**: Firebase 작업 지침 제공

## 🔑 필요한 환경 변수

```env
# Firebase 프로젝트 ID
FIREBASE_PROJECT_ID=your-project-id

# Google 서비스 계정 인증 (2가지 방식)
# 방식 1: 환경 변수 (권장)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# 방식 2: 서비스 계정 정보 (JSON)
FIREBASE_SERVICE_ACCOUNT_JSON={...}

# Firebase Realtime Database URL (선택사항)
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Cloud Storage 버킷 (선택사항)
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

## 🎯 MCP 도구(Tools) 목록

### Authentication 도구
- `signInWithEmail`: 이메일로 로그인
- `createUser`: 사용자 계정 생성
- `deleteUser`: 사용자 삭제
- `updateUserProfile`: 사용자 프로필 업데이트
- `getUserInfo`: 사용자 정보 조회
- `generateCustomToken`: 커스텀 토큰 생성
- `verifyIdToken`: ID 토큰 검증

### Realtime Database 도구
- `getRealtimeDatabase`: 데이터베이스 데이터 조회
- `setRealtimeDatabaseValue`: 데이터 저장
- `updateRealtimeDatabaseValue`: 데이터 업데이트
- `deleteRealtimeDatabaseValue`: 데이터 삭제
- `queryRealtimeDatabase`: 데이터 쿼리

### Cloud Firestore 도구
- `getFirestoreDocument`: 문서 조회
- `setFirestoreDocument`: 문서 저장
- `updateFirestoreDocument`: 문서 업데이트
- `deleteFirestoreDocument`: 문서 삭제
- `queryFirestoreCollection`: 컬렉션 쿼리

### Cloud Storage 도구
- `uploadToStorage`: 파일 업로드
- `downloadFromStorage`: 파일 다운로드
- `deleteFromStorage`: 파일 삭제
- `listStorageFiles`: 파일 목록 조회

### 프로젝트 관리 도구
- `getProjectInfo`: 프로젝트 정보 조회
- `listFirebaseServices`: Firebase 서비스 목록
- `checkSecurityRules`: 보안 규칙 검증

## 📦 의존성

```json
{
  "dependencies": {
    "firebase-admin": "^12.1.0",
    "@modelcontextprotocol/sdk": "^0.7.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}
```

## 🔐 보안 고려사항

### 1. 서비스 계정 키 관리
```bash
# ❌ 하지 말 것
- 서비스 계정 키를 코드에 하드코딩
- Git 저장소에 service-account-key.json 커밋

# ✅ 해야 할 것
- 환경 변수로 GOOGLE_APPLICATION_CREDENTIALS 설정
- GitHub Secrets에 키 저장
- 정기적으로 키 회전
```

### 2. 권한 최소화
```javascript
// Firebase Console에서 커스텀 IAM 역할 생성
// 필요한 권한만 부여
{
  "includedPermissions": [
    "firebase.projects.get",
    "firebasedatabase.instances.get",
    "firestore.databases.get",
    "storage.buckets.get"
  ]
}
```

### 3. 보안 규칙
```json
{
  "rules": {
    ".read": "root.child('role').val() === 'admin'",
    ".write": "root.child('role').val() === 'admin'"
  }
}
```

## 📝 구현 단계

### Phase 1: 기본 설정 (1-2 일)
1. [ ] Firebase Admin SDK 설정
2. [ ] MCP 프로토콜 구현
3. [ ] 기본 도구(Tools) 구현

### Phase 2: 핵심 서비스 (3-5 일)
1. [ ] Authentication 도구
2. [ ] Realtime Database 도구
3. [ ] Cloud Firestore 도구

### Phase 3: 고급 기능 (5-7 일)
1. [ ] Cloud Storage 도구
2. [ ] 프로젝트 관리 도구
3. [ ] 보안 규칙 검증

### Phase 4: 테스트 및 배포 (3-5 일)
1. [ ] 단위 테스트
2. [ ] 통합 테스트
3. [ ] MCP 클라이언트 호환성 테스트
4. [ ] 배포 (npm registry)

## 🧪 테스트 전략

### 1. 단위 테스트
```bash
npm run test:unit
```

### 2. 통합 테스트
```bash
npm run test:integration
```

### 3. MCP 호환성 테스트
```bash
# Claude Desktop에서 테스트
# VS Code MCP Extension에서 테스트
```

## 📚 공식 참고 자료

- [Firebase Admin SDK 공식 문서](https://firebase.google.com/docs/admin/setup)
- [MCP 공식 스펙](https://modelcontextprotocol.io/docs)
- [Firebase MCP 소스 코드](https://github.com/firebase/firebase-tools/blob/master/src/mcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## 🚀 배포 및 사용

### 1. npm 패키지로 배포
```bash
npm publish
```

### 2. Claude Desktop에서 사용
```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["@your-org/firebase-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"
      }
    }
  }
}
```

### 3. VS Code에서 사용
```json
{
  "mcp.servers": {
    "firebase": {
      "command": "npx",
      "args": ["@your-org/firebase-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"
      }
    }
  }
}
```

## 📊 체크리스트

- [ ] Firebase Admin SDK 초기화 구현
- [ ] MCP 서버 진입점 구현
- [ ] Authentication 도구 구현
- [ ] Realtime Database 도구 구현
- [ ] Cloud Firestore 도구 구현
- [ ] Cloud Storage 도구 구현
- [ ] 에러 처리 및 로깅
- [ ] 보안 규칙 검증
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] 문서 작성
- [ ] npm 배포 준비
- [ ] Claude Desktop 호환성 확인
- [ ] VS Code 호환성 확인

## 📅 타임라인

- **Week 1**: Firebase 기본 설정 + 기본 도구
- **Week 2**: 핵심 서비스 도구 구현
- **Week 3**: 고급 기능 + 테스트
- **Week 4**: 배포 및 문서화

---

**문서 버전**: 1.0  
**작성일**: 2025-10-17  
**상태**: 준비 단계
