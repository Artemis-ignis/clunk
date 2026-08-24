import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = "clunk.ui-readability.v1";
const TOOL_VERSION = "clunk-ui-readability/1.0.0";
const EXIT = { pass: 0, policy: 2, input: 3, unavailable: 4 };

class InputError extends Error {
  code = EXIT.input;
}

function parseArgs(argv) {
  const args = { config: null, input: null, format: "human", out: null, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--config") args.config = argv[++index] ?? null;
    else if (token === "--input") args.input = argv[++index] ?? null;
    else if (token === "--format") args.format = argv[++index] ?? null;
    else if (token === "--out") args.out = argv[++index] ?? null;
    else if (token === "--strict") args.strict = true;
    else if (!token.startsWith("--") && !args.config && !args.input) args.config = token;
    else throw new InputError(`Unknown UI readability option: ${token}`);
  }
  if (!["human", "json"].includes(args.format)) throw new InputError("--format must be human or json.");
  if (args.out === "") throw new InputError("--out requires a file path.");
  return args;
}

function unavailableEnvelope(args) {
  return {
    schema: SCHEMA,
    toolVersion: TOOL_VERSION,
    status: "UNAVAILABLE",
    capability: "not-shipped",
    requestedConfig: args.config,
    requestedInput: args.input,
    strict: args.strict,
    violations: [],
    findings: [],
    engineReadiness: "not-evaluated",
    error: "A stable UI readability auditor is not provided by Clunk yet. This result must not be treated as a UI or player-facing PASS.",
    generatedBy: TOOL_VERSION,
  };
}

function writeOutput(path, value) {
  if (path) writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const envelope = {
      schema: SCHEMA,
      toolVersion: TOOL_VERSION,
      status: "ERROR",
      capability: "not-shipped",
      errorCode: error?.code ?? EXIT.input,
      error: error instanceof Error ? error.message : String(error),
      violations: [],
      findings: [],
      generatedBy: TOOL_VERSION,
    };
    if (args?.format === "json" || process.argv.includes("--format") && process.argv.includes("json")) {
      process.stdout.write(`${JSON.stringify(envelope)}\n`);
    } else {
      process.stderr.write(`${envelope.error}\n`);
    }
    process.exitCode = envelope.errorCode;
    return;
  }

  const envelope = unavailableEnvelope(args);
  writeOutput(args.out, envelope);
  if (args.format === "json") process.stdout.write(`${JSON.stringify(envelope)}\n`);
  else process.stdout.write(`UI readability auditor: NOT PROVIDED (exit ${EXIT.unavailable})\n${envelope.error}\n`);
  process.exitCode = EXIT.unavailable;
}

main();
