# LiteLLM 프록시 재사용 가이드

이 폴더는 **어떤 프로젝트에도 그대로 복사해 재사용**할 수 있는 LiteLLM 프록시 템플릿입니다.

## 1) 다른 프로젝트로 옮기기
- 대상 프로젝트에 `litellm-proxy/` 폴더를 그대로 복사합니다.
- 아래 파일만 설정하면 됩니다.
  - `.env` (로컬/배포 환경 변수)
  - `config.yaml` (모델 라우팅)

## 2) 필수 설정
### `.env`
- `LITELLM_MASTER_KEY`: 프록시 인증 키
- `GEMINI_API_KEY`: Gemini API 키

### `config.yaml`
- 모델 이름 ↔ 실제 모델 매핑을 정의합니다.
- 앱에서 호출하는 모델 이름은 `config.yaml`에 있는 이름을 사용합니다.

## 3) 실행 방법
### 로컬
- Docker Compose로 실행합니다.

### Cloud Run
- 배포 후 **서비스 URL**을 앱에서 사용합니다.
- 인증은 두 가지 중 하나로 운영하세요.
  - 공개(권장 간단): Cloud Run 인증 해제 + 프록시 키로 보호
  - 비공개(고급): Cloud Run 인증 유지 + ID 토큰 사용

## 4) 앱에서 쓰는 방법 (중요)
- **브라우저에서 직접 호출하지 마세요.**
- 서버(백엔드)에서 프록시를 호출하고, 브라우저에는 결과만 내려주세요.
- 이유: `LITELLM_MASTER_KEY`가 노출되면 누구나 비용을 발생시킬 수 있습니다.

## 5) 보안 체크리스트
- `LITELLM_MASTER_KEY`는 서버 환경 변수로만 보관
- 키 노출 시 즉시 교체(rotate)
- 필요 시 Cloud Run 접근제어(IAM)로 추가 보호

## 6) 참고 문서
- 배포 가이드: [cloudrun.md](cloudrun.md)
- 기본 설정: [README.md](README.md)
