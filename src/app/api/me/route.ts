import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/security/guard";
import { hasPermission } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: { email: user.email, name: user.name, roles: user.roles },
    permissions: ["dashboard:read","admin:read","admin:write","audit:read","chat:use"].filter(
      (p) => hasPermission(user, p as any)
    ),
  });
}
