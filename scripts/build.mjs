import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = resolve(root, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

cpSync(resolve(root, "manifest.json"), resolve(distDir, "manifest.json"));
cpSync(resolve(root, "popup"), resolve(distDir, "popup"), { recursive: true });
cpSync(resolve(root, "icons"), resolve(distDir, "icons"), { recursive: true });

execSync("zip -rq tabfzf.xpi manifest.json popup icons", { cwd: distDir });

console.log("Build complete: dist/");
console.log("Package ready: dist/tabfzf.xpi");
