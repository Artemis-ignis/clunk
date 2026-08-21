import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("clunk.inspect", () => runCli("inspect")),
    vscode.commands.registerCommand("clunk.optimize", () => runCli("optimize")),
  );
}

async function runCli(command: "inspect" | "optimize") {
  const selected = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "glTF assets": ["glb", "gltf"] } });
  if (!selected?.[0]) return;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    void vscode.window.showErrorMessage("Open the Clunk workspace before running an asset command.");
    return;
  }
  try {
    const tsxEntrypoint = resolve(workspaceRoot, "node_modules", "tsx", "dist", "cli.mjs");
    const result = await run(process.execPath, [tsxEntrypoint, "scripts/clunk-cli.ts", command, selected[0].fsPath, "--profile", "web"], { cwd: workspaceRoot, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const parsed = JSON.parse(result.stdout) as { report?: { score?: { score?: number } }; outputPath?: string; after?: { score?: { score?: number } } };
    const score = parsed.report?.score?.score ?? parsed.after?.score?.score;
    void vscode.window.showInformationMessage(`Clunk ${command} complete${score === undefined ? "" : ` · score ${score}/100`}`, ...(parsed.outputPath ? ["Open output"] : []));
  } catch (error) {
    void vscode.window.showErrorMessage(error instanceof Error ? error.message : "Clunk command failed.");
  }
}

export function deactivate() {}
