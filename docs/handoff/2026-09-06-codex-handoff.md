# 인수인계 — 2026-09-06 새벽 (Claude → Codex 또는 다음 세션)

마스터 지시: "한도 때문에 멈출 수 있으니 언제나 Codex로 이어서 할 수 있도록." 이 문서는 그 목적 하나로 쓴다. 코드에서 확인할 수 있는 것은 적지 않고, 코드만 봐서는 모르는 상태·순서·결정만 적는다. 갱신 시각을 맨 위에 적는다.

갱신: 2026-09-06 02:10 KST. 라이브 = 배포 버전 82c5eb9e (커밋 173a3b2, origin/main 동일).

## 1. 지금 돌고 있는 것 (Claude 워크플로 — 끊기면 여기서 이어받는다)

각 워크플로는 작업 트리에 **커밋하지 않은** 변경을 남긴다. 끊겼다면 `git status --short` 로 무엇이 남았는지 보고, 아래 "끝났을 때 할 일"을 따른다.

| 이름 | 무엇을 | 손대는 파일(서로 겹치지 않음) | 끝났을 때 할 일 |
|---|---|---|---|
| stage0-inspector-first | 검사기가 자기 2D 시트부터 잡게: 클립 단위·wrap 델타, 14개 시트 캘리브레이션 후 `SPRITE-ANIMATION-STATIC-LOOP` BLOCKING, 베이커 `--clip` 연결(클립 템플릿 9종 움직이는 시트), 2D 리믹스 플레이스홀더 422 차단, Playwright devDependency 고정, play.clunk.games/g/<id> 경로 확인 | `scripts/sprite-sheet-audit-cli.ts`, `packages/core/src/sprite-sheet-review.ts`, `tests/sprite-sheet-review.test.ts`, `scripts/sprite-sheet-from-glb.mjs`, `scripts/template-library/{build,templates}.mjs`, `outputs/template-library/**`, `app/components/AssetCreationWorkbench.tsx`, `app/api/series/route.ts`, `package.json`(playwright), `scripts/qa-capture.mjs`, `docs/plans/sheet-motion-calibration-2026-09-06.md`, `docs/plans/play-subpath-check-2026-09-06.md` | `npm run core:test` + `node --import tsx --test tests/sprite-sheet-review.test.ts tests/studio-contract.test.mjs tests/product-commerce-contract.test.mjs` 초록 확인 → 커밋. **판매 중 farmhand-walk 시트 교체는 마스터 승인 전 금지**(계획 문서 7절). |
| paypal-subscriptions | PayPal 구독 레일. 계약: `app/api/_lib/paypal.ts`(readPayPalEnv·createPayPalClient{createSubscription,getSubscription,cancelSubscription,verifyWebhook}·mapSubscriptionEvent), 라우트 `app/api/billing/{subscribe,return,cancel,subscription}` + `app/api/billing/paypal/webhook`, D1 컬럼(provider_subscription_id·plan_interval·current_period_end·cancelled_at·updated_at, plan 'pro', 표 clunk_billing_events), UI `app/components/SubscribeButtons.tsx`·`SubscriptionCard.tsx`, `/pricing`·`/settings` 연결, `docs/billing/paypal-runbook.md` | 위 파일들 + `app/runtime-environment.ts`(PAYPAL_* 6개), `app/api/marketplace/billing.ts`(getBillingStatus 에 paypal), `app/api/_lib/clunk.ts`, `tests/paypal-client.test.ts`, `tests/billing-subscription-contract.test.mjs` | `npx tsc --noEmit`, 위 테스트 + `tests/billing-route-contract.test.mjs tests/product-commerce-contract.test.mjs tests/foundry-product-contract.test.mjs` → 커밋. 판매 잠금(`CLUNK_SALES_OPEN`) 미설정이면 `/api/billing/subscribe` 는 PayPal 호출 전에 409 여야 한다. |
| legal-pages-paypal | `/terms`·`/privacy`·`/refunds` 개정(PayPal USD 청구·구독 해지/환불·국외 이전 표에 PayPal·보존 기간) + 새 `/licensing`(polyfork.dev/licensing 식) + 푸터 링크 | `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/refunds/page.tsx`, `app/licensing/page.tsx`(신규), `app/components/SiteFooter.tsx`, sitemap 목록 | 워크플로는 `tests/legal-and-signout-contract.test.mjs` 를 **일부러 안 고친다**(다른 워크플로와 충돌 방지) — 보고서의 "깨지는 핀 → 새 문장" 목록대로 그 테스트를 고친 뒤 커밋. `[법률 검토]` 표시는 지우지 말 것. |
| farmer-v4-blender | 농부 캐릭터 v4: Blender 5.2.1(`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`)로 세 접근(refine/rebuild/sculpt) → 3관점 심사 → 종합 | `tmp/character/v4/**`(lib.py, render.py, 접근별 폴더, final/), `examples/generated/characters/v4/**` | 산출물은 **등록·공개하지 않는다.** `tmp/character/v4/final/sheet.png` 와 `report.md` 를 마스터에게 보여 주고 판단을 받는다. |

## 2. 라이브에 올리는 절차 (밤새 검증된 순서)

1. 깨끗한 배포 트리 `C:\Users\50106\Desktop\Clunk-deploy` 를 커밋으로 옮긴다: `git checkout --detach <커밋>`. 이 트리는 `node_modules`·`outputs` 가 정션이다. `public/market/<슬러그>` 는 git 밖이라 판매 파일이 바뀐 슬러그만 폴더째 복사한다(`rm -rf` 후 `cp -r`).
2. 전체 테스트를 창 없이 돌린다: `powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath cmd.exe -ArgumentList '/c cd /d C:\Users\50106\Desktop\Clunk-deploy && (npm test > tmp-testN.log 2>&1 && echo __TEST_DONE__ ok >> tmp-testN.log || echo __TEST_DONE__ FAIL >> tmp-testN.log)'"` — N 은 매번 새 번호. 10~12분. 마지막 줄 `__TEST_DONE__ ok` 와 `ℹ fail 0` 확인.
3. 배포 전 게이트 설정 확인: `dist/server/wrangler.json` 의 `assets.run_worker_first` 에 `"/market/*"` 가 있어야 한다(없으면 판매 GLB 가 무인증으로 새 나간다).
4. 배포: 배포 트리에서 `CLOUDFLARE_ACCOUNT_ID="$(sed -n 4p 'C:/Users/50106/Desktop/API/cloudflare Clunk API.txt' | tr -d '\r\n')" CLOUDFLARE_API_TOKEN="$(sed -n 7p 'C:/Users/50106/Desktop/API/cloudflare Clunk API.txt' | tr -d '\r\n')" node scripts/deploy-cloudflare.mjs`. 값은 절대 출력·커밋하지 않는다. "Received a malformed response from the API" 는 일시 오류 — 한 번 더 돌리면 된다.
5. 판매 파일이 바뀌었으면 메인 트리에서 같은 env 로 `node scripts/market-r2-sync.mjs --apply`(R2 업로드 + D1 byte_length). `--apply` 없이 돌리면 미리보기만 한다.
6. `git push origin main`. 라이브 확인은 curl 만으로 끝내지 말고 브라우저 캡처로 본다(과거 사고).

## 3. 자격증명 위치 (값은 어디에도 적지 않는다)

- Cloudflare: `C:\Users\50106\Desktop\API\cloudflare Clunk API.txt` 4행 Account ID, 7행 API Token.
- Clunk MCP 키: `C:\Users\50106\Desktop\API\clunk mcp key.txt`.
- PayPal: `C:\Users\50106\Desktop\API\PayPal API.txt`(2026-09-06 새벽 마스터가 저장소 안에 두었던 것을 옮김). 5행 Client ID, 8행 Secret. **이 Secret 은 세션 기록에 노출되었으므로 PayPal 대시보드에서 재발급(regenerate)한 뒤 파일을 갱신해야 한다. 재발급 전에는 라이브 비밀값으로 넣지 말 것.** Live 앱인지 Sandbox 앱인지 마스터에게 확인.
- 로컬 개발 비밀값: `.dev.vars`(gitignore). PayPal 시험용은 `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PLAN_MONTHLY_ID`, `PAYPAL_PLAN_YEARLY_ID`.
- 운영 비밀값: 배포 트리에서 `sed -n <행>p <파일> | npx wrangler secret put <이름> --config dist/server/wrangler.json`(stdin 으로 넣어 화면에 안 남게).

## 4. 마스터가 아직 정하지 않은 것

1. USD 월·연 구독 가격(PayPal 은 KRW 청구 불가). 화면은 ₩9,900/₩99,000 + "PayPal 을 통해 USD 로 청구됩니다".
2. PayPal 비즈니스 계정 승인 → Live 앱 자격증명·웹훅 ID → `CLUNK_BILLING_PROVIDER=paypal` → `CLUNK_SALES_OPEN=1` 순서로 판매 개시. 그 전에 통신판매업 신고번호(약관 [확정 전]).
3. 농부 v4 채택 여부(시트 보고 판단).
4. farmhand-walk 판매 시트 교체(중복 24그룹) 여부.
5. 고객센터 `/support` 페이지와 결제 내역·영수증(PayPal 이 영수증 메일을 보내지만, 설정 화면에 결제 내역 표를 두고 인쇄용 영수증을 제공하자는 제안) — 마스터가 2026-09-06 새벽에 물어봄, 승인되면 PayPal 워크플로 뒤에 붙인다.

## 5. 밤새 굳은 규칙 (어기면 마스터가 바로 잡아낸다)

- 방문자 문구: 제목 한 낱말 + 한 문장, 설명·메타 금지, 용어집 `docs/copy-glossary.ko.md`. "베타 기간에는 무료" 표현으로 통일(요금·푸터 포함). 화면 이름 "에셋 제작", 카드 배지 "구독자 전용", 렌더 칸 "엔진 렌더", 만들기 입력은 "프롬프트".
- 실물 에셋만. 대체물·플레이스홀더 금지. 판매 파일을 고치면 preview GLB·hero PNG·preview webp·등록부·증거 사진까지 같은 파일 기준으로 다시 만들고 R2/D1 동기화.
- 검사기: `GEO-PART-PENETRATION` 은 바퀴 관통만 ERROR, 나머지 INFO. 점수는 6 항목 평균, WARNING 3점.
- 브랜드: 후광 없는 워드마크 `public/brand/clunk-wordmark-flat.png`, C 마크 `clunk-mark-flat.png`, 어두운 테마 후광은 CSS. 옛 파란 슬래브 SVG 는 쓰지 않는다.
- 개발 서버는 한 트리에 하나만(`node_modules/.vite` 공유로 서로 죽인다). 죽으면 다른 vinext 프로세스 종료 → `rm -rf node_modules/.vite` → 다시 띄운다.
- 테스트 핀은 문장 변경과 같은 커밋에서 고친다. 배포 트리의 전체 테스트가 최종 판정이다(메인 트리의 dist 는 낡아 rendered 테스트가 거짓 실패한다).

## 6. 참고 문서

- 게임 에이전트 계획: `docs/plans/game-agent-2026-09-06.md`(0단계가 지금 돌고 있는 stage0).
- 검사기 관통 감사표: `tmp/qa/interpenetration-audit.md`.
- PayPal 안내서: `docs/billing/paypal-runbook.md`(워크플로가 만드는 중).
- Claude 메모리(요약본): `C:\Users\50106\.claude\projects\C--Users-50106-Desktop-Clunk\memory\MEMORY.md` — Codex 가 못 읽으면 이 문서가 그 요약이다.
