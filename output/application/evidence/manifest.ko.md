# Clunk 모두의 창업 제출 증거 파일 목록

생성 기준일: 2026-08-21 (대한민국 표준시) · 사이트 프리미엄 다크 전면 재구축 반영 재촬영본

이 폴더의 PNG와 숏폼은 Playwright로 로컬 Clunk를 실제 실행한 화면·영상입니다. 2026-08-21 사이트 전면 재구축(프리미엄 다크)이 끝나 제출 후보 화면 캡처 6장(`11`, `12`, `13`, `22`, `23`, `24`)과 숏폼을 새 디자인 기준으로 다시 촬영했고, 파일명은 첨부 배치안과 어긋나지 않도록 그대로 유지했습니다. 재구축 이전 파일은 삭제하지 않고 `archive/*-pre-rebuild-20260821.*`로 보존했습니다. 이전 실행의 `01`, `02`, `05`, `15`, `16`, `17`, `18`과 제출에서 제외한 구형 숏폼도 `archive/`에 그대로 있습니다. `10-og-card.png`만 ImageGen으로 제작한 브랜드 카드이며, 분석 수치를 포함하지 않습니다. 아래 SHA-256은 이 목록과 실제 첨부 파일을 다시 대조할 때 사용하는 식별자입니다.

| 파일 | 성격 | 제출 판단 | 출처·식별자 |
| --- | --- | --- | --- |
| `11-landing-agentic-template-ko.png` | 재구축 랜딩 데스크톱 히어로·상단 뷰포트 | 제출 후보 | `http://localhost:3000/` 실제 렌더 (2026-08-21 프리미엄 다크 재구축본); 1440×900 뷰포트 캡처, 415091 bytes; SHA-256 `1a36c2b5e4e960f53eaa095a175ed830bc8b7616d9947363d4c906e47da3e35d`; 콘솔 오류 0건 |
| `12-landing-agentic-mobile-ko.png` | 재구축 랜딩 모바일 | 제출 후보 | `http://localhost:3000/` 실제 렌더 (2026-08-21 재구축본); 390×844, 138847 bytes; SHA-256 `c295a55333e93fa2405abbf926e95b9047e847a10c9ce3c7816b0ba562eab83f`; 콘솔 오류 0건 |
| `13-login-liquid-glass-ko.png` | 재구축 로그인·ChatGPT SIWC 진입 | 제출 후보 | `http://localhost:3000/login` 실제 렌더 (2026-08-21 재구축본); 1440×900 뷰포트 캡처, 1426395 bytes; SHA-256 `1cae0b699babe7e21f0b50c619b29130f30aaa4eea886f2dba7f9fb317514ac3`; 콘솔 오류 0건 |
| `14-dashboard-globe-evidence-ko.png` | Custom Globe 기반 빈 Workspace 구조 | UI 구조 보조; 제출 선택 보류 | `http://localhost:3000/dashboard` 이전 실행; 분석 결과 증거로 사용하지 않음 |
| `20-inspector-metadata-current-ko.png` | 실제 샘플 검사·3D 미리보기·finding | 이전 실행 보조; 최신본으로 대체 | 최신 SIWC 캡처는 `22-inspector-auth-current-ko.png` |
| `21-inspector-metadata-optimized-ko.png` | 실제 최적화·metadata 작업·전후 score·Passport·재검사 | 이전 실행 보조; 최신본으로 대체 | 최신 SIWC 캡처는 `23-inspector-auth-optimized-ko.png` |
| `19-dashboard-current-ko.png` | Custom Globe 기반 전체 대시보드 렌더 | 이전 local preview 보조; 최신본으로 대체 | 최신 D1 인증 캡처는 `24-dashboard-auth-d1-ko.png` |
| `22-inspector-auth-current-ko.png` | SIWC 인증 세션의 실제 샘플 검사·3D 미리보기·finding 4건·score 99 | 제출 후보 | `http://localhost:3000/app` 실제 파일 업로드·인증 세션 (2026-08-21 재구축본); 1440×1619 full-page, 245716 bytes; SHA-256 `e617fcec299adb91f78cb442e40f6f61753e1edaf54c160aab2dba3d14e98703`; 콘솔 오류 0건 |
| `23-inspector-auth-optimized-ko.png` | SIWC 인증 세션의 실제 최적화·전후 비교·Passport 패널·재검사(`조건부 준비` 라벨) | 제출 후보 | `http://localhost:3000/app` 실제 실행 (2026-08-21 재구축본); 1440×1963 full-page, 269050 bytes; SHA-256 `39b4eac3be5e7f821f3f3d511563affd353230db025d68865bc9617a14bb9883`; 콘솔 오류 0건 |
| `24-dashboard-auth-d1-ko.png` | SIWC 연결됨·크레딧 23·D1 저장 이력 2건·Passport 1건 대시보드(`조건부 준비` 라벨) | 제출 후보 | `http://localhost:3000/dashboard` 실제 인증 세션 (2026-08-21 재구축본); 1440×1665 full-page, 340999 bytes; SHA-256 `e21ddd72bb657e7ff270efc87213a1f43dbc01574272ca81d87102decd959c75`; 콘솔 오류 0건 |
| `clunk-demo-auth-final-ko.webm` | SIWC 인증 실제 브라우저 숏폼: 검사·최적화·재검사(`조건부 준비` 라벨)·다운로드·Dashboard | 숏폼 제출 후보; URL 미확보 | `http://localhost:3000/app` → `/dashboard` 실제 인증 실행 (2026-08-21 프리미엄 다크 재구축 재녹화본); 재생 길이 43.80초, 1280×720, 무음, 3972656 bytes; SHA-256 `03286dd300051f3df4445e55e1d68fa1cf6baac6cbcdfe11f3b614af7eab517e`; 콘솔 오류 0건 |
| `10-og-card.png` | 제품 OG/브랜드 카드 | 보조 브랜드 자료; 분석 증거로 사용하지 않음 | ImageGen 제작, 제품 결과 수치 없음; 1672×941, 1201151 bytes; SHA-256 `10f9aca39709feffce801bef5051ccb92b46c1d38dca582632774bd310b2eeb7` |
| `25-architecture-diagram-ko.png` | 제품 구조 개념도(입력 → Core 5단계 → 결과·저장, 4개 표면) | 제출 후보; "개념도" 표기로 실제 화면과 구분 | 결정론적 HTML/SVG 렌더(AI 이미지 아님), `tmp/architecture-diagram-ko.html` 소스; 3200×2020(2x), 329629 bytes; SHA-256 `df3560732adf5e07b0a18222b815894bf5894826523858434e6b56bd72020277` |

## 제출 상태

- 제출 후보 PNG: `11-landing-agentic-template-ko.png`, `12-landing-agentic-mobile-ko.png`, `13-login-liquid-glass-ko.png`, `22-inspector-auth-current-ko.png`, `23-inspector-auth-optimized-ko.png`, `24-dashboard-auth-d1-ko.png`, `25-architecture-diagram-ko.png` (현재 7장; 공식 제한 10장 이내)
- 2026-08-21 재구축 교체: 사이트를 프리미엄 다크 디자인으로 전면 재구축했고 이전 캡처·녹화의 화면이 현재 제품과 달라, 화면 캡처 6장(11·12·13·22·23·24)과 숏폼을 새 디자인에서 다시 촬영해 같은 파일명으로 교체했습니다. 첨부 배치안이 참조하는 파일명은 바꾸지 않았습니다.
- 재구축 이전본은 삭제하지 않고 `archive/`에 `-pre-rebuild-20260821` 접미사로 보존했습니다: `11`·`12`·`13`·`22`·`23`·`24` PNG 6장과 `clunk-demo-auth-final-ko-pre-rebuild-20260821.webm`·`.json`.
- `25-architecture-diagram-ko.png`는 화면 스크린샷이 아니라 개념도이고 내용이 여전히 유효하므로 재구축 재촬영 대상에서 제외해 그대로 유지했습니다.
- 랜딩(`11`)은 뷰포트 캡처입니다. 재구축 랜딩의 full-page 높이가 1440×8276이라 한 장 첨부용으로 지나치게 길고, 히어로가 100vh를 차지해 뷰포트를 키워도 아래 섹션이 함께 들어오지 않습니다. 그래서 지시된 대비책대로 1440×900 상단 뷰포트 캡처를 사용했습니다.
- 보조·선택 보류: `14-dashboard-globe-evidence-ko.png`, `19-dashboard-current-ko.png`, `20-inspector-metadata-current-ko.png`, `21-inspector-metadata-optimized-ko.png`는 이전 UI/실행 보조 자료이며 최신 인증 캡처로 대체했습니다.
- 이전 실행 보존본: `archive/` 아래 PNG는 현재 제출 후보에서 제외한 superseded 증거입니다.
- 2026-08-20 상태 라벨 개선(3단계: 준비 완료/조건부 준비/차단됨) 이전에 캡처한 `22`, `23`, `24` 구본은 `archive/*-pre-uxfix-20260820.png`로 보존되어 있습니다. 3단계 라벨은 재구축 이후에도 그대로 유지됩니다.
- 같은 라벨 개선 이전에 녹화한 숏폼 구본(52초, 800×450, SHA-256 `4cc2c953…874f08`)도 삭제하지 않고 `archive/clunk-demo-auth-final-ko-pre-uxfix-20260820.webm`과 `archive/clunk-demo-auth-final-ko-pre-uxfix-20260820.json`으로 보존했습니다. 저해상도 재녹화 1회차(47.04초, 800×450, SHA-256 `6aa49917…db3774`)는 `archive/clunk-demo-auth-final-ko-800x450-20260820.webm`·`.json`입니다.
- 브랜드 보조자료: `10-og-card.png`는 분석 수치를 포함하지 않으므로 결과 증거로 세지 않습니다.
- `10-og-card.png`를 제출 자료로 선택할 경우 생성 prompt·reference role·license/provenance를 별도로 기록해야 하며, 기록이 없으면 제출에서 제외합니다.
- 숏폼: `clunk-demo-auth-final-ko.webm`은 테스트용 SIWC 헤더를 주입한 실제 브라우저 실행 파일입니다. 재생 길이 43.80초는 파일의 EBML `Duration`(0x4489) × `TimecodeScale`(0x2AD7B1)을 직접 파싱해 측정했고(raw 43800 × 1000000ns), 30~60초 구간을 충족합니다. 해상도 1280×720은 파일의 `PixelWidth`/`PixelHeight`로 확인했고, Chromium `<video>`로 실제 디코딩해 `videoWidth`/`videoHeight` 1280×720과 재생 길이 43.8초를 재확인했습니다. 오디오 트랙이 없는 무음 파일입니다(WebM `TrackType`이 video 1개뿐). 재생·hash·흐름 근거는 `clunk-demo-auth-final-ko.json`에 고정했으며(해당 JSON 자체: 4,047 bytes, SHA-256 `91dd8ebcf27cf1afb3ad274721e97d2e336d11f6e24364b1a2759ced38f60563`), 공식 접수용 URL·공개 권한·재생 확인은 아직 마스터 확인 전입니다.
- 재촬영 6장·숏폼 모두 녹화·캡처 중 `console` error, `pageerror`, `requestfailed`가 각각 0건이었습니다.

## 실제 실행 기록

- 문제 샘플: `public/samples/clunk-messy-sample.glb`
- 입력 SHA-256: `181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1`
- 최적화 출력 SHA-256: `718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b`
- 최적화 작업: 빈 노드 제거 1회, 동일 머티리얼 dedupe 1회, allowlisted metadata 정리 1회 (`metadata-only`)
- 브라우저 다운로드 파일: 재구축 UI의 저장 이름은 `clunk-messy-sample.clunk-optimized.glb`이며, 이전 실행의 `clunk-messy-sample-clunk-optimized.glb`와 바이트가 동일합니다(908 bytes, SHA-256 `718f2fba…c8302b`).
- 2026-08-21 재녹화 중 실제로 내려받은 두 파일: `clunk-messy-sample.clunk-optimized.glb` 908 bytes / SHA-256 `718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b`, `passport-181473ff49e2-718f2fbaf454.json` 4213 bytes / SHA-256 `a5cb692a65d76115de84f0b2d3e37b4f3a3856be0ef5d1d52f3b9dd3f1f9f5bd`. 화면에 표시된 output hash와 다운로드 바이트의 해시가 일치합니다.
- 다운로드 파일 독립 CLI 재검사: parse 성공, 908 bytes, output hash 일치 (2026-08-21 재실행으로 재확인)

## 재현 명령

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run core:test
npm.cmd run build
npx.cmd tsx scripts/clunk-cli.ts inspect .playwright-cli/clunk-messy-sample-clunk-optimized.glb
```

화면에 보이는 score·finding·전후 숫자는 이 실행 결과에서 나온 값입니다. 실제 접수 화면에는 필요한 이미지 수만 선택하며, 화면에 없는 고객·매출·성능 수치를 추가하지 않습니다.
