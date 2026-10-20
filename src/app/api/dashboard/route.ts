import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/security/require";

export async function GET(req: NextRequest) {
  return protect(req, "dashboard:read", async (user) => {
    return NextResponse.json({
      greeting: `你好，${user.name}`,
      metrics: { activeSessions: 1, threats: 0, lastAudit: new Date().toISOString() },
    });
  });
}
