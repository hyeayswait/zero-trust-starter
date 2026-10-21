import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";

// 零信任：不仅校验令牌有效，还要校验上下文（设备绑定）是否一致
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const all = req.cookies.getAll().map((c) => c.name);
  const token = req.cookies.get("zt_token")?.value;

  if (!token) {
    // 诊断：区分「完全没带 Cookie」与「只缺 zt_token」
    console.warn(
      `[AUTH] no zt_token. cookies=[${all.join(",") || "none"}] ` +
        `host=${req.headers.get("host")} url=${req.nextUrl.pathname}`
    );
    return null;
  }

  const user = await verifySession(token);
  if (!user) {
    console.warn(
      `[AUTH] zt_token invalid (bad signature / expired / APP_SECRET changed). ` +
        `tokenLen=${token.length} secretsLen=${(process.env.APP_SECRET ?? "").length}`
    );
    return null;
  }

  const deviceId = req.cookies.get("device_id")?.value;
  // 设备不匹配视为会话被盗用，直接拒绝
  if (deviceId && deviceId !== user.deviceId) {
    console.warn(
      `[AUTH] device mismatch. cookie=${deviceId.slice(0, 8)} token=${user.deviceId.slice(0, 8)}`
    );
    return null;
  }
  return user;
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}
