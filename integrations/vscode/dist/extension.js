"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const run = (0, node_util_1.promisify)(node_child_process_1.execFile);
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand("clunk.inspect", () => runCli("inspect")), vscode.commands.registerCommand("clunk.optimize", () => runCli("optimize")));
}
async function runCli(command) {
    const selected = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "glTF assets": ["glb", "gltf"] } });
    if (!selected?.[0])
        return;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        void vscode.window.showErrorMessage("Open the Clunk workspace before running an asset command.");
        return;
    }
    try {
        const tsxEntrypoint = (0, node_path_1.resolve)(workspaceRoot, "node_modules", "tsx", "dist", "cli.mjs");
        const result = await run(process.execPath, [tsxEntrypoint, "scripts/clunk-cli.ts", command, selected[0].fsPath, "--profile", "web"], { cwd: workspaceRoot, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
        const parsed = JSON.parse(result.stdout);
        const score = parsed.report?.score?.score ?? parsed.after?.score?.score;
        void vscode.window.showInformationMessage(`Clunk ${command} complete${score === undefined ? "" : ` · score ${score}/100`}`, ...(parsed.outputPath ? ["Open output"] : []));
    }
    catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : "Clunk command failed.");
    }
}
function deactivate() { }
