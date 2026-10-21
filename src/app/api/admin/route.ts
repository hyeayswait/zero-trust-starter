import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/security/require";
import { recentAudits } from "@/lib/audit/log";

export async function GET(req: NextRequest) {
  return protect(req, "admin:read", async () => {
    // recentAudits 是异步的：漏掉 await 会让 JSON.stringify(Promise) 得到 {}，
    // 前端因此看到空对象而不是审计数组。
    const audits = await recentAudits(20);
    return NextResponse.json({ audits, total: audits.length });
  });
}
