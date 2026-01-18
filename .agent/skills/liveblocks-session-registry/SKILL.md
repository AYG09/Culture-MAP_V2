---
name: Liveblocks 세션 레지스트리 시드/동기화
description: 세션 목록이 비어 보이는 문제(DEV-LOCAL 포함) 재발 방지 체크리스트
lastUpdated: 2026-01-18
source: 프로젝트 경험 + Liveblocks/Yjs 운영 패턴
applies_to: Liveblocks, Yjs, Gateway 세션 목록
---

# Liveblocks 세션 레지스트리 시드/동기화

세션 입장에는 성공하지만 **세션 목록이 비어 보이는 문제**를 예방하기 위한 규칙입니다.

---

## 핵심 원칙

1. **세션 목록은 레지스트리에서만 렌더링**된다.
2. **createSession만 등록하면 joinSession/DEV-LOCAL은 누락**될 수 있다.
3. 등록 로직은 **멱등(idempotent)** 해야 한다.
4. 개발 환경은 **DEV-LOCAL 시드**가 필요할 수 있다.

---

## ✅ 점검 체크리스트

### 1) 등록 시점
- [ ] `joinSession()`에서 **호스트일 때 레지스트리 등록**을 수행하는가?
- [ ] `createSession()`과 `joinSession()` 간 **중복 등록 경로**를 제거했는가?

### 2) 멱등 처리
- [ ] 동일 코드 재등록 시 `createdAt`, `createdBy`를 유지하는가?
- [ ] 레지스트리 `Y.Map` 유무를 안전하게 처리하는가?

### 3) 개발 환경 시드
- [ ] 레지스트리 비어 있음 + 개발 환경이면 **DEV-LOCAL**을 자동 등록하는가?
- [ ] 시드 후 **재조회로 목록 반영**을 보장하는가?

---

## ✅ 올바른 예시 (DO)

- `joinSession(isHost=true)`에서 `registerSession()` 호출
- `registerSession()`에서 기존 항목이 있으면 `createdAt/createdBy` 유지
- 개발 환경 `registry.length === 0`이면 `DEV-LOCAL` 시드 후 재조회

## ❌ 잘못된 예시 (DON'T)

- `createSession()`에만 등록 로직을 두고 `joinSession()`은 무시
- DEV 환경에서 고정 코드만 쓰고 레지스트리 시드 누락
- 재등록 시 `createdAt`을 매번 덮어써 목록 순서가 뒤바뀌는 처리

---

## 적용 체크리스트

- [ ] 호스트 입장 시 레지스트리 등록 보장
- [ ] 등록 로직 멱등 처리 완료
- [ ] DEV-LOCAL 시드 및 재조회 확인
