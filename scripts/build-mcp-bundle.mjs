/**
 * Bundle the MCP server into one dependency-free ESM file.
 *
 * Connecting Clunk used to mean: clone the repository, run npm install (which pulls three,
 * react and the rest of the web app), then point the agent at a cwd. That is four steps and a
 * few hundred megabytes to expose six tools. The server itself only imports Node built-ins and
 * our own modules, so it bundles into a single file that runs anywhere Node runs.
 */
import { rolldown } from "rolldown";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const BUILTIN = /^node:/;

const build = await rolldown({
  input: "integrations/mcp/server.ts",
  platform: "node",
  external: (id) => BUILTIN.test(id),
});

const { output } = await build.generate({ format: "esm", inlineDynamicImports: true });
const code = output.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");

await mkdir("bin", { recursive: true });
const banner = "#!/usr/bin/env node\n";
await writeFile("bin/clunk-mcp.mjs", banner + code, "utf8");

// Also publish it as a static asset so the install instruction is a download, not a clone.
await mkdir("public", { recursive: true });
await writeFile("public/clunk-mcp.mjs", banner + code, "utf8");

const bytes = (await readFile("bin/clunk-mcp.mjs")).byteLength;
console.log(`bin/clunk-mcp.mjs  ${bytes.toLocaleString()} bytes (dependency-free)`);
