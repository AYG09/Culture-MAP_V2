# Gateway Module 설치 가이드

## 📋 전체 설치 과정

### 1단계: 파일 복사

```bash
# gateway-module 폴더를 대상 프로젝트에 복사
cp -r gateway-module /path/to/your/project/
```

### 2단계: 데이터베이스 설정

#### Supabase 사용시:
1. Supabase 대시보드 → SQL Editor 열기
2. `database/gateway-schema.sql` 파일 내용 붙여넣기
3. "Run" 버튼 클릭하여 실행

#### 기타 PostgreSQL:
```bash
psql -d your_database -f gateway-module/database/gateway-schema.sql
```

### 3단계: API 엔드포인트 설치

#### Vercel/Next.js 프로젝트:
```bash
# API 파일들을 api 폴더에 복사
cp gateway-module/api/* /your-project/api/
```

#### Express.js 프로젝트:
- `gateway-module/api/` 파일들을 Express 라우터로 변환 필요
- 또는 Serverless Functions로 배포

### 4단계: 환경 변수 설정

`.env` 파일에 추가:
```env
# 관리자 비밀번호 설정 (필수)
GATEWAY_ADMIN_PASSWORD=WINTER09@!

# 데이터베이스 연결
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# 선택사항: 기본 임시 비밀번호 유효시간 (시간 단위, 기본값: 24)
GATEWAY_DEFAULT_EXPIRE_HOURS=24
```

### 5단계: React 컴포넌트 통합

#### App.jsx 수정:
```jsx
import React from 'react';
import Gateway from './gateway-module/components/Gateway';
import './gateway-module/components/Gateway.css';

function App() {
  return (
    <Gateway
      onAuthenticated={(isAdmin) => {
        console.log('인증됨:', isAdmin ? '관리자' : '일반 사용자');
      }}
    >
      {/* 기존 앱 컴포넌트들 */}
      <YourMainApp />
    </Gateway>
  );
}

export default App;
```

#### 관리자 패널 추가 (선택사항):
```jsx
import AdminGateway from './gateway-module/components/AdminGateway';

// 관리자 페이지에 추가
<AdminGateway />
```

### 6단계: 의존성 설치

```bash
npm install @supabase/supabase-js
# 또는
yarn add @supabase/supabase-js
```

### 7단계: 테스트

1. 애플리케이션 실행
2. 브라우저에서 접속
3. 대문 화면이 나타나는지 확인
4. 관리자 비밀번호로 로그인 테스트
5. 관리자 패널에서 임시 비밀번호 생성 테스트

## 🔧 커스터마이징

### 스타일 변경:
```css
/* gateway-module/components/Gateway.css 수정 */
.gateway-container {
  /* 여기서 스타일 커스터마이징 */
}
```

### 설정 변경:
```js
// gateway-module/utils/config.js 수정
export const GATEWAY_CONFIG = {
  defaultExpireHours: 24,
  maxTempPasswords: 10,
  // ... 기타 설정
};
```

## 🚨 문제 해결

### 1. "대문이 나타나지 않음"
- `Gateway` 컴포넌트가 최상위에 있는지 확인
- CSS 파일이 제대로 import되었는지 확인

### 2. "API 404 오류"
- API 파일들이 올바른 경로에 있는지 확인
- Vercel 배포 후 새로운 API가 반영되었는지 확인

### 3. "데이터베이스 연결 오류"
- 환경변수가 올바르게 설정되었는지 확인
- 데이터베이스 테이블이 생성되었는지 확인

### 4. "비밀번호가 인식되지 않음"
- `GATEWAY_ADMIN_PASSWORD` 환경변수 확인
- 대소문자 및 특수문자 정확히 입력했는지 확인

## 📱 다른 프레임워크 적용

### Vue.js:
- React 컴포넌트를 Vue 컴포넌트로 변환 필요
- API 부분은 그대로 사용 가능

### Angular:
- React 컴포넌트를 Angular 컴포넌트로 변환 필요
- API 부분은 그대로 사용 가능

### Vanilla JavaScript:
- HTML/CSS로 대문 화면 구현
- API 호출 부분만 사용

## 🔄 업데이트

새 버전이 나오면:
1. 기존 `gateway-module` 폴더 백업
2. 새 버전으로 교체
3. 커스터마이징한 부분 다시 적용
4. 데이터베이스 마이그레이션 (필요시)

---

문제가 있으면 개발자에게 문의하세요! 📞