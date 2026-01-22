# Cloud Run 배포 가이드 (LiteLLM Proxy)

## 0) 준비
- GCP 프로젝트 생성
- 결제 계정 연결
- Cloud Run / Artifact Registry / Cloud Build API 활성화

## 1) 변수 설정
- PROJECT_ID: GCP 프로젝트 ID
- REGION: 예) us-central1
- REPO: 예) litellm
- SERVICE: 예) litellm-proxy
- IMAGE: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest

## 2) Artifact Registry 생성
- 리전: REGION
- 형식: Docker

예시 명령:
```bash
gcloud artifacts repositories create ${REPO} \
  --repository-format=docker \
  --location=${REGION} \
  --description="LiteLLM proxy"
```

## 3) 이미지 빌드 및 푸시
- 작업 위치: litellm-proxy
- Dockerfile은 LiteLLM 공식 이미지 기반 사용
- 빌드/푸시는 Cloud Build 사용 권장

예시 명령:
```bash
gcloud builds submit \
  --region=${REGION} \
  --tag ${IMAGE}
```

## 4) Cloud Run 배포
- 포트: 4000
- 환경 변수:
  - GEMINI_API_KEY
  - LITELLM_MASTER_KEY
- 인증: 권장 설정은 인증 필요 (사설 프록시)

예시 명령:
```bash
gcloud run deploy ${SERVICE} \
  --image ${IMAGE} \
  --region ${REGION} \
  --platform managed \
  --port 4000 \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY,LITELLM_MASTER_KEY=YOUR_MASTER_KEY \
  --no-allow-unauthenticated
```

## 5) 헬스체크
- /health 또는 /v1/models (프록시 응답 확인)

## 6) 앱 연동
- 프록시 URL을 앱의 API base로 설정
- OpenAI 호환 엔드포인트: /v1/chat/completions
