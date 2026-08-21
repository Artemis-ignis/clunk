# Harvest Frontier ↔ Clunk 지속 협업 핸드오프

이 문서는 Clunk를 실제 게임 개발 중인 Harvest Frontier의 장기 에셋 검증 파트너로 연결하기 위한 내부 핸드오프입니다. Harvest Frontier의 runtime GLB를 공개 샘플로 재배포한다는 뜻이 아니며, 현재는 마스터 소유 프로젝트 사이의 비공개 파일럿 근거로만 사용합니다.

## 협업 원칙

- Harvest Frontier의 상용 완성 작업과 dirty 변경을 중단하거나 덮어쓰지 않습니다.
- Clunk는 우선 읽기 전용 검사기입니다. Harvest runtime GLB에 Clunk 자동 최적화를 적용하지 않습니다.
- Harvest 자체 validator의 `PASS`와 Clunk 범용 Game-Ready Score의 `READY`는 서로 다른 판정입니다.
- runtime GLB를 Clunk에 연결할 때는 source factory, export 단계, near/far LOD, semantic contract, provenance와 hash를 함께 보존합니다.
- 공개 샘플·다운로드·신청서 첨부에 Harvest 자산을 사용하려면 별도 cross-project 사용 권한을 확인합니다.

## 현재 실제 검증 corpus

검증 기준일: 2026-08-20 (KST). 경로는 Harvest Frontier의 현재 체크아웃을 가리킵니다.

| 파일 | bytes | SHA-256 | 삼각형 | material | empty node | missing normal | missing UV | non-unit scale | Clunk score | Clunk READY |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `cultivator.compact.m1.glb` | 189,912 | `18a720e4e55878eb64cdcd5da39fb02187741d0e1af7ed06ca2a279540519a50` | 16,196 | 20 | 0 | 6 | 42 | 111 | 99 | false |
| `cultivator.compact.m1.lod1.glb` | 104,760 | `464106711b59289dc0fd432b323fae691aec66deefff68e7f67c37306a098c3a` | 7,824 | 20 | 0 | 6 | 33 | 111 | 99 | false |
| `processing.line.m1.glb` | 435,532 | `dc2de953592988384f2cd0fed87350b8f6d4226003567ab837fc06a09f305fed` | 24,936 | 40 | 4 | 0 | 0 | 146 | 96 | false |
| `processing.line.m1.lod1.glb` | 199,700 | `2605f6fa3f477b569566b4db9b371c5c87554221c61a5edbf10317e3f3e2ba49` | 14,906 | 31 | 5 | 0 | 63 | 105 | 96 | false |
| `seeder.compact.m1.glb` | 557,888 | `b5ece82b0c814ad8ac7c028a5d14303ee2e0da9462bb386c47fdc58000733570` | 11,318 | 22 | 35 | 0 | 1 | 412 | 99 | false |
| `seeder.compact.m1.lod1.glb` | 219,100 | `72a6937833549abf43ecaf498ee4e950d2c91b0c824488b894e7cab8aaf3667c` | 6,460 | 18 | 39 | 0 | 55 | 272 | 99 | false |
| `tractor.compact.m1.glb` | 680,412 | `d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c` | 30,188 | 48 | 0 | 7 | 88 | 181 | 96 | false |
| `tractor.compact.m1.lod1.glb` | 509,584 | `5b457fc118613961793662111a3e69b75c7200c25f89368d3fb44841a056cf5f` | 18,668 | 48 | 0 | 7 | 77 | 181 | 96 | false |

이 표는 `C:\Users\50106\Desktop\Clunk`에서 현재 Clunk CLI로 실제 파일을 읽은 결과입니다. 고객 수·성능·매출을 의미하지 않으며, Harvest Frontier의 판매 가능성 판정도 아닙니다.

## 확인된 연결 경계

Harvest Frontier의 파이프라인은 다음 순서입니다.

```text
Three.js factory
  → raw GLB export
  → gltf-transform / Meshopt near·far
  → Harvest validator
  → GLTFLoader + MeshoptDecoder
  → 실제 브라우저·게임 검수
  → provenance hash
```

Clunk의 안전한 연결 지점은 다음과 같습니다.

```text
Harvest optimized GLB
  → Clunk inspect (read-only)
  → Harvest semantic validator
  → browser asset viewer
  → gameplay / packaged QA
  → Clunk Passport + Harvest provenance sidecar
```

현재 Clunk 범용 정책이 `READY=false`를 내는 주된 이유는 다음과 같습니다.

- procedural PBR이라 UV·텍스처가 없고, 동작은 glTF animation이 아니라 named pivot과 코드 업데이트로 수행됩니다.
- Meshopt·quantization으로 인한 raw accessor bounds와 실제 decode bounds를 구분해야 합니다.
- required node, pivot, socket, collider와 `sculptRuntime.assetId` 같은 semantic contract는 삭제하면 안 됩니다.
- near/far LOD, material·byte·triangle budget과 Harvest 자체 validator 계약을 Clunk 범용 material·geometry 규칙으로 대체할 수 없습니다.

따라서 현재 Clunk v1의 다음 작업은 Harvest runtime에 금지합니다.

- mesh simplification
- texture 재인코딩
- Draco/Meshopt 재압축
- quantization 변경
- animation·skin 변경
- unknown extension 변경
- semantic node·pivot·socket·collider 삭제

## provenance와 권한

Harvest Frontier의 `assets/provenance.json`과 `public/assets/provenance.json`은 현재 동일 hash를 가지며, runtime GLB 8종의 파일 hash가 선언값과 일치하는 것으로 교차 확인되었습니다. 원천 factory와 export/validate 경로는 Harvest 프로젝트의 다음 영역입니다.

- `C:\Users\50106\Desktop\Harvest Frontier\src\engine\assets\tractor.ts`
- `C:\Users\50106\Desktop\Harvest Frontier\src\engine\assets\seeder.ts`
- `C:\Users\50106\Desktop\Harvest Frontier\src\engine\assets\implements.ts`
- `C:\Users\50106\Desktop\Harvest Frontier\src\engine\assets\processingMachine.ts`
- `C:\Users\50106\Desktop\Harvest Frontier\tools\assets\export-*`
- `C:\Users\50106\Desktop\Harvest Frontier\tools\assets\optimize-*`
- `C:\Users\50106\Desktop\Harvest Frontier\tools\assets\validate-*`

Clunk Passport에는 현재 Harvest의 provenance sidecar를 first-class로 포함하는 필드가 없으므로, v1에서는 source/output hash와 함께 해당 manifest hash·경로를 내부 핸드오프에 연결합니다. 공개 SaaS나 신청서 첨부에 포함할 때는 별도 공개 범위 확인이 필요합니다.

## 반복 검증 절차

PowerShell에서 Harvest asset이 갱신될 때 다음 읽기 전용 러너를 다시 실행합니다. 기본 경로는 마스터의 현재 Harvest Frontier 체크아웃이며, `-OutputPath`를 주면 Clunk 쪽에 기계 판독 가능한 핸드오프 JSON을 남깁니다.

```powershell
& .\scripts\harvest-frontier-handoff.ps1 -OutputPath .\docs\integrations\harvest-frontier-run.json
```

이 러너는 Harvest 파일을 복사·변경하지 않고, Clunk `inspect --profile pc`만 호출합니다. 직접 명령으로 확인해야 할 때는 다음과 같습니다.

```powershell
$tsx = (Resolve-Path 'node_modules\tsx\dist\cli.mjs').Path
$root = 'C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime'
Get-ChildItem -LiteralPath $root -Filter '*.glb' -File | Sort-Object Name | ForEach-Object {
  & node.exe $tsx 'scripts\clunk-cli.ts' inspect $_.FullName --profile pc
}
```

그 결과의 bytes·SHA-256·metrics·finding·score를 Harvest 자체 validator 결과와 함께 기록합니다. hash가 바뀌면 기존 Passport와 신청 증거를 재사용하지 않고 새 실행으로 교체합니다.

## 다음 협업 단계

1. Harvest 작업에서 Clunk handoff manifest를 source factory와 함께 갱신합니다.
2. Clunk에 Harvest 전용 policy profile을 추가할 때 semantic node·pivot·socket·collider와 decode-aware bounds 계약을 먼저 고정합니다.
3. 전용 profile이 생기기 전까지는 범용 `pc` 점수를 Harvest 판매 승인으로 사용하지 않습니다.
4. near/far 각 결과에 Clunk 검사 결과와 Harvest provenance를 연결한 Passport를 생성합니다.
5. 실제 게임 브라우저·Windows 패키지 QA가 통과한 결과만 모두의 창업 신청 증거로 선택합니다.
