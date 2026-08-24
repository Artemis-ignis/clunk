import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createUnavailableEnvironment,
  type EngineEnvironment,
  type EngineFamily,
} from "./engine-environment";

const execFileAsync = promisify(execFile);

export interface EngineDiscoveryOptions {
  skipVersionProbe?: boolean;
  pathLookup?: (command: string) => Promise<string | undefined>;
}

type Candidate = {
  family: EngineFamily;
  commands: readonly string[];
  versionArgs?: readonly string[];
  capabilities: readonly string[];
};

const CANDIDATES: readonly Candidate[] = [
  { family: "web-three", commands: [], capabilities: ["browser-import", "webgl-runtime"] },
  { family: "godot", commands: ["godot4.exe", "godot.exe", "godot"], versionArgs: ["--version"], capabilities: ["project-import", "headless-scene"] },
  { family: "unity", commands: ["Unity.exe", "Unity"], versionArgs: ["-version"], capabilities: ["asset-database-import", "editor-smoke"] },
  { family: "unreal", commands: ["UnrealEditor.exe", "UnrealEditor-Cmd.exe"], versionArgs: ["-version"], capabilities: ["asset-registry-import", "commandlet-smoke"] },
  { family: "android", commands: ["adb.exe", "adb"], versionArgs: ["version"], capabilities: ["device-or-emulator"] },
  { family: "ios", commands: ["xcrun.exe", "xcrun"], versionArgs: ["--version"], capabilities: ["simulator-or-device"] },
];

export async function discoverEngineEnvironments(options: EngineDiscoveryOptions = {}): Promise<EngineEnvironment[]> {
  const pathLookup = options.pathLookup ?? lookupPath;
  const environments: EngineEnvironment[] = [];
  for (const candidate of CANDIDATES) {
    if (candidate.family === "web-three") {
      environments.push(createUnavailableEnvironment(candidate.family, "A browser/WebGL harness must be invoked for this target; discovery alone is not a runtime PASS."));
      continue;
    }
    let executable: string | undefined;
    for (const command of candidate.commands) {
      executable = await pathLookup(command);
      if (executable) break;
    }
    if (!executable) {
      environments.push(createUnavailableEnvironment(candidate.family, `${candidate.family} executable was not found on PATH.`));
      continue;
    }
    let version: string | undefined;
    if (!options.skipVersionProbe && candidate.versionArgs) version = await probeVersion(executable, candidate.versionArgs);
    environments.push({
      family: candidate.family,
      available: true,
      executable,
      ...(version ? { version } : {}),
      plugins: [],
      capabilities: candidate.capabilities,
      ...(!version ? { reason: `${candidate.family} executable was found, but its version probe returned no output.` } : {}),
    });
  }
  return environments;
}

async function lookupPath(command: string): Promise<string | undefined> {
  try {
    const result = await execFileAsync("where.exe", [command], { windowsHide: true, timeout: 2_000, maxBuffer: 32_000 });
    const first = String(result.stdout).split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return first;
  } catch {
    return undefined;
  }
}

async function probeVersion(executable: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const result = await execFileAsync(executable, [...args], { windowsHide: true, timeout: 3_000, maxBuffer: 64_000 });
    const output = `${String(result.stdout)}\n${String(result.stderr)}`.trim();
    return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 240);
  } catch {
    return undefined;
  }
}
