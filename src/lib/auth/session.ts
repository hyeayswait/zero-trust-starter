import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./types";
import { isRevoked, revocationWatermark } from "./revocation";

const secret = () => {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET 必须 >= 32 字符");
  return new TextEncoder().encode(s);
};

// 零信任：访问令牌 TTL 短（15 分钟），降低泄露影响面
export const ACCESS_TTL = "15m";
export const ACCESS_TTL_SECONDS = 15 * 60;

export interface SignedSession {
  token: string;
  jti: string;
}

/**
 * 签发会话令牌。
 * 必须带 jti（JWT ID），否则无法实现登出后的即时撤销。
 */
export async function signSession(
  user: Omit<SessionUser, "exp">
): Promise<SignedSession> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    roles: user.roles,
    deviceId: user.deviceId,
    ip: user.ip,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
  return { token, jti };
}

export interface VerifiedSession {
  user: SessionUser;
  jti: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * 校验令牌：签名 -> 有效期 -> 撤销表 -> 用户级撤销水位。
 *
 * 仅校验签名和有效期是不够的：登出后 token 在到期前仍然有效，
 * 因此必须再查撤销表（零信任「始终验证」要求）。
 */
export async function verifySession(token: string): Promise<SessionUser | null> {
  const full = await verifySessionFull(token);
  return full ? full.user : null;
}

export async function verifySessionFull(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const jti = String(payload.jti ?? "");

    // 1) 单 token 撤销
    if (await isRevoked(jti)) return null;

    // 2) 用户级撤销（踢出所有会话）：签发时间早于水位则失效
    const sub = String(payload.sub);
    const mark = await revocationWatermark(sub);
    const iat = Number(payload.iat ?? 0);
    if (mark !== null && iat * 1000 < mark) return null;

    return {
      user: {
        sub,
        email: String(payload.email),
        name: String(payload.name),
        roles: (payload.roles as SessionUser["roles"]) ?? ["member"],
        deviceId: String(payload.deviceId),
        ip: String(payload.ip),
        exp: Number(payload.exp),
      },
      jti,
      issuedAt: iat,
      expiresAt: Number(payload.exp),
    };
  } catch {
    return null;
  }
}
