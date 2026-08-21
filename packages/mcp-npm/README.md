# clunk-mcp

Clunk의 MCP 서버입니다. GLB/GLTF 게임 에셋을 실제 바이트 기준으로 검사하고, 허용 목록만 적용해
안전하게 정리하고, 원본과 결과물의 해시를 묶은 Passport를 발급합니다.

## 연결

```bash
claude mcp add clunk -- npx -y clunk-mcp
```

설정 파일을 쓰는 도구라면:

```json
{
  "mcpServers": {
    "clunk": { "command": "npx", "args": ["-y", "clunk-mcp"] }
  }
}
```

## 도구

| 도구 | 하는 일 |
| --- | --- |
| `clunk_inspect` | 파일을 열어 구조·예산·Game-Ready Score를 계산합니다 |
| `clunk_validate` | 정책을 만족하지 않으면 실패로 판정합니다 |
| `clunk_optimize` | 빈 노드 제거·머티리얼 병합·메타데이터 정리를 새 파일에 적용합니다 |
| `clunk_passport` | 원본과 결과물을 각각 다시 검사해 하나의 증명으로 묶습니다 |
| `clunk_engine_profiles` | Godot·Unity·Unreal 프리셋을 알려줍니다 |
| `clunk_profile_from` | 이미 게임에서 잘 도는 에셋에서 프로젝트 예산을 도출합니다 |

## 경계

- 로컬 stdio 도구입니다. **원격에 노출하지 마십시오** — 호출자가 준 절대 경로를 그대로 읽고 씁니다.
- 원본 파일을 덮어쓰지 않습니다. 최적화는 항상 새 파일에 씁니다.
- 손실이 있는 변환(메시 단순화, 텍스처 재인코딩, Draco/Meshopt)은 적용하지 않습니다.

의존성은 없습니다. Node 내장 모듈만 사용합니다.
