import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  normalizePlayerFacingQualityEvidence,
  type PlayerFacingVerifiedFile,
} from "../packages/core/src/index";

interface Options {
  input: string;
  root: string;
  requirePlayerFacing: boolean;
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const inputPath = resolve(options.input);
    if (!existsSync(inputPath) || !statSync(inputPath).isFile()) throw new Error(`Evidence file was not found: ${inputPath}`);
    const evidence = normalizePlayerFacingQualityEvidence(JSON.parse(readFileSync(inputPath, "utf8")));
    if (options.requirePlayerFacing && evidence.evidenceKind !== "PLAYER_FACING_CAPTURE") {
      throw new Error("--require-player-facing rejects CONTRACT_FIXTURE evidence.");
    }
    const mismatches = [evidence.reference, evidence.runtime, ...evidence.captures.map((capture) => capture.screenshot)]
      .flatMap((file) => verifyFile(file, options.root));
    const result = {
      ok: mismatches.length === 0,
      inputPath,
      runId: evidence.runId,
      assetId: evidence.assetId,
      evidenceKind: evidence.evidenceKind,
      status: evidence.status,
      productionReady: evidence.productionReady,
      checkedFileCount: 2 + evidence.captures.length,
      mismatchCount: mismatches.length,
      mismatches,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (mismatches.length > 0 || evidence.status === "NO_GO") process.exitCode = 1;
    else if (evidence.status !== "PASS") process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

function parseArgs(args: readonly string[]): Options {
  let input: string | null = null;
  let root = process.cwd();
  let requirePlayerFacing = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--require-player-facing") {
      requirePlayerFacing = true;
      continue;
    }
    if (arg === "--input" || arg === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      index += 1;
      if (arg === "--input") input = value;
      else root = resolve(value);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write("Usage: npm run quality:validate -- --input <evidence.json> [--root <project-root>] [--require-player-facing]\n");
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!input) throw new Error("--input is required.");
  return { input, root, requirePlayerFacing };
}

function verifyFile(file: PlayerFacingVerifiedFile, root: string): { path: string; reason: string }[] {
  const path = isAbsolute(file.path) ? resolve(file.path) : resolve(root, file.path);
  if (!existsSync(path) || !statSync(path).isFile()) return [{ path, reason: "verified evidence file is missing" }];
  const bytes = readFileSync(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const mismatches: { path: string; reason: string }[] = [];
  if (bytes.byteLength !== file.bytes) mismatches.push({ path, reason: `byte length changed: expected ${file.bytes}, got ${bytes.byteLength}` });
  if (hash !== file.sha256.toLowerCase()) mismatches.push({ path, reason: `SHA-256 changed: expected ${file.sha256}, got ${hash}` });
  return mismatches;
}

main();
