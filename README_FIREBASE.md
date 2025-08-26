# 조직문화 분석도구 - Firebase 버전

이 프로젝트는 원본 Socket.IO 기반 멀티유저 버전을 Firebase로 변환한 버전입니다.

## 🔥 Firebase 설정

### 1. Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com)에 접속
2. 새 프로젝트 생성
3. Realtime Database 활성화 (테스트 모드로 시작)

### 2. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 Firebase 설정값을 입력:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_APP_ENV=development
```

## 🚀 실행 방법

### 개발 모드 (Firebase)
```bash
npm run dev -- --mode firebase
```

### 빌드 (Firebase 용)
```bash
npm run build -- --mode firebase
```

## 📋 변경사항

### 주요 변환 작업
1. **FirebaseMultiUserService 생성**: Socket.IO 기반 MultiUserService를 Firebase Realtime Database로 대체
2. **실시간 동기화**: Firebase의 실시간 데이터베이스를 활용한 실시간 협업
3. **세션 관리**: Firebase 기반 세션 코드 시스템
4. **사용자 관리**: Firebase의 presence 시스템 활용

### 기능 비교
| 기능 | Socket.IO 버전 | Firebase 버전 |
|------|---------------|---------------|
| 실시간 동기화 | ✅ | ✅ |
| 세션 관리 | ✅ | ✅ |
| 사용자 수 표시 | ✅ | ✅ |
| 웹 배포 가능 | ❌ | ✅ |
| 서버 필요 | ✅ | ❌ |
| 확장성 | 제한적 | 높음 |

## 🌐 배포

### Vercel 배포
1. Vercel에 리포지토리 연결
2. 환경변수 설정 (Firebase 설정값들)
3. 배포 명령어: `npm run build -- --mode firebase`
4. 또는 수동 배포:
```bash
npm run build -- --mode firebase
npx vercel --prod
```

### Netlify 배포  
1. Netlify에 리포지토리 연결
2. 빌드 설정: `npm run build -- --mode firebase`
3. Publish directory: `dist`
4. 환경변수 설정 (Firebase 설정값들)
5. 또는 수동 배포:
```bash
npm run build -- --mode firebase
npx netlify deploy --prod --dir=dist
```

## 🔧 개발자 참고사항

### Firebase 규칙 설정
Realtime Database 규칙을 다음과 같이 설정 권장:
```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### 주요 파일
- `src/services/FirebaseMultiUserService.ts`: Firebase 멀티유저 서비스
- `src/lib/firebase.ts`: Firebase 초기화 설정
- `vite.config.ts`: Firebase 모드 설정
- `src/vite-env.d.ts`: 환경변수 타입 정의

이 버전은 원본 기능을 모두 유지하면서 웹 배포가 가능한 Firebase 기반으로 변환되었습니다.# Firebase 기반 조직문화 분석도구
