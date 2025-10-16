# 🚪 Gateway Module 사용 예시

## 현재 프로젝트에 적용된 예시

### 1. App.jsx 적용 예시 (이미 적용됨)

```jsx
import Gateway from './components/Gateway.jsx';
import AdminGateway from './components/AdminGateway.jsx';
import './components/Gateway.css';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  const handleAuthenticated = (adminStatus) => {
    setIsAdmin(adminStatus);
    console.log('Gateway 인증 성공:', adminStatus ? '관리자' : '일반 사용자');
  };

  return (
    <Gateway onAuthenticated={handleAuthenticated}>
      {/* 기존 앱 컴포넌트들 */}
      <YourExistingApp />
      
      {/* 관리자만 접근 가능한 패널 */}
      {isAdmin && <AdminGateway />}
    </Gateway>
  );
}
```

### 2. 환경 변수 설정 (.env)

```env
# Gateway 관리자 비밀번호
GATEWAY_ADMIN_PASSWORD=WINTER09@!

# 기존 Supabase 설정 (재사용)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# 선택사항: 기본 임시 비밀번호 유효시간
GATEWAY_DEFAULT_EXPIRE_HOURS=24
```

### 3. 데이터베이스 설정

Supabase SQL Editor에서 실행:
```sql
-- gateway-module/database/gateway-schema.sql 파일의 내용 전체 실행
```

### 4. API 파일들 (이미 복사됨)

- `api/gateway-auth.js` - 로그인 인증
- `api/gateway-admin.js` - 임시 비밀번호 관리

## 🎯 주요 기능

### 관리자 기능
1. **영구 접근**: `WINTER09@!` 비밀번호로 언제든지 접근
2. **임시 비밀번호 생성**: 자동 생성 또는 수동 설정
3. **유효기간 설정**: 시간 단위로 만료 시간 설정
4. **사용 횟수 제한**: 최대 사용 횟수 설정 가능

### 사용자 기능
1. **임시 비밀번호 접근**: 관리자가 생성한 비밀번호로 접근
2. **자동 만료**: 설정된 시간 후 자동 만료
3. **사용 횟수 추적**: 사용 횟수 자동 카운트

## 🔧 다른 프로젝트에 적용하기

### 단계 1: 파일 복사
```bash
# 전체 gateway-module 폴더를 새 프로젝트에 복사
cp -r gateway-module /path/to/new/project/
```

### 단계 2: API 설치
```bash
# API 파일들을 api 폴더에 복사
cp gateway-module/api/* /path/to/new/project/api/
```

### 단계 3: 컴포넌트 통합
```jsx
// 새 프로젝트의 App.jsx
import Gateway from './gateway-module/components/Gateway';
import './gateway-module/components/Gateway.css';

function App() {
  return (
    <Gateway onAuthenticated={(isAdmin) => console.log('인증됨:', isAdmin)}>
      <YourApp />
    </Gateway>
  );
}
```

### 단계 4: 환경 변수 설정
```env
GATEWAY_ADMIN_PASSWORD=your_admin_password
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 단계 5: 데이터베이스 스키마 적용
```sql
-- gateway-module/database/gateway-schema.sql 실행
```

## 📱 사용 시나리오

### 시나리오 1: 베타 테스트
```javascript
// 관리자가 베타 테스터들에게 24시간 유효한 비밀번호 제공
// 관리자 패널에서 "BETA123" 생성 (24시간 후 만료)
```

### 시나리오 2: 워크샵/세미나
```javascript
// 행사 당일에만 사용 가능한 비밀번호
// "WORKSHOP2025" (8시간 후 만료, 50명 사용 제한)
```

### 시나리오 3: 임시 데모
```javascript
// 클라이언트 데모용 임시 접근
// "DEMO789" (2시간 후 만료, 5회 사용 제한)
```

## 🛡️ 보안 기능

- ✅ 비밀번호 해시화 (데이터베이스 저장시)
- ✅ 세션 토큰 관리
- ✅ 자동 만료 처리
- ✅ 사용 횟수 제한
- ✅ 접근 로그 기록
- ✅ IP 주소 추적

## 🎨 커스터마이징

### 스타일 변경
```css
/* gateway-module/components/Gateway.css 수정 */
.gateway-form {
  /* 색상, 폰트, 레이아웃 변경 */
}
```

### 설정 변경
```javascript
// gateway-module/utils/config.js 수정
export const GATEWAY_CONFIG = {
  defaultExpireHours: 12, // 기본 12시간으로 변경
  ui: {
    title: '우리 회사 접근 인증', // 제목 변경
  }
};
```

## 📞 문의 및 지원

이 Gateway 모듈을 다른 프로젝트에 적용하다가 문제가 생기면:

1. `INSTALL.md` 문서 확인
2. `README.md` 문서 참조
3. 개발자에게 문의

**모듈 버전**: v1.0.0  
**마지막 업데이트**: 2025년 9월 13일  
**호환성**: React 16.8+, Node.js 14+, PostgreSQL/Supabase