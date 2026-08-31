# Clunk Series GitHub 소스·라이선스 장부

작성일: 2026-08-28  ·  상태: 감사한 커밋을 고정한 개발 장부

Clunk Series는 외부 API를 호출하는 제품 묶음이 아닙니다. 아래 공개 저장소를 GitHub에서
clone해 읽고, 라이선스·커밋·실행 경계를 확인한 뒤, 호환되는 항목만 Clunk 내부 계약에
맞춰 채택하거나 재구성합니다. 실행 시 Clunk는 이 clone 디렉터리를 런타임에 참조하지
않습니다.

감사 clone 루트:

```text
C:\Users\50106\Documents\Codex\clunk-github-sources-20260828
```

## 고정된 소스

| Clunk 장부 ID | GitHub 저장소 | 감사 커밋 | 라이선스 | Clunk 결정 |
| --- | --- | --- | --- | --- |
| `gltf-transform` | [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | `e9feb829f071f6febfb68707ffc3146502325b34` | MIT | `adapted` · Clunk Game Ready GLB 변환 rail |
| `meshoptimizer` | [zeux/meshoptimizer](https://github.com/zeux/meshoptimizer) | `bf38bbcd760aeb82c7066360913302563e22d082` | MIT | `adapted` · 별도 meshopt 출력 rail |
| `material-maker` | [RodZill4/material-maker](https://github.com/RodZill4/material-maker) | `ad19fcf0ee34a7caf74df709dc4de7112f0d467d` | MIT | `adapted` · Clunk 소유 material graph 아이디어 |
| `real-esrgan` | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) | `a4abfb2979a7bbff3f69f58f58ae324608821e27` | BSD-3-Clause | `adapted` · 선택적 이미지 개선 연구 방향 |
| `blender-mcp-headless` | [digitable-lol/blender-mcp](https://github.com/digitable-lol/blender-mcp) | `ae010efa2a3f3d799ef1074d7cd3d9a7f36a0118` | MIT | `adapted` · Motion Lab의 로컬 runner 경계 |
| `trellis2` | [microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | `75fbf0183001ed9876c8dbb35de6b68552ee08bd` | 코드 MIT, 모델·의존성 조건 별도 | `research-only` · 기본 실행에 포함하지 않음 |
| `sprite-sheet-creator` | [blendi-remade/sprite-sheet-creator](https://github.com/blendi-remade/sprite-sheet-creator) | `4e0eeb413fc0ee1b3650957f47eb187dd4bdbf2d` | 감사 clone에 root license 파일 없음 | `excluded-license` · 코드와 번들 에셋을 복사하지 않음 |

## Clunk 내부 사용 원칙

1. 소스 저장소의 URL, 감사 커밋, clone 경로, 라이선스, 사용 결정을
   `packages/clunk-series/src/source-manifest.ts`에 같은 ID로 기록합니다.
2. MIT 또는 BSD-3-Clause처럼 호환되는 경우에도 Clunk 결과물을 원본 프로젝트의
   공식 결과라고 부르지 않습니다. 결과의 provider는 `clunk-series-native-v1`입니다.
3. TRELLIS.2는 Linux·NVIDIA GPU·상당한 VRAM 조건과 모델·의존성의 별도 조건 때문에
   연구 전용입니다. 모델 가중치를 제품에 포함했다고 말하지 않습니다.
4. `sprite-sheet-creator`는 라이선스를 확인할 수 없으므로 제품 코드·에셋·배포 번들에
   포함하지 않습니다. 화면 아이디어를 참고한 사실만 기록합니다.
5. Real-ESRGAN 같은 모델 계열은 BSD 코드 라이선스만으로 가중치 사용 권리가 자동으로
   생기지 않습니다. 가중치와 상업 사용 조건을 따로 확인하기 전에는 Clunk 실행 결과에
   포함하지 않습니다.
6. `productionReady`는 소스 라이선스만으로 true가 되지 않습니다. 입력 바이트,
   parse·policy·optimize·fresh recheck·blocker·score·다운로드 artifact reopen과
   runtime·player-facing·human review를 각각 확인해야 합니다.

## clone 갱신과 재감사

PowerShell에서 새 감사 디렉터리를 사용하고, 기존 Clunk 저장소 안으로 clone하지 않습니다.

```powershell
$sourceRoot = 'C:\Users\50106\Documents\Codex\clunk-github-sources-20260828'
New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
git clone https://github.com/donmccurdy/glTF-Transform (Join-Path $sourceRoot 'gltf-transform')
git -C (Join-Path $sourceRoot 'gltf-transform') checkout e9feb829f071f6febfb68707ffc3146502325b34
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'gltf-transform') -Include LICENSE,LICENCE,COPYING,NOTICE -Recurse
```

갱신할 때는 `source-manifest.ts`와 이 문서를 함께 바꾸고, 라이선스 파일·커밋·diff를
다시 확인합니다. 확인되지 않은 소스는 `research-only` 또는 `excluded-license`로 남기며,
기능을 성공처럼 표시하지 않습니다.

