// tests/policy.test.mjs —— 资源级授权策略测试
//
//   node tests/policy.test.mjs
//
// 直接导入 src/lib/auth/policy.ts 的编译产物（out_test/policy.js），
// 确保测的是真实实现，而不是复制的副本。
// 若产物不存在，会提示先运行 npm run build:policy-test。

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILT = join(ROOT, "out_test", "policy.mjs");

if (!existsSync(BUILT)) {
  console.error("缺少编译产物 out_test/policy.js");
  console.error("先运行: npm run build:policy-test");
  process.exit(1);
}

const { pathToFileURL } = await import("node:url");
const { evaluate, DEFAULT_POLICIES } = await import(pathToFileURL(BUILT).href);

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  [OK] " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  [FAIL] " + name + (detail ? "  " + detail : "")); }
};

console.log("策略数:", DEFAULT_POLICIES.length);

console.log("\n=== 1. 管理员 ===");
const admin = { sub: "u-admin", roles: ["admin"], tenant: "t1" };
ok("admin 读任意文档", evaluate(admin, "read", { type: "document", owner: "someone-else" }).allowed);
ok("admin 写任意文档", evaluate(admin, "write", { type: "document", owner: "someone-else" }).allowed);
ok("admin 删他人文档", evaluate(admin, "delete", { type: "document", owner: "x" }).allowed);
ok("admin 读审计", evaluate(admin, "read", { type: "audit" }).allowed);

console.log("\n=== 2. member - 自己的文档 ===");
const m = { sub: "u-m", roles: ["member"], tenant: "t1" };
const ownDoc = { type: "document", id: "d1", owner: "u-m" };
ok("读自己的", evaluate(m, "read", ownDoc).allowed);
ok("写自己的", evaluate(m, "write", ownDoc).allowed);
ok("删自己的", evaluate(m, "delete", ownDoc).allowed);

console.log("\n=== 3. member - 他人文档 ===");
const otherDoc = { type: "document", id: "d2", owner: "u-other" };
ok("不能读他人私有", !evaluate(m, "read", otherDoc).allowed);
ok("不能写他人", !evaluate(m, "write", otherDoc).allowed);
ok("不能删他人", !evaluate(m, "delete", otherDoc).allowed,
   evaluate(m, "delete", otherDoc).reason);

console.log("\n=== 4. public 文档 ===");
const pubDoc = { type: "document", id: "d3", owner: "u-other",
                 attrs: { visibility: "public", tenant: "t1" } };
ok("可读同租户 public", evaluate(m, "read", pubDoc).allowed);
ok("不可写 public", !evaluate(m, "write", pubDoc).allowed);

console.log("\n=== 5. 租户隔离 ===");
const crossTenant = { type: "document", id: "d4", owner: "u-x",
                      attrs: { visibility: "public", tenant: "t2" } };
ok("不能读其他租户", !evaluate(m, "read", crossTenant).allowed,
   evaluate(m, "read", crossTenant).reason);
ok("admin 也不能跨租户", !evaluate({ sub: "a2", roles: ["admin"], tenant: "t1" }, "read", crossTenant).allowed);

console.log("\n=== 6. 审计只追加 ===");
const auditor = { sub: "u-a", roles: ["auditor"], tenant: "t1" };
ok("auditor 可读审计", evaluate(auditor, "read", { type: "audit" }).allowed);
ok("auditor 不可写审计", !evaluate(auditor, "write", { type: "audit" }).allowed,
   evaluate(auditor, "write", { type: "audit" }).reason);
ok("admin 也不可写审计", !evaluate(admin, "write", { type: "audit" }).allowed);

console.log("\n=== 7. 默认拒绝 ===");
ok("未知资源被拒", !evaluate({ sub: "n", roles: ["member"], tenant: "t1" }, "read", { type: "user" }).allowed);

console.log("\n=== 8. deny 优先 ===");
const custom = [
  { name: "allow-all", effect: "allow" },
  { name: "deny-write", actions: ["write"], effect: "deny" },
];
const d = evaluate(m, "write", ownDoc, custom);
ok("allow+deny 同时命中时拒绝", !d.allowed, d.reason);
ok("read 仍允许", evaluate(m, "read", ownDoc, custom).allowed);

console.log("\n" + "=".repeat(52));
console.log("结果: " + (fail === 0 ? "ALL PASS" : fail + " FAILED") + "   (pass=" + pass + ", fail=" + fail + ")");
process.exit(fail === 0 ? 0 : 1);
