# Vercel 배포 정보

## 프로덕션 URL
<https://culture-map-v2.vercel.app>

## 최근 배포 (2026-01-15)

- **커밋**: Liveblocks 룸 관리 최적화
- **배포 URL**: <https://culture-map-v2-lpe3frgou-aygs-projects.vercel.app>
- **Vercel 대시보드**: <https://vercel.com/aygs-projects/culture-map-v2>

## 환경변수 (Vercel에 설정됨)

| Key | 설명 |
|-----|------|
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | Liveblocks 공개 키 |
| `VITE_GEMINI_API_KEY` | Gemini AI API 키 |
| `VITE_APP_ENV` | 앱 환경 (production) |
| `VITE_SKIP_GATE` | 게이트웨이 활성화 여부 |
| `VITE_GATEWAY_ADMIN_PASSWORD` | 관리자 비밀번호 |
| `LIVEBLOCKS_SECRET_KEY` | Liveblocks Secret Key (Serverless Function용) |

## 새 기능 (2026-01-15)

- **개발 모드 고정 코드**: `VITE_APP_ENV=development`일 때 `DEV-LOCAL` 고정 세션 코드 사용
- **클라우드 룸 관리**: 관리자 패널에서 Liveblocks 룸 조회/삭제 가능
