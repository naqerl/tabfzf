import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = resolve(root, "dist");
const firefoxDir = resolve(distDir, "firefox");
const chromiumDir = resolve(distDir, "chromium");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(firefoxDir, { recursive: true });
mkdirSync(chromiumDir, { recursive: true });

cpSync(resolve(root, "manifest.json"), resolve(firefoxDir, "manifest.json"));
cpSync(resolve(root, "manifest.chromium.json"), resolve(chromiumDir, "manifest.json"));
cpSync(resolve(root, "popup"), resolve(firefoxDir, "popup"), { recursive: true });
cpSync(resolve(root, "popup"), resolve(chromiumDir, "popup"), { recursive: true });
cpSync(resolve(root, "icons"), resolve(firefoxDir, "icons"), { recursive: true });
cpSync(resolve(root, "icons"), resolve(chromiumDir, "icons"), { recursive: true });

execSync("zip -rq tabfzf-firefox.xpi manifest.json popup icons", { cwd: firefoxDir });
execSync("zip -rq tabfzf-chromium.zip manifest.json popup icons", { cwd: chromiumDir });

console.log("Build complete: dist/");
console.log("Package ready: dist/firefox/tabfzf-firefox.xpi");
console.log("Package ready: dist/chromium/tabfzf-chromium.zip");
