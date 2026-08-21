/**
 * Recorded MCP session used by the landing playground.
 *
 * Every response line below was produced by driving the real stdio server
 * (`integrations/mcp/server.ts`) against `public/samples/clunk-messy-sample.glb` with
 * `profile: "pc"`. The raw JSON-RPC capture is kept at
 * `.clunk-evidence/mcp-playground-source.jsonl`; the strings here are that capture
 * pretty printed with long envelopes reduced to the fields shown. No value is invented,
 * and nothing here is recomputed at render time, so the playground replays a measurement
 * rather than simulating one.
 *
 * `initialize` replied protocolVersion 2025-06-18, serverInfo clunk v0.1.0.
 */

export type TranscriptLineKind = "sent" | "recv" | "json" | "note" | "ok";

export interface TranscriptLine {
  kind: TranscriptLineKind;
  text: string;
}

export interface PlaygroundTool {
  /** Real MCP tool id. Never re-cased: this is the string agents actually call. */
  id: "clunk_inspect" | "clunk_validate" | "clunk_optimize" | "clunk_passport";
  /** Korean action name shown as the primary label. */
  action: string;
  blurb: string;
  /** Headline value pulled straight from the recorded response. */
  headline: { label: string; value: string };
  lines: TranscriptLine[];
}

const HANDSHAKE: TranscriptLine[] = [
  { kind: "note", text: "# stdio · protocolVersion 2025-06-18 · serverInfo clunk v0.1.0" },
];

export const PLAYGROUND_TOOLS: PlaygroundTool[] = [
  {
    id: "clunk_inspect",
    action: "실제 바이트 검사",
    blurb: "파일을 파싱해 메트릭, finding, 해시를 그대로 돌려줍니다.",
    headline: { label: "Game-Ready Score", value: "99/100" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: '→ tools/call  "clunk_inspect"' },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "path": "public/samples/clunk-messy-sample.glb",' },
      { kind: "json", text: '  "profile": "pc"' },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "operation": "inspect",' },
      { kind: "json", text: '  "ruleSetId": "clunk-game-ready-v1",' },
      { kind: "json", text: '  "inputHash": "181473ff49e2a753b3c22198a0ef76f6…e8fdf1",' },
      { kind: "json", text: '  "resultDigest": "91811095b6afed62aa9b396834ab660c…8177b1",' },
      { kind: "json", text: '  "report": {' },
      { kind: "json", text: '    "byteLength": 1124,' },
      { kind: "json", text: '    "metrics": { "triangleCount": 2, "vertexCount": 4,' },
      { kind: "json", text: '                 "materialCount": 2, "emptyNodeCount": 1 },' },
      { kind: "json", text: '    "findings": [' },
      { kind: "json", text: '      { "ruleId": "FORMAT-GLTF2",        "severity": "INFO" },' },
      { kind: "json", text: '      { "ruleId": "GEO-MISSING-NORMALS", "severity": "WARNING" },' },
      { kind: "json", text: '      { "ruleId": "MAT-DUPLICATES",      "severity": "WARNING" },' },
      { kind: "json", text: '      { "ruleId": "SCENE-EMPTY-NODES",   "severity": "WARNING" }' },
      { kind: "json", text: "    ]," },
      { kind: "json", text: '    "score": { "score": 99, "threshold": 90, "hardBlockerCount": 0 }' },
      { kind: "json", text: "  }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# 필드 일부만 표시 · 해시는 앞뒤만 남기고 줄임" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
  {
    id: "clunk_validate",
    action: "정책 대조 판정",
    blurb: "선언된 프로파일과 대조해 통과 여부만 단호하게 답합니다.",
    headline: { label: "판정", value: "valid true" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: '→ tools/call  "clunk_validate"' },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "path": "public/samples/clunk-messy-sample.glb",' },
      { kind: "json", text: '  "profile": "pc"' },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "operation": "validate",' },
      { kind: "json", text: '  "valid": true,' },
      { kind: "json", text: '  "ruleSetId": "clunk-game-ready-v1",' },
      { kind: "json", text: '  "ruleSetVersion": "1.0.0",' },
      { kind: "json", text: '  "inputHash": "181473ff49e2a753b3c22198a0ef76f6…e8fdf1",' },
      { kind: "json", text: '  "report": {' },
      { kind: "json", text: '    "profileId": "pc",' },
      { kind: "json", text: '    "score": { "score": 99, "threshold": 90,' },
      { kind: "json", text: '               "hardBlockerCount": 0 },' },
      { kind: "json", text: '    "breakdown": { "format": 100, "scene": 97, "geometry": 97,' },
      { kind: "json", text: '                   "materials": 97, "textures": 100, "runtime": 100 }' },
      { kind: "json", text: "  }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# breakdown은 report.score.breakdown을 펼친 것" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
  {
    id: "clunk_optimize",
    action: "허용 작업만 정리",
    blurb: "허용 목록 작업만 적용하고 원본과 별개인 새 파일을 씁니다.",
    headline: { label: "1,124 B", value: "→ 908 B" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: '→ tools/call  "clunk_optimize"' },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "path": "public/samples/clunk-messy-sample.glb",' },
      { kind: "json", text: '  "outputPath": "out/clunk-messy-optimized.glb",' },
      { kind: "json", text: '  "profile": "pc"' },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "operation": "optimize",' },
      { kind: "json", text: '  "inputHash":  "181473ff49e2a753b3c22198a0ef76f6…e8fdf1",' },
      { kind: "json", text: '  "outputHash": "718f2fbaf4545bb96381c3055270212c…8302b",' },
      { kind: "json", text: '  "operations": [' },
      { kind: "json", text: '    { "id": "prune-empty-nodes", "count": 1, "safety": "lossless" },' },
      { kind: "json", text: '    { "id": "dedupe-materials",  "count": 1, "safety": "lossless" },' },
      { kind: "json", text: '    { "id": "clean-metadata",    "count": 1, "safety": "metadata-only" }' },
      { kind: "json", text: "  ]," },
      { kind: "json", text: '  "before": { "byteLength": 1124, "nodeCount": 2, "materialCount": 2,' },
      { kind: "json", text: '              "score": 99 },' },
      { kind: "json", text: '  "after":  { "byteLength": 908,  "nodeCount": 1, "materialCount": 1,' },
      { kind: "json", text: '              "score": 100 }' },
      { kind: "json", text: "}" },
      { kind: "note", text: "# before/after는 응답의 report 두 건에서 뽑은 값 · 원본은 그대로 남습니다" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
  {
    id: "clunk_passport",
    action: "결과 증명서 발급",
    blurb: "원본과 결과물을 각각 새로 검사해 Passport를 만듭니다.",
    headline: { label: "Passport", value: "발급됨" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: '→ tools/call  "clunk_passport"' },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "sourcePath": "public/samples/clunk-messy-sample.glb",' },
      { kind: "json", text: '  "outputPath": "out/clunk-messy-optimized.glb",' },
      { kind: "json", text: '  "profile": "pc"' },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: '  "operation": "passport",' },
      { kind: "json", text: '  "passport": {' },
      { kind: "json", text: '    "passportId": "passport-181473ff49e2-718f2fbaf454",' },
      { kind: "json", text: '    "coreVersion": "0.1.0",' },
      { kind: "json", text: '    "sourceHash": "181473ff49e2a753b3c22198a0ef76f6…e8fdf1",' },
      { kind: "json", text: '    "outputHash": "718f2fbaf4545bb96381c3055270212c…8302b",' },
      { kind: "json", text: '    "sourceInspectionDigest": "91811095b6afed62…8177b1",' },
      { kind: "json", text: '    "outputInspectionDigest": "e4c7a93a5f76cd22…501a12",' },
      { kind: "json", text: '    "before": { "score": 99 },' },
      { kind: "json", text: '    "after":  { "score": 100 }' },
      { kind: "json", text: "  }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# 두 digest는 원본과 결과물을 각각 다시 검사해 얻은 값입니다" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
];
