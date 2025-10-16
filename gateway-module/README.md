# Gateway Authentication Module

이 모듈은 웹 애플리케이션에 접근 제어 기능을 추가하는 재사용 가능한 대문(Gateway) 시스템입니다.

## 🚪 기능

- **관리자 인증**: 영구 관리자 비밀번호로 언제든지 접근 가능
- **임시 비밀번호**: 유효기간이 있는 임시 비밀번호 생성 및 관리
- **자동 만료**: 설정된 시간이 지나면 임시 비밀번호 자동 만료
- **보안**: 비밀번호 해시화 및 안전한 세션 관리
- **UI 통합**: React 컴포넌트로 쉽게 통합 가능

## 📁 폴더 구조

```
gateway-module/
├── README.md              # 이 문서
├── INSTALL.md             # 설치 가이드
├── components/            # React 컴포넌트
│   ├── Gateway.jsx        # 메인 대문 컴포넌트
│   ├── Gateway.css        # 스타일링
│   └── AdminGateway.jsx   # 관리자 패널
├── api/                   # API 엔드포인트
│   ├── gateway-auth.js    # 인증 검증
│   └── gateway-admin.js   # 임시 비밀번호 관리
├── database/              # 데이터베이스 스키마
│   └── gateway-schema.sql # 테이블 생성 SQL
├── utils/                 # 유틸리티 함수
│   ├── gateway-utils.js   # 헬퍼 함수들
│   └── config.js          # 설정 파일
└── package.json           # 의존성 정보
```

## 🚀 빠른 시작

1. **파일 복사**: `gateway-module` 폴더를 프로젝트에 복사
2. **데이터베이스**: `database/gateway-schema.sql` 실행
3. **API 설치**: `api/` 폴더의 파일들을 `/api/` 경로에 복사
4. **컴포넌트 통합**: React 앱에 `Gateway` 컴포넌트 추가
5. **환경변수 설정**: 관리자 비밀번호 설정

자세한 설치 방법은 `INSTALL.md`를 참조하세요.

## ⚙️ 환경 변수

```env
# 관리자 비밀번호 (필수)
GATEWAY_ADMIN_PASSWORD=your_admin_password

# 데이터베이스 연결 (Supabase 예시)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

## 📝 사용 예시

```jsx
import Gateway from './gateway-module/components/Gateway';

function App() {
  return (
    <Gateway onAuthenticated={() => console.log('인증 성공!')}>
      <YourMainApp />
    </Gateway>
  );
}
```

## 🔧 커스터마이징

- `utils/config.js`: 기본 설정 변경
- `components/Gateway.css`: 스타일 커스터마이징
- `utils/gateway-utils.js`: 로직 수정

## 📞 문의

이 모듈 사용 중 문제가 있으면 개발자에게 문의하세요.