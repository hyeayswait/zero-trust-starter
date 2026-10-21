// scripts/build-policy-test.mjs —— 把 TS 策略模块编译成可被 Node 直接测试的 .mjs
//
// policy.ts 是 TypeScript，Node 无法直接 import。
// 这里用 tsc 编译到 out_test/，再重命名为 .mjs 并修正内部 import。
import { execFileSync } from "node:child_process";
import { existsSync, renameSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out_test");

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });

execFileSync(process.execPath, [
  join(ROOT, "node_modules", "typescript", "bin", "tsc"),
  "-p", join(ROOT, "tsconfig.policytest.json"),
], { cwd: ROOT, stdio: "inherit" });

for (const base of ["policy", "types"]) {
  const js = join(OUT, base + ".js");
  if (existsSync(js)) renameSync(js, join(OUT, base + ".mjs"));
}

const policyPath = join(OUT, "policy.mjs");
if (existsSync(policyPath)) {
  const src = readFileSync(policyPath, "utf8").replace(/from "\.\/types"/g, 'from "./types.mjs"');
  writeFileSync(policyPath, src, "utf8");
}
console.log("built out_test/*.mjs");
