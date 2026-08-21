#!/usr/bin/env node
import { existsSync, readdirSync, statSync, watch as fsWatch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import {
  READY_SCORE_THRESHOLD,
  createCustomProfile,
  createPassport,
  inspectAsset,
  optimizeAsset,
  validateAsset,
  type AssetPolicy,
  type ProfileId,
} from "../packages/core/src/index";
import {
  generateVerificationKeyPair,
  parseVerificationPublicKey,
  recomputeInspectionDigest,
  verifyVerificationPassport,
  type VerificationAlgorithm,
  type VerificationPassport,
  type VerificationPublicKey,
} from "../packages/core/src/verification";
import { sha256Hex } from "../packages/core/src/index";
import { inspectEnvelope, optimizeEnvelope, passportEnvelope, validateEnvelope } from "../packages/core/src/contract";
import { loadBundle, writeOutputBundle } from "../integrations/shared/node-asset";
import { resolveProfilePolicy } from "../integrations/shared/custom-profile";

const USAGE = [
  "Usage: npm run clunk -- <inspect|validate|optimize|passport|verify|verify-keygen|watch|profile-from> <path> [options]",
  "",
  "  inspect  <path>                     Inspect one GLB or local GLTF bundle.",
  "  validate <path>                     Inspect and exit with code 2 on an ERROR or CRITICAL finding.",
  "  optimize <path>                     Apply the allowlisted safe operations into a new artifact.",
  "  passport <source> <optimized>       Reinspect both files and print a Passport envelope.",
  "  verify   <passport.json>            Check a server-verified Passport's Ed25519/P-256 signature",
  "                                      against Clunk's published key. Exit code 2 on failure.",
  "  verify-keygen                       Generate a new issuing key pair for CLUNK_VERIFY_PRIVATE_KEY.",
  "  watch    <path...>                  Re-inspect files or directories on change and keep",
  "                                      a bytes/sha256/score manifest fresh. Ctrl+C to stop.",
  "  profile-from <asset...>             Derive a project profile from assets that already",
  "                                      work in your game: budgets = measured max + headroom.",
  "",
  "Options:",
  "  --profile web|mobile|pc             Built-in policy profile. Defaults to web.",
  "  --profile-file <profile.json>       Custom project profile. Cannot be combined with --profile.",
  "  --out, --output <path>              Optimize output path. Defaults next to the source file.",
  "  --manifest <path>                   Watch manifest output. Defaults to clunk-watch-manifest.json.",
  "  --ref <string>                      Free-form ref (commit, milestone) stamped into the watch manifest.",
  "  --headroom <factor>                 profile-from budget headroom over the measured max. Default 1.3.",
  "  --id <ruleSetId>                    profile-from rule set id. Default derived from --out filename.",
  "  --based-on web|mobile|pc            profile-from base profile for unset fields. Default pc.",
  "  --asset <file>                      verify: also check the file's sha256 against the Passport.",
  "  --key <file>                        verify: public key JSON saved from Clunk's well-known",
  "                                      endpoint. Offline verification uses this.",
  "  --key-url <url>                     verify: fetch the public key from this URL instead.",
  "  --algorithm ed25519|p256            verify-keygen: signature algorithm. Default ed25519.",
  "",
  "Custom profiles are documented in docs/custom-profiles.ko.md; there is an example in",
  "examples/profiles/harvest-frontier.example.json.",
].join("\n");

const [command, ...args] = process.argv.slice(2);

const FLAGS_WITH_VALUE = new Set([
  "--profile",
  "--profile-file",
  "--out",
  "--output",
  "--manifest",
  "--ref",
  "--headroom",
  "--id",
  "--based-on",
  "--asset",
  "--key",
  "--key-url",
  "--algorithm",
]);

function flag(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Non-flag tokens, skipping each flag's value — watch accepts many paths in any position. */
function positionals(): string[] {
  const rest: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (FLAGS_WITH_VALUE.has(token)) {
      index++;
      continue;
    }
    if (token.startsWith("--")) continue;
    rest.push(token);
  }
  return rest;
}

function policy(): Promise<AssetPolicy> {
  return resolveProfilePolicy({ profile: flag("--profile"), profileFile: flag("--profile-file") });
}

function output(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  if (
    !command ||
    !["inspect", "validate", "optimize", "passport", "verify", "verify-keygen", "watch", "profile-from"].includes(command)
  ) {
    throw new Error(USAGE);
  }
  if (command === "profile-from") {
    await runProfileFrom();
    return;
  }
  if (command === "verify") {
    await runVerify();
    return;
  }
  if (command === "verify-keygen") {
    await runVerifyKeygen();
    return;
  }
  const assetPolicy = await policy();
  if (command === "watch") {
    await runWatch(assetPolicy);
    return;
  }
  if (command === "passport") {
    const sourcePath = args[0];
    const outputPath = args[1];
    if (!sourcePath || !outputPath) throw new Error("Usage: passport <source> <optimized-output>");
    const [source, optimized] = await Promise.all([loadBundle(sourcePath), loadBundle(outputPath)]);
    const before = inspectAsset(source.bundle, assetPolicy);
    const after = inspectAsset(optimized.bundle, assetPolicy);
    const passport = createPassport(before, after, []);
    output(passportEnvelope(passport, after.resultDigest));
    return;
  }
  const inputPath = args[0];
  if (!inputPath) throw new Error(`Missing input path for ${command}.`);
  const { bundle, absolutePath } = await loadBundle(inputPath);
  if (command === "inspect") {
    const report = inspectAsset(bundle, assetPolicy);
    output(inspectEnvelope(report));
    return;
  }
  if (command === "validate") {
    const result = validateAsset(bundle, assetPolicy);
    output(validateEnvelope(result.valid, result.report));
    if (!result.valid) process.exitCode = 2;
    return;
  }
  const result = optimizeAsset(bundle, assetPolicy);
  const outputPath = resolve(flag("--out") ?? flag("--output") ?? joinOutput(absolutePath, result.outputFileName));
  const passportPath = `${outputPath}.passport.json`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeOutputBundle(result.outputBundle, outputPath, bundle.entry);
  await writeFile(passportPath, `${JSON.stringify(result.passport, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  output(optimizeEnvelope(result, outputPath, passportPath));
}

/**
 * verify: the receiving end of the product.
 *
 * A publisher or a client is handed `passport.json` and, usually, the asset. This command answers
 * two questions without asking the sender for anything: was this document signed by Clunk's key,
 * and does it describe the file I actually have. It is the only reason the signature is worth
 * anything, so it has to work offline — `--key` takes a public key file the recipient keeps
 * themselves, and nothing else is required.
 */
async function runVerify() {
  const passportPath = positionals()[0];
  if (!passportPath) {
    throw new Error("Usage: verify <passport.json> [--asset <파일>] [--key <공개키.json> | --key-url <url>]");
  }
  const absolutePassport = resolve(passportPath);
  let document: VerificationPassport;
  try {
    document = JSON.parse(await readFile(absolutePassport, "utf8")) as VerificationPassport;
  } catch (error) {
    throw new Error(
      `Passport 파일을 읽지 못했습니다: ${absolutePassport}\n  ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const lines: string[] = [];
  const checks: Array<{ state: "OK" | "FAIL" | "SKIP"; label: string; detail: string }> = [];

  const asset = document?.asset;
  lines.push("Clunk 서버 검증 Passport");
  lines.push(`  파일           ${asset?.fileName ?? "(알 수 없음)"} (${asset?.format ?? "?"}, ${Number(asset?.byteLength ?? 0).toLocaleString()} bytes)`);
  lines.push(`  sha256         ${asset?.sha256 ?? "(없음)"}`);
  lines.push(`  검사 시각      ${document?.inspectedAt ?? "(없음)"}`);
  lines.push(`  발급자         ${document?.issuer ?? "(없음)"}`);
  lines.push(`  규칙 세트      ${document?.ruleSetId ?? "?"} v${document?.ruleSetVersion ?? "?"} / ${document?.profileId ?? "?"}`);
  if (document?.score) {
    lines.push(
      `  점수           ${document.score.score}/100 (기준 ${document.score.threshold}) ${document.score.ready ? "READY" : "NOT-READY"}, 차단 finding ${document.score.hardBlockerCount}건`,
    );
  }
  lines.push("");

  const keySource = await resolvePublicKey(document);
  if (keySource.warning) lines.push(`  ! ${keySource.warning}`);

  const signature = await verifyVerificationPassport(document, keySource.key);
  checks.push(
    signature.ok
      ? { state: "OK", label: "서명", detail: `${signature.algorithm} / keyId ${signature.keyId} (${keySource.description})` }
      : { state: "FAIL", label: "서명", detail: signature.reason },
  );

  // Only meaningful once the signature parsed; an unsigned or foreign document has no digest
  // worth recomputing.
  if (signature.ok) {
    const recomputed = recomputeInspectionDigest(document);
    checks.push(
      recomputed === document.resultDigest
        ? { state: "OK", label: "내부 정합성", detail: "resultDigest가 문서에 적힌 검사 내용과 일치합니다" }
        : {
            state: "FAIL",
            label: "내부 정합성",
            detail: `resultDigest 불일치 (문서 ${document.resultDigest} / 재계산 ${recomputed})`,
          },
    );
  }

  const assetPath = flag("--asset");
  if (!assetPath) {
    checks.push({
      state: "SKIP",
      label: "파일 대조",
      detail: "--asset 을 주지 않아 실제 파일과 대조하지 않았습니다. 서명만 확인한 상태입니다",
    });
  } else {
    const absoluteAsset = resolve(assetPath);
    let actualHash: string;
    try {
      actualHash = sha256Hex(new Uint8Array(await readFile(absoluteAsset)));
    } catch (error) {
      throw new Error(
        `대조할 파일을 읽지 못했습니다: ${absoluteAsset}\n  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    checks.push(
      actualHash === asset?.sha256
        ? { state: "OK", label: "파일 대조", detail: `${basename(absoluteAsset)} 의 sha256이 Passport와 일치합니다` }
        : {
            state: "FAIL",
            label: "파일 대조",
            detail: `${basename(absoluteAsset)} 의 sha256은 ${actualHash} 이고 Passport는 ${asset?.sha256 ?? "(없음)"} 입니다. 이 Passport는 이 파일의 것이 아닙니다`,
          },
    );
  }

  lines.push("검증 결과");
  for (const check of checks) {
    // Korean labels are double-width, so column padding would misalign anyway; a separator
    // keeps the three lines readable in every terminal.
    lines.push(`  [${check.state.padEnd(4)}] ${check.label} — ${check.detail}`);
  }
  lines.push("");

  const failed = checks.some((check) => check.state === "FAIL");
  if (failed) {
    lines.push("결과: 실패 — 이 Passport는 신뢰할 수 없습니다.");
  } else {
    lines.push("결과: 통과 — Clunk 서버가 이 바이트를 직접 열어 검사하고 서명한 기록입니다.");
    lines.push("증명하지 않는 것:");
    for (const limitation of document.limitations ?? []) lines.push(`  - ${limitation}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  if (failed) process.exitCode = 2;
}

/**
 * Where the public key comes from, most trustworthy first.
 *
 * A key fetched from the origin the document itself names is trust-on-first-use: a forger who
 * controls that origin can serve a matching key. That path stays available because it is the only
 * one that works with no setup, but it announces itself so nobody mistakes it for a pinned check.
 */
async function resolvePublicKey(
  document: VerificationPassport,
): Promise<{ key: VerificationPublicKey; description: string; warning?: string }> {
  const keyFile = flag("--key") ?? process.env.CLUNK_VERIFY_PUBLIC_KEY_FILE;
  if (keyFile) {
    const absolute = resolve(keyFile);
    const parsed = parseVerificationPublicKey(JSON.parse(await readFile(absolute, "utf8")));
    return { key: parsed, description: `로컬 공개키 ${basename(absolute)}` };
  }
  const explicitUrl = flag("--key-url") ?? process.env.CLUNK_VERIFY_KEY_URL;
  const issuerUrl = document?.issuer ? `${document.issuer.replace(/\/$/, "")}/.well-known/clunk-verification-key` : null;
  const url = explicitUrl ?? issuerUrl;
  if (!url) {
    throw new Error(
      "공개키를 찾지 못했습니다. --key <파일> 로 저장해 둔 공개키를 주거나 --key-url <url> 을 지정해 주세요.",
    );
  }
  const response = await fetch(url).catch((error: unknown) => {
    throw new Error(`공개키를 받아오지 못했습니다: ${url}\n  ${error instanceof Error ? error.message : String(error)}`);
  });
  if (!response.ok) throw new Error(`공개키 응답이 ${response.status} 입니다: ${url}`);
  const key = parseVerificationPublicKey(await response.json());
  return {
    key,
    description: `원격 공개키 ${url}`,
    warning: explicitUrl
      ? undefined
      : "공개키를 Passport가 스스로 밝힌 발급자에서 받아왔습니다. 이 상태는 문서의 자기 일관성만 확인합니다. 신뢰 근거로 쓰려면 공개키를 한 번 받아 파일로 보관하고 --key 로 대조하세요.",
  };
}

/**
 * verify-keygen: produce an issuing key. Run once per deployment, by an operator, off the record.
 * The private half is printed for the operator to paste into their secret store and is never
 * written to disk by this command.
 */
async function runVerifyKeygen() {
  const requested = (flag("--algorithm") ?? "ed25519").toLowerCase();
  if (!["ed25519", "p256", "ecdsa"].includes(requested)) {
    throw new Error("--algorithm 은 ed25519 또는 p256 이어야 합니다.");
  }
  const algorithm: VerificationAlgorithm = requested === "ed25519" ? "Ed25519" : "ECDSA-P256-SHA256";
  const { pair, privateKeyEnvValue } = await generateVerificationKeyPair(algorithm);
  process.stdout.write(
    [
      `[verify-keygen] ${pair.algorithm} / keyId ${pair.keyId}`,
      "",
      "1) 서버 환경변수에 붙여넣으세요 (이 값은 비밀입니다. 저장소에 커밋하지 마세요):",
      `   CLUNK_VERIFY_PRIVATE_KEY=${privateKeyEnvValue}`,
      "",
      "2) 공개키는 서버가 /.well-known/clunk-verification-key 로 배포합니다. 참고용 값:",
      `   ${JSON.stringify(pair.publicKey)}`,
      "",
      "환경변수를 설정하지 않으면 서버 검증 기능은 켜지지 않습니다(fail-closed).",
      "",
    ].join("\n"),
  );
}

/**
 * profile-from: "여기 잘 돌아가는 에셋들 — 이걸 기준으로 판정해줘"를 그대로 제품화한다.
 * Reference assets that already work in the user's game are inspected, and the derived
 * budgets are their measured maxima plus headroom. The provenance of every number is
 * written into the profile so the verdicts stay explainable.
 */
async function runProfileFrom() {
  const files = positionals();
  if (!files.length) {
    throw new Error("Usage: profile-from <asset.glb...> [--based-on pc] [--headroom 1.3] [--id my-game] [--out my-game.profile.json]");
  }
  const basedOn = (flag("--based-on") ?? "pc") as ProfileId;
  if (!["web", "mobile", "pc"].includes(basedOn)) throw new Error("--based-on must be web|mobile|pc.");
  const headroom = Number(flag("--headroom") ?? 1.3);
  if (!Number.isFinite(headroom) || headroom < 1) throw new Error("--headroom must be a number >= 1.");
  const outPath = resolve(flag("--out") ?? flag("--output") ?? "clunk-derived.profile.json");
  const ruleSetId =
    flag("--id") ?? basename(outPath).replace(/\.profile\.json$|\.json$/i, "").replace(/[^a-zA-Z0-9-]/g, "-");

  const measured: Array<{
    file: string;
    sha256: string;
    triangles: number;
    materials: number;
    textureMemoryBytes: number;
    textureMaxDimension: number;
  }> = [];
  for (const file of files) {
    const { bundle } = await loadBundle(file);
    const report = inspectAsset(bundle, { profileId: basedOn });
    measured.push({
      file: basename(file),
      sha256: report.inputHash,
      triangles: report.metrics.triangleCount,
      materials: report.metrics.materialCount,
      textureMemoryBytes: report.metrics.textureMemoryBytes,
      textureMaxDimension: report.metrics.textureMaxDimension,
    });
    process.stdout.write(
      `[profile-from] ${basename(file)} → tri ${report.metrics.triangleCount.toLocaleString()} · mat ${report.metrics.materialCount} · texMem ${report.metrics.textureMemoryBytes.toLocaleString()}B · texDim ${report.metrics.textureMaxDimension}\n`,
    );
  }

  const max = (key: "triangles" | "materials" | "textureMemoryBytes" | "textureMaxDimension") =>
    Math.max(...measured.map((entry) => entry[key]));
  const roundUpTo = (value: number, step: number) => Math.ceil(value / step) * step;
  const nextPowerOfTwo = (value: number) => (value <= 0 ? 0 : 2 ** Math.ceil(Math.log2(value)));

  const maxTriangles = Math.max(roundUpTo(max("triangles") * headroom, 1000), 1000);
  const maxMaterials = Math.max(roundUpTo(max("materials") * headroom, 4), 4);
  // Zero stays zero on purpose: a texture-free reference corpus is a contract ("procedural
  // only"), and any texture that appears later should surface as a budget error.
  const maxTextureMemoryBytes =
    max("textureMemoryBytes") === 0 ? 0 : roundUpTo(max("textureMemoryBytes") * headroom, 8 * 1024 * 1024);
  const maxTextureDimension =
    max("textureMaxDimension") === 0 ? 0 : nextPowerOfTwo(Math.ceil(max("textureMaxDimension") * Math.min(headroom, 2)));

  const profile = {
    schemaVersion: "1.0",
    id: ruleSetId,
    version: "0.1.0",
    basedOn,
    label: `${ruleSetId} (derived from ${measured.length} reference asset${measured.length > 1 ? "s" : ""})`,
    description:
      "clunk profile-from이 '이미 게임에서 잘 동작하는' 레퍼런스 에셋 실측치로 유도한 프로파일입니다. 예산 = 코퍼스 최대치 × 헤드룸.",
    _derivedFrom: {
      generatedBy: "clunk profile-from",
      headroom,
      corpusMax: {
        triangles: max("triangles"),
        materials: max("materials"),
        textureMemoryBytes: max("textureMemoryBytes"),
        textureMaxDimension: max("textureMaxDimension"),
      },
      references: measured,
    },
    thresholds: {
      maxTriangles,
      maxMaterials,
      maxTextureMemoryBytes,
      maxTextureDimension,
      readyScoreThreshold: READY_SCORE_THRESHOLD,
    },
  };

  // Round-trip through the real loader so a file we write is guaranteed loadable.
  createCustomProfile(profile);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  process.stdout.write(
    `[profile-from] ${outPath}\n  maxTriangles ${maxTriangles.toLocaleString()} · maxMaterials ${maxMaterials} · texMem ${maxTextureMemoryBytes.toLocaleString()}B · texDim ${maxTextureDimension} (코퍼스 최대 × ${headroom})\n  이 파일은 CLI --profile-file, MCP profileFile, 웹 검사기 업로드에 그대로 쓸 수 있습니다.\n`,
  );
}

/**
 * Watch mode: the "notify → manual re-inspect → reply" loop between sessions, automated.
 * Every change rewrites one manifest (bytes, sha256, score, optional --ref), so a consumer
 * can treat Clunk as a resident pipeline stage instead of an event.
 */
async function runWatch(assetPolicy: AssetPolicy) {
  const targets = positionals();
  if (!targets.length) {
    throw new Error("Usage: watch <file-or-directory...> [--profile-file p.json] [--manifest out.json] [--ref v]");
  }
  const manifestPath = resolve(flag("--manifest") ?? "clunk-watch-manifest.json");
  const ref = flag("--ref") ?? null;

  const files = new Set<string>();
  const directories: string[] = [];
  for (const target of targets) {
    const absolute = resolve(target);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      directories.push(absolute);
      for (const name of readdirSync(absolute)) {
        if (/\.(glb|gltf)$/i.test(name)) files.add(resolve(absolute, name));
      }
    } else {
      files.add(absolute);
    }
  }

  const entries = new Map<string, unknown>();

  async function writeManifest() {
    const manifest = {
      generatedBy: "clunk-cli watch",
      ref,
      updatedAt: new Date().toISOString(),
      entries: [...entries.keys()].sort().map((key) => entries.get(key)),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  async function inspectOne(file: string) {
    try {
      const { bundle } = await loadBundle(file);
      const report = inspectAsset(bundle, assetPolicy);
      entries.set(file, {
        path: file,
        byteLength: report.byteLength,
        sha256: report.inputHash,
        score: report.score.score,
        ready: report.score.ready,
        ruleSetId: report.ruleSetId,
        profileId: report.profileId,
        findingCount: report.findings.length,
        inspectedAt: new Date().toISOString(),
      });
      process.stdout.write(
        `[watch] ${basename(file)} -> ${report.score.score}/100 ${report.score.ready ? "READY" : "NOT-READY"} (sha256 ${report.inputHash.slice(0, 8)}...)\n`,
      );
    } catch (error) {
      entries.set(file, {
        path: file,
        error: error instanceof Error ? error.message : String(error),
        inspectedAt: new Date().toISOString(),
      });
      process.stdout.write(`[watch] ${basename(file)} -> ERROR ${error instanceof Error ? error.message : String(error)}\n`);
    }
    await writeManifest();
  }

  for (const file of [...files].sort()) await inspectOne(file);
  process.stdout.write(
    `[watch] ${files.size} file(s) under watch -> manifest ${manifestPath}${ref ? ` (ref ${ref})` : ""}\n`,
  );

  const debounce = new Map<string, NodeJS.Timeout>();
  const schedule = (file: string) => {
    clearTimeout(debounce.get(file));
    debounce.set(file, setTimeout(() => void inspectOne(file), 250));
  };
  for (const directory of directories) {
    fsWatch(directory, (_event, name) => {
      if (!name || !/\.(glb|gltf)$/i.test(name)) return;
      const file = resolve(directory, name);
      if (existsSync(file)) {
        files.add(file);
        schedule(file);
      }
    });
  }
  for (const file of files) {
    if (directories.some((directory) => file.startsWith(directory))) continue;
    if (existsSync(file)) fsWatch(file, () => schedule(file));
  }
  await new Promise(() => undefined);
}

function joinOutput(sourcePath: string, outputName: string) {
  const sourceDirectory = dirname(sourcePath);
  const extension = extname(outputName) || ".glb";
  const stem = basename(sourcePath, extname(sourcePath));
  return resolve(sourceDirectory, `${stem}.clunk-optimized${extension}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Clunk CLI failed."}\n`);
  process.exitCode = 1;
});
