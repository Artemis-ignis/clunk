#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  normalizeConsumerValidationReport,
  type ConsumerFileRef,
  type ConsumerValidationReport,
} from "../packages/core/src/index";

interface Options {
  input: string;
  strict: boolean;
}

interface Mismatch {
  path: string;
  reason: string;
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = readReport(options.input);
    const normalized = normalizeConsumerValidationReport(report);
    const mismatches = verifyReportBytes(normalized);
    if (JSON.stringify(report.summary) !== JSON.stringify(normalized.summary)) {
      mismatches.push({ path: options.input, reason: "summary does not match the normalized project evidence" });
    }
    const result = {
      ok: mismatches.length === 0,
      inputPath: resolve(options.input),
      runId: normalized.runId,
      status: normalized.summary.readiness,
      checkedAssetCount: normalized.summary.assetCount,
      checkedFileCount: countCheckedFiles(normalized),
      mismatchCount: mismatches.length,
      mismatches,
      humanReviewPendingCount: normalized.summary.humanReviewPendingCount,
      productionReady: normalized.summary.productionReady,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (mismatches.length > 0) process.exitCode = 1;
    else if (options.strict && normalized.summary.readiness !== "VALIDATED") process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

function parseArgs(args: readonly string[]): Options {
  let input: string | null = null;
  let strict = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    if (arg === "--input") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--input requires a report path.");
      input = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write("Usage: npm run consumer:validate -- --input <Clunk report.json> [--strict]\n");
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!input) throw new Error("--input is required.");
  return { input, strict };
}

function readReport(path: string): ConsumerValidationReport {
  const absolute = resolve(path);
  if (!existsSync(absolute)) throw new Error(`Consumer validation report was not found: ${absolute}`);
  return JSON.parse(readFileSync(absolute, "utf8")) as ConsumerValidationReport;
}

function verifyReportBytes(report: ConsumerValidationReport): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const refs: ConsumerFileRef[] = [];
  for (const project of report.projects) {
    addPathCheck(mismatches, project.runtime.evidencePath);
    refs.push(...(project.runtime.evidenceFiles ?? []));
    for (const asset of project.assets) {
      refs.push(asset.source, asset.runtime);
      if (asset.derived) refs.push(asset.derived);
      if (asset.playerFacingQuality) {
        refs.push(toConsumerFileRef(asset.playerFacingQuality.reference), toConsumerFileRef(asset.playerFacingQuality.runtime));
        refs.push(...asset.playerFacingQuality.captures.map((capture) => toConsumerFileRef(capture.screenshot)));
      }
      addPathCheck(mismatches, asset.clunk.evidencePath);
      addPathCheck(mismatches, asset.runtimeAttachment.evidencePath);
      for (const path of asset.provenance.refs) addPathCheck(mismatches, path);
    }
  }
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref.path)) continue;
    seen.add(ref.path);
    verifyFileRef(ref, mismatches);
  }
  return mismatches;
}

function verifyFileRef(ref: ConsumerFileRef, mismatches: Mismatch[]): void {
  const path = resolve(ref.path);
  if (!existsSync(path) || !statSync(path).isFile()) {
    mismatches.push({ path, reason: "recorded evidence file is missing" });
    return;
  }
  const bytes = readFileSync(path);
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== ref.bytes) mismatches.push({ path, reason: `byte length changed: expected ${ref.bytes}, got ${bytes.byteLength}` });
  if (actualHash !== ref.sha256.toLowerCase()) mismatches.push({ path, reason: `SHA-256 changed: expected ${ref.sha256}, got ${actualHash}` });
  if (!ref.hashVerified) mismatches.push({ path, reason: "file was recorded without a verified hash" });
}

function toConsumerFileRef(file: { path: string; bytes: number; sha256: string }): ConsumerFileRef {
  return { path: file.path, bytes: file.bytes, sha256: file.sha256, hashVerified: true };
}

function addPathCheck(mismatches: Mismatch[], value: string | undefined): void {
  if (!value) return;
  const path = resolve(value);
  if (!existsSync(path)) mismatches.push({ path, reason: "recorded evidence path is missing" });
}

function countCheckedFiles(report: ConsumerValidationReport): number {
  const paths = new Set<string>();
  for (const project of report.projects) {
    for (const file of project.runtime.evidenceFiles ?? []) paths.add(file.path);
    for (const asset of project.assets) {
      paths.add(asset.source.path);
      paths.add(asset.runtime.path);
      if (asset.derived) paths.add(asset.derived.path);
      if (asset.playerFacingQuality) {
        paths.add(asset.playerFacingQuality.reference.path);
        paths.add(asset.playerFacingQuality.runtime.path);
        for (const capture of asset.playerFacingQuality.captures) paths.add(capture.screenshot.path);
      }
    }
  }
  return paths.size;
}

main();
