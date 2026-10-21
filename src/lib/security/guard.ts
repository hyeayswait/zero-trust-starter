import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";

// 零信任：不仅校验令牌有效，还要校验上下文（设备绑定）是否一致
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get("zt_token")?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user) return null;

  const deviceId = req.cookies.get("device_id")?.value;
  // 设备不匹配视为会话被盗用，直接拒绝
  if (deviceId && deviceId !== user.deviceId) return null;
  return user;
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}
