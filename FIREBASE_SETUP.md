# Firebase Database 규칙 설정 가이드

## 🔥 Gateway 시스템을 위한 Firebase 설정

Gateway 관리자 시스템이 정상적으로 작동하려면 Firebase Realtime Database 규칙을 설정해야 합니다.

## 📋 설정 방법

### 1. Firebase Console 접속

1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택: `org-culture-analyzer`
3. 왼쪽 메뉴에서 **Realtime Database** 클릭
4. **규칙(Rules)** 탭 선택

### 2. 개발 환경 규칙 설정 (테스트용)

개발/테스트 환경에서는 간단한 규칙 사용:

```json
{
  "rules": {
    ".read": true,
    ".write": true,
    "gateway": {
      ".read": true,
      ".write": true,
      "passwords": {
        ".indexOn": ["sessionCode", "status", "type"]
      },
      "sessions": {
        ".indexOn": ["isActive", "passwordId"]
      }
    }
  }
}
```

### 3. 프로덕션 환경 규칙 설정 (보안 강화)

프로덕션 환경에서는 보안이 강화된 규칙 사용:

```json
{
  "rules": {
    "gateway": {
      "passwords": {
        ".read": true,
        ".write": true,
        ".indexOn": ["sessionCode", "status", "type"],
        "$passwordId": {
          ".validate": "newData.hasChildren(['password', 'type', 'createdAt', 'expiresAt', 'usedCount', 'status'])"
        }
      },
      "sessions": {
        ".read": true,
        ".write": true,
        ".indexOn": ["isActive", "passwordId"]
      }
    },
    "sessions": {
      ".read": true,
      "$sessionCode": {
        ".write": "!data.exists()",
        ".indexOn": ["host", "createdAt"]
      }
    }
  }
}
```

### 4. 규칙 배포

1. 규칙을 복사하여 Firebase Console의 규칙 편집기에 붙여넣기
2. **게시(Publish)** 버튼 클릭
3. 확인 메시지에서 **게시** 재확인

## 🔍 규칙 검증

규칙이 올바르게 설정되었는지 확인:

1. 앱 실행: `npm run dev`
2. 관리자 로그인: `WINTER09@!`
3. 관리자 패널 접근
4. 비밀번호 생성 테스트
5. Firebase Console에서 `/gateway/passwords` 경로에 데이터 생성 확인

## 📊 데이터베이스 구조

```
/gateway
  /passwords
    /{passwordId}
      - password: string
      - type: "admin" | "session"
      - sessionCode?: string
      - description?: string
      - createdAt: number
      - expiresAt: number
      - maxUses?: number
      - usedCount: number
      - status: "active" | "expired" | "exhausted"
  
  /sessions
    /{sessionCode}
      - host: string
      - createdAt: number
      - passwordId: string
      - isActive: boolean

/sessions
  /{sessionCode}
    - code: string
    - host: string
    - createdAt: timestamp
    - users: {...}
    - notes: {...}
    - connections: {...}
```

## ⚙️ 환경변수 설정

`.env` 파일에 Gateway 관리자 비밀번호 설정:

```env
VITE_GATEWAY_ADMIN_PASSWORD=WINTER09@!
```

## 🚀 Firebase CLI로 배포 (선택사항)

Firebase CLI를 사용하여 규칙을 배포할 수도 있습니다:

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 로그인
firebase login

# 규칙 배포
firebase deploy --only database
```

## 🔒 보안 권장사항

### 개발 환경
- `.read: true, .write: true` 사용 가능
- 빠른 개발과 테스트에 집중

### 프로덕션 환경
1. **인증 필수**: Firebase Authentication 통합
2. **규칙 검증**: `.validate` 사용하여 데이터 구조 강제
3. **인덱싱**: `.indexOn`으로 쿼리 성능 최적화
4. **읽기 제한**: 필요한 경로만 읽기 권한 부여
5. **쓰기 제한**: 인증된 사용자만 쓰기 가능

## 📞 문제 해결

### "Permission denied" 오류
- Firebase Console에서 규칙 확인
- 규칙이 게시되었는지 확인
- 브라우저 새로고침 후 재시도

### 데이터가 저장되지 않음
- 네트워크 탭에서 Firebase 요청 확인
- Console에서 오류 메시지 확인
- Firebase Console에서 직접 데이터 쓰기 테스트

### 세션 비밀번호가 생성되지 않음
- GatewayAdminService.ts의 createSessionPassword 로그 확인
- Firebase Console에서 `/gateway/passwords` 경로 확인
- 브라우저 콘솔에서 오류 메시지 확인
