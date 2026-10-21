import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./types";

const secret = () => {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET 必须 >= 32 字符");
  return new TextEncoder().encode(s);
};

// 零信任：访问令牌 TTL 短（15 分钟），降低泄露影响面
export const ACCESS_TTL = "15m";

export async function signSession(user: Omit<SessionUser, "exp">): Promise<string> {
  return await new SignJWT({
    email: user.email,
    name: user.name,
    roles: user.roles,
    deviceId: user.deviceId,
    ip: user.ip,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      roles: (payload.roles as SessionUser["roles"]) ?? ["member"],
      deviceId: String(payload.deviceId),
      ip: String(payload.ip),
      exp: Number(payload.exp),
    };
  } catch {
    return null;
  }
}
