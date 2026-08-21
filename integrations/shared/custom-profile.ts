/*
 * Shared custom-profile loading for the Node surfaces (CLI, MCP).
 *
 * Every surface must resolve `--profile` / `--profile-file` the same way, so the mutual exclusion
 * rule and the validation error text stay identical across adapters.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCustomProfile,
  type AssetPolicy,
  type CustomProfile,
  type ProfileId,
} from "../../packages/core/src/index";

export const BUILT_IN_PROFILE_IDS: readonly ProfileId[] = ["web", "mobile", "pc"];

export async function loadCustomProfile(
  profilePath: string,
): Promise<{ profile: CustomProfile; absolutePath: string }> {
  const absolutePath = resolve(profilePath);
  const text = await readFile(absolutePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripByteOrderMark(text));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`Custom profile file is not valid JSON: ${absolutePath} (${reason})`);
  }
  try {
    return { profile: createCustomProfile(parsed), absolutePath };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid custom profile";
    throw new Error(`${reason} (${absolutePath})`);
  }
}

/**
 * Resolve the policy for one command invocation. `profile` selects a built-in profile and
 * `profileFile` loads a validated custom profile; supplying both is rejected.
 */
export async function resolveProfilePolicy(options: {
  profile?: string;
  profileFile?: string;
}): Promise<AssetPolicy> {
  if (options.profile !== undefined && options.profileFile !== undefined) {
    throw new Error("Use either --profile or --profile-file, not both.");
  }
  if (options.profileFile !== undefined) {
    const { profile } = await loadCustomProfile(options.profileFile);
    return { customProfile: profile };
  }
  return { profileId: builtInProfileId(options.profile) };
}

function builtInProfileId(value: string | undefined): ProfileId {
  return value === "mobile" || value === "pc" ? value : "web";
}

function stripByteOrderMark(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
