# Clunk Discover·Market 제품 경계

Clunk의 공개 `/marketplace`는 누구나 업로드하는 오픈 마켓이 아니라, 실제 파일과
검수 근거가 연결된 curated catalogue입니다. 공개 listing은 `PUBLISHED` 상태만
노출하고, Studio에서 만드는 첫 결과는 항상 Draft입니다.

## 공개 카드와 상세

카드는 preview, 이름, asset family, format, license 상태를 우선 보여 줍니다.
상세 페이지에서는 파일 구성과 네 개의 evidence lane을 확인할 수 있습니다.

```text
STATIC / BYTE → VISUAL RUNTIME → PLAYER-FACING → HUMAN REVIEW
```

정적 점수 하나만으로 구매·배포·게임 투입을 승인하지 않습니다. 공개 카탈로그의
검색·family filter는 현재 실제 `PUBLISHED` rows에만 적용되고, 계약 fixture는
판매 상품이 아닌 샘플로 분리되어 표시됩니다.

## Publication gate

`PUBLISHED` 승격에는 최소한 다음이 필요합니다.

- artifact가 실제 저장소에 존재함
- provenance/provider가 완전함
- license 상태가 정리됨
- static, runtime, player-facing, human review가 각각 PASS

이 규칙은 `packages/core/src/product-contract.ts`와 `/api/marketplace`가 공유합니다.
실패하면 listing은 Draft/검토 상태에 남고, UI는 readiness를 보여 줍니다.

## 결제와 권한

결제는 설정된 provider가 있을 때만 실제로 시작됩니다. 현재 운영 환경에
`CLUNK_BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`가
없으면 `/api/marketplace/checkout`은 주문을 만들지 않고 명시적인
`PAYMENT_PROVIDER_NOT_CONFIGURED`를 반환합니다. 가격을 표시하는 것과 결제가
완료된 것은 서로 다른 상태입니다.

Stripe가 설정되면 흐름은 다음과 같습니다.

1. 서버가 `PUBLISHED` listing의 가격·통화·판매자를 다시 읽고 구매 가능성을 확인합니다.
2. idempotency key로 `CREATING → PENDING` 주문을 만들고 Stripe Checkout URL을 저장합니다.
3. `/api/marketplace/webhook`이 서명, order/listing, 금액·통화를 검증합니다.
4. 검증된 `PAID` 이벤트만 `clunk_marketplace_entitlements`의 `ACTIVE` 권한을 발급합니다.
5. 유료 artifact는 활성 entitlement가 있는 계정만 다운로드할 수 있습니다. 공개 preview는
   `preview=1`과 page/texture 역할에 한해서만 허용합니다.
6. 취소·환불은 주문 상태와 entitlement를 각각 `CANCELED`·`REVOKED`로 기록하며,
   중복 webhook은 상태를 다시 부여하지 않습니다.

이 계약은 provider 계정과 secret이 없는 로컬 환경에서도 테스트할 수 있지만, 실제
결제·환불·다운로드 완료 판정은 Stripe sandbox webhook을 운영 환경에서 재현해야 합니다.
