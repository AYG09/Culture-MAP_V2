# LiteLLM Proxy (Gemini)

이 폴더는 LiteLLM 프록시를 별도 서비스로 실행하기 위한 템플릿입니다.

다른 프로젝트로 복사해 재사용하는 방법은 [USAGE.md](USAGE.md)를 참고하세요.

## 준비
1. `.env.example`을 `.env`로 복사하고 값 입력
2. `config.yaml`에서 모델 매핑 확인

## 실행 (Docker Compose)
```bash
docker compose up -d
```

## 테스트 (OpenAI 호환 API)
```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -d '{
    "model": "gemini-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 참고
- LiteLLM은 별도 서비스로 운영됩니다.
- 앱(Vite)은 이 프록시를 호출하도록 별도 연동이 필요합니다.

## Cloud Run 배포
- 상세 가이드: [cloudrun.md](cloudrun.md)
