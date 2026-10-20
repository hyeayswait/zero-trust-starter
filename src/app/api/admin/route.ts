import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/security/require";
import { recentAudits } from "@/lib/audit/log";

export async function GET(req: NextRequest) {
  return protect(req, "admin:read", async () => {
    return NextResponse.json({ audits: recentAudits(20) });
  });
}
