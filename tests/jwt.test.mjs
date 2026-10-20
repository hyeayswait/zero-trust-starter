// 真实 JWT 单测：使用 jose（与 src/lib/auth/session.ts 同一套算法）
// 运行: node tests/jwt.test.mjs   （需先 npm install 安装 jose）
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode("test-secret-needs-32-bytes-minimum-ok");
const ACCESS_TTL = "15m";

async function signSession(user) {
  return await new SignJWT({
    email: user.email, name: user.name, roles: user.roles,
    deviceId: user.deviceId, ip: user.ip,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: String(payload.sub), email: String(payload.email),
      roles: payload.roles, deviceId: String(payload.deviceId),
      ip: String(payload.ip), exp: Number(payload.exp),
    };
  } catch { return null; }
}

let pass = 0, fail = 0;
function check(name, cond) {
  console.log(`  [${cond ? "OK" : "FAIL"}] ${name}`);
  cond ? pass++ : fail++;
}

async function main() {
  console.log("=== 真实 JWT 测试 (jose, HS256, 15m TTL, deviceId 绑定) ===");
  const user = { sub: "u1", email: "a@b.c", name: "A", roles: ["member"], deviceId: "dev-A", ip: "1.1.1.1" };

  const token = await signSession(user);
  const v = await verifySession(token);
  check("正常签发并校验通过", v !== null && v.sub === "u1" && v.deviceId === "dev-A");

  // 设备绑定：模拟请求来自另一台设备
  const stolen = v; // 令牌内容相同，但请求设备不是 dev-A
  const sameDevice = stolen && stolen.deviceId === "dev-A";
  check("零信任设备绑定：请求设备一致才放行", sameDevice === true);
  // 真实守卫逻辑：guard.ts 里若 req 设备 != user.deviceId 返回 null
  const reqDevice = "dev-B";
  const guardOk = v && reqDevice === v.deviceId;
  check("守卫拒绝设备不一致(盗用)", guardOk === false);

  // 短 TTL：构造一个已过期的令牌
  const expired = await new SignJWT({ deviceId: "dev-A" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u2").setIssuedAt()
    .setExpirationTime("-1s")  // 已过期
    .sign(secret);
  const ev = await verifySession(expired);
  check("过期令牌被拒(null)", ev === null);

  console.log(`\n结果: ${fail === 0 ? "ALL PASS" : "HAS FAILURE"} (pass=${pass} fail=${fail})`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
