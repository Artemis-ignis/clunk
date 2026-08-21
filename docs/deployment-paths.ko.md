# Clunk 공개 배포 경로 정리 (2026-08-20)

현재 Clunk는 로컬 개발 서버·production build·로컬 Wrangler(D1) 런타임 검증까지 통과했지만 **공개 URL은 없습니다**. 이 문서는 실제 배포 선택지를 사실대로 정리합니다. 마감(모두의창업 1차 서면)에는 공개 URL이 필수가 아니므로, 배포는 제출과 분리해 진행해도 됩니다.

## 경로 A — OpenAI Sites 배포 (설계상 기본 경로)

- 이 앱은 `@openai/sites-vite-plugin` + vinext 기반이며, `.openai/hosting.json`(D1-only)과 build 산출물의 Sites 메타데이터·D1 마이그레이션 스테이징(preflight 5/5 PASS)까지 배포 준비가 끝나 있습니다.
- **막힌 지점**: `create_site` / `deploy_site_version` / `deploy_private_site_version` / `get_deployment_status` 배포 커넥터가 Codex·Claude Code 어느 세션에도 노출된 적이 없습니다(2026-08-20 기준, 반복 확인).
- **인증 이점**: Sites 호스트가 ChatGPT SIWC 헤더를 주입하므로 현재 인증 구조를 **수정 없이** 그대로 사용합니다.
- **해야 할 일**: Sites 배포 커넥터가 열리는 환경(ChatGPT 내 Codex 등)에서 배포 실행 → 배포본 브라우저 검증. 커넥터 노출 여부는 세션마다 재확인.

## 경로 B — Cloudflare 직접 배포 (기술적으로 가능, 인증 대체 필요)

- build가 `dist/server/wrangler.json`을 생성하며, 이 구성으로 로컬 `wrangler dev`(Workers+D1) 검증을 이미 통과했습니다. 따라서 `wrangler deploy`+실계정 D1로 올리는 것 자체는 가능합니다.
- **결정적 제약**: SIWC 인증 헤더는 Sites 호스트가 주입합니다. 일반 Cloudflare 배포에는 그 호스트가 없으므로 **보호 라우트(/app·/dashboard·/settings)와 저장 API가 통째로 잠깁니다**. 공개 배포하려면 인증 대체(예: 이메일 매직링크·OAuth)를 별도 구현해야 하며, 이는 소규모 작업이 아닙니다.
- **필요 자원**: 마스터의 Cloudflare 계정 인증(wrangler login — 마스터 직접), D1 실 데이터베이스 생성, 도메인(선택).
- **현실적 중간 단계**: 랜딩·문서 등 공개 페이지만 노출하고 보호 기능은 "비공개 파일럿(초대제)" 안내로 두는 마케팅-퍼스트 배포는 인증 대체 없이도 가능. 단, 제품 데모 URL로는 반쪽이므로 신청서에는 쓰지 않는다.

## 결정 원칙

1. 1차 서면 제출(9/17)은 공개 URL 없이 로컬 실행 증거(이미지·영상·해시 체인)로 제출한다 — 공고상 URL 요구는 선택 영상뿐.
2. Sites 커넥터가 열리면 경로 A를 즉시 실행한다(수정 0).
3. 파일럿 모집 시점까지 커넥터가 안 열리면, 경로 B의 인증 대체 설계를 별도 과제로 승격해 마스터 승인 후 착수한다.
4. Vercel 등 다른 호스팅 우회는 하지 않는다(기존 합의 유지).
