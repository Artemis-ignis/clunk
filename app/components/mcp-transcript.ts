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
 *
 * 다시 뽑으려면 `node scripts/capture-mcp-transcript.mjs`. 손으로 옮겨 적지 않는다 —
 * 샘플이나 규칙이 바뀌면 조용히 거짓이 되고, 실제로 한 번 그렇게 됐다.
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
  /** The situation this tool exists for — shown on the card so a first-time reader knows
   *  when they would reach for it, before any protocol talk. */
  useCase: string;
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
    useCase: "“방금 만든 GLB, 게임에 넣어도 돼?” — 생성 직후 에이전트가 스스로 답을 받습니다.",
    headline: { label: "Game-Ready Score", value: "95/100" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: "→ tools/call  \"clunk_inspect\"" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"path\": \"public/samples/clunk-messy-sample.glb\"," },
      { kind: "json", text: "  \"profile\": \"pc\"" },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"operation\": \"inspect\"," },
      { kind: "json", text: "  \"ruleSetId\": \"clunk-game-ready-v1\"," },
      { kind: "json", text: "  \"inputHash\": \"03d293079c89faef2d1805ea36b58fe6…b7e1a6\"," },
      { kind: "json", text: "  \"resultDigest\": \"282cda736c27844f513fac1536107587…c41243\"," },
      { kind: "json", text: "  \"report\": {" },
      { kind: "json", text: "    \"byteLength\": 1175840," },
      { kind: "json", text: "    \"metrics\": { \"triangleCount\": 34928, \"vertexCount\": 23100," },
      { kind: "json", text: "                 \"materialCount\": 11, \"emptyNodeCount\": 12," },
      { kind: "json", text: "                 \"prunableEmptyNodeCount\": 8, \"textureMaxDimension\": 4096 }," },
      { kind: "json", text: "    \"findings\": [" },
      { kind: "json", text: "      { \"ruleId\": \"FORMAT-GLTF2\",        \"severity\": \"INFO\" }," },
      { kind: "json", text: "      { \"ruleId\": \"GEO-MERGEABLE-PRIMITIVES\", \"severity\": \"WARNING\" }," },
      { kind: "json", text: "      { \"ruleId\": \"GEO-MISSING-NORMALS\", \"severity\": \"WARNING\" }," },
      { kind: "json", text: "      { \"ruleId\": \"MAT-DUPLICATES\",      \"severity\": \"WARNING\" }," },
      { kind: "json", text: "      { \"ruleId\": \"SCENE-EMPTY-NODES\",   \"severity\": \"WARNING\" }," },
      { kind: "json", text: "      { \"ruleId\": \"SCENE-ZERO-SCALE\",    \"severity\": \"ERROR\" }," },
      { kind: "json", text: "      { \"ruleId\": \"TEX-MISSING-UV0\",     \"severity\": \"WARNING\" }" },
      { kind: "json", text: "    ]," },
      { kind: "json", text: "    \"score\": { \"score\": 95, \"threshold\": 90, \"hardBlockerCount\": 1," },
      { kind: "json", text: "               \"ready\": false }" },
      { kind: "json", text: "  }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# 점수는 95인데 ready는 false · 스케일 축이 0인 노드 하나가 hard blocker입니다" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
  {
    id: "clunk_validate",
    action: "정책 대조 판정",
    blurb: "선언된 프로파일과 대조해 통과 여부만 단호하게 답합니다.",
    useCase: "CI·빌드 파이프라인의 자동 차단 게이트 — 기준 미달이면 통과 못 합니다.",
    headline: { label: "판정", value: "valid false" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: "→ tools/call  \"clunk_validate\"" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"path\": \"public/samples/clunk-messy-sample.glb\"," },
      { kind: "json", text: "  \"profile\": \"pc\"" },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"operation\": \"validate\"," },
      { kind: "json", text: "  \"valid\": false," },
      { kind: "json", text: "  \"ruleSetId\": \"clunk-game-ready-v1\"," },
      { kind: "json", text: "  \"ruleSetVersion\": \"1.1.0\"," },
      { kind: "json", text: "  \"inputHash\": \"03d293079c89faef2d1805ea36b58fe6…b7e1a6\"," },
      { kind: "json", text: "  \"report\": {" },
      { kind: "json", text: "    \"profileId\": \"pc\"," },
      { kind: "json", text: "    \"score\": { \"score\": 95, \"threshold\": 90," },
      { kind: "json", text: "               \"hardBlockerCount\": 1 }," },
      { kind: "json", text: "    \"breakdown\": { \"format\": 100, \"scene\": 79, \"geometry\": 94," },
      { kind: "json", text: "                   \"materials\": 97, \"textures\": 97, \"runtime\": 100 }" },
      { kind: "json", text: "  }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# 90점 기준을 넘겼는데도 false입니다 · 점수는 참고고, 판정은 hard blocker가 냅니다" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
  {
    id: "clunk_optimize",
    action: "허용 작업만 정리",
    blurb: "허용 목록 작업만 적용하고 원본과 별개인 새 파일을 씁니다.",
    useCase: "경고 정리를 에이전트에게 맡길 때 — 원본 파일은 절대 건드리지 않습니다.",
    headline: { label: "노드 23 · 머티리얼 11", value: "→ 15 · 7" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: "→ tools/call  \"clunk_optimize\"" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"path\": \"public/samples/clunk-messy-sample.glb\"," },
      { kind: "json", text: "  \"outputPath\": \"out/clunk-messy-optimized.glb\"," },
      { kind: "json", text: "  \"profile\": \"pc\"" },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"operation\": \"optimize\"," },
      { kind: "json", text: "  \"inputHash\":  \"03d293079c89faef2d1805ea36b58fe6…b7e1a6\"," },
      { kind: "json", text: "  \"outputHash\": \"4368b41991a64f010713da589b1cb329…70f275\"," },
      { kind: "json", text: "  \"operations\": [" },
      { kind: "json", text: "    { \"id\": \"prune-empty-nodes\", \"count\": 8,  \"safety\": \"lossless\" }," },
      { kind: "json", text: "    { \"id\": \"dedupe-materials\",  \"count\": 4,  \"safety\": \"lossless\" }," },
      { kind: "json", text: "    { \"id\": \"clean-metadata\",    \"count\": 24, \"safety\": \"metadata-only\" }" },
      { kind: "json", text: "  ]," },
      { kind: "json", text: "  \"before\": { \"nodeCount\": 23, \"materialCount\": 11, \"score\": 95 }," },
      { kind: "json", text: "  \"after\":  { \"nodeCount\": 15, \"materialCount\": 7,  \"score\": 95 }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# 빈 노드 8개·중복 머티리얼 4개를 지워도 점수는 그대로입니다 · 남은 경고는 무손실로 못 고칩니다" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
  {
    id: "clunk_passport",
    action: "결과 증명서 발급",
    blurb: "원본과 결과물을 각각 새로 검사해 Passport를 만듭니다.",
    useCase: "팀·발주처에 “검사받은 에셋”임을 해시로 증명해야 할 때.",
    headline: { label: "Passport", value: "발급됨" },
    lines: [
      ...HANDSHAKE,
      { kind: "sent", text: "→ tools/call  \"clunk_passport\"" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"sourcePath\": \"public/samples/clunk-messy-sample.glb\"," },
      { kind: "json", text: "  \"outputPath\": \"out/clunk-messy-optimized.glb\"," },
      { kind: "json", text: "  \"profile\": \"pc\"" },
      { kind: "json", text: "}" },
      { kind: "recv", text: "← result" },
      { kind: "json", text: "{" },
      { kind: "json", text: "  \"operation\": \"passport\"," },
      { kind: "json", text: "  \"passport\": {" },
      { kind: "json", text: "    \"passportId\": \"passport-03d293079c89-4368b41991a6\"," },
      { kind: "json", text: "    \"coreVersion\": \"0.2.0\"," },
      { kind: "json", text: "    \"sourceHash\": \"03d293079c89faef2d1805ea36b58fe6…b7e1a6\"," },
      { kind: "json", text: "    \"outputHash\": \"4368b41991a64f010713da589b1cb329…70f275\"," },
      { kind: "json", text: "    \"sourceInspectionDigest\": \"282cda736c27844f…c41243\"," },
      { kind: "json", text: "    \"outputInspectionDigest\": \"5a91f6582581e01f…5256cc\"," },
      { kind: "json", text: "    \"before\": { \"score\": 95 }," },
      { kind: "json", text: "    \"after\":  { \"score\": 95 }" },
      { kind: "json", text: "  }" },
      { kind: "json", text: "}" },
      { kind: "note", text: "# 두 digest는 원본과 결과물을 각각 다시 검사해 얻은 값입니다" },
      { kind: "ok", text: "재생 완료 · 실측 응답" },
    ],
  },
];
