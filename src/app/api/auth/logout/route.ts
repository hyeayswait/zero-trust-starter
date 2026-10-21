import { NextRequest, NextResponse } from "next/server";

// 退出登录：同时支持 GET（页面里的普通链接）与 POST（fetch 调用）。
// 原先只实现 POST，导致 <a href="/api/auth/logout"> 点下去返回 405。
function clearSession(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  // 清掉会话令牌
  res.cookies.delete("zt_token");
  // 零信任上下文也要一并清理，避免残留设备绑定影响下次登录
  res.cookies.delete("device_id");
  res.cookies.delete("oidc_state");
  res.cookies.delete("oidc_verifier");
  return res;
}

export async function GET(req: NextRequest) {
  return clearSession(req);
}

export async function POST(req: NextRequest) {
  return clearSession(req);
}
