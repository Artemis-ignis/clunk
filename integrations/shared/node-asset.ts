import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { createAssetBundle, createBundleFromFiles, type AssetBundle } from "../../packages/core/src/index";

export async function loadBundle(entryPath: string): Promise<{ bundle: AssetBundle; absolutePath: string }> {
  const absolutePath = resolve(entryPath);
  const entryName = absolutePath.slice(absolutePath.lastIndexOf(sep) + 1);
  if (!entryName.toLowerCase().endsWith(".gltf")) {
    return { absolutePath, bundle: createAssetBundle(entryName, new Uint8Array(await readFile(absolutePath))) };
  }
  const base = dirname(absolutePath);
  const paths = await collectFiles(base);
  const files: Array<readonly [string, Uint8Array]> = [];
  for (const path of paths) {
    files.push([relative(base, path).split(sep).join("/"), new Uint8Array(await readFile(path))]);
  }
  return { absolutePath, bundle: createBundleFromFiles(entryName, files) };
}

export async function writeOutputBundle(bundle: AssetBundle, outputPath: string, inputEntry?: string): Promise<void> {
  const outputAbsolute = resolve(outputPath);
  const outputRoot = dirname(outputAbsolute);
  const rootPrefix = `${outputRoot}${sep}`;
  for (const [entry, bytes] of bundle.files) {
    if (inputEntry && entry === inputEntry) continue;
    if (entry.toLowerCase().endsWith(".gltf") && entry !== bundle.entry) continue;
    const target = entry === bundle.entry ? outputAbsolute : resolve(outputRoot, entry);
    if (target !== outputRoot && !target.startsWith(rootPrefix)) throw new Error(`Output bundle entry escapes destination: ${entry}`);
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const existing = await readFile(target);
      if (!Buffer.from(existing).equals(Buffer.from(bytes))) throw new Error(`Refusing to overwrite a different existing output resource: ${target}`);
    }
  }
}

function isAlreadyExists(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EEXIST";
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await collectFiles(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}
