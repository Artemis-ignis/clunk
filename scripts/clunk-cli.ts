#!/usr/bin/env node
import { existsSync, readdirSync, statSync, watch as fsWatch } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import {
  createPassport,
  inspectAsset,
  optimizeAsset,
  validateAsset,
  type AssetPolicy,
} from "../packages/core/src/index";
import { inspectEnvelope, optimizeEnvelope, passportEnvelope, validateEnvelope } from "../packages/core/src/contract";
import { loadBundle, writeOutputBundle } from "../integrations/shared/node-asset";
import { resolveProfilePolicy } from "../integrations/shared/custom-profile";

const USAGE = [
  "Usage: npm run clunk -- <inspect|validate|optimize|passport> <path> [options]",
  "",
  "  inspect  <path>                     Inspect one GLB or local GLTF bundle.",
  "  validate <path>                     Inspect and exit with code 2 on an ERROR or CRITICAL finding.",
  "  optimize <path>                     Apply the allowlisted safe operations into a new artifact.",
  "  passport <source> <optimized>       Reinspect both files and print a Passport envelope.",
  "  watch    <path...>                  Re-inspect files or directories on change and keep",
  "                                      a bytes/sha256/score manifest fresh. Ctrl+C to stop.",
  "",
  "Options:",
  "  --profile web|mobile|pc             Built-in policy profile. Defaults to web.",
  "  --profile-file <profile.json>       Custom project profile. Cannot be combined with --profile.",
  "  --out, --output <path>              Optimize output path. Defaults next to the source file.",
  "  --manifest <path>                   Watch manifest output. Defaults to clunk-watch-manifest.json.",
  "  --ref <string>                      Free-form ref (commit, milestone) stamped into the watch manifest.",
  "",
  "Custom profiles are documented in docs/custom-profiles.ko.md; there is an example in",
  "examples/profiles/harvest-frontier.example.json.",
].join("\n");

const [command, ...args] = process.argv.slice(2);

const FLAGS_WITH_VALUE = new Set(["--profile", "--profile-file", "--out", "--output", "--manifest", "--ref"]);

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
  if (!command || !["inspect", "validate", "optimize", "passport", "watch"].includes(command)) {
    throw new Error(USAGE);
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
