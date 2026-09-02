---
description: 입력 종류별로 검증 가능한 범위와 target profile 목록
---

# 지원 범위

자세한 모델 · 재질 · Spine · 애니메이션 범위는 입력 종류별로 분리되어 반환됩니다.

## 검사 가능한 입력

| 종류        | 범위                                            |
| --------- | --------------------------------------------- |
| 3D        | GLB / glTF 구조 · 정책 · Passport                 |
| 2D        | PNG · JPG · WebP dimensions · GPU memory      |
| Sprite    | atlas page · region · trim reference          |
| Spine     | JSON skeleton · slot · attachment · animation |
| Animation | glTF clip · duration · root-motion policy     |

## Target profile

| 프로파일                            | 엔진 · 플랫폼         | ID                           |
| ------------------------------- | ---------------- | ---------------------------- |
| 영허검가 PixiJS 2D                  | pixi-js · web    | `yeongheo-pixi-2d`           |
| Harvest Frontier Web / Three.js | web-three · web  | `harvest-frontier-web-three` |
| Godot 4                         | godot · desktop  | `godot-4`                    |
| Unity Editor                    | unity · desktop  | `unity`                      |
| Unreal Engine                   | unreal · desktop | `unreal`                     |
| Web / Three.js Mobile           | web-three · web  | `web-three-mobile`           |
| Android Game Target             | unity · android  | `android`                    |
| iOS Game Target                 | unity · ios      | `ios`                        |

지원 surface: 웹 검사기 · Asset Studio · CLI · MCP 서버 · VS Code 확장.

[에이전트용 요약 보기](https://clunk.games/llms.txt)
