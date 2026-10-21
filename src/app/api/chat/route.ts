import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/security/require";
import { streamChat, type ChatMessage } from "@/lib/ai/client";
import { buildPrompt } from "@/lib/ai/rag";

export async function POST(req: NextRequest) {
  return protect(req, "chat:use", async () => {
    let messages: ChatMessage[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.messages)) messages = body.messages;
    } catch {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 });
    }
    if (messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
    }

    const last = messages.slice(-1)[0]?.content ?? "";
    const full: ChatMessage[] = [
      { role: "system", content: "你是本系统的安全助手，只回答与产品/安全相关的问题。" },
      ...messages,
      { role: "user", content: buildPrompt(last) },
    ];

    // 先探测模型服务是否可用：不可用时立刻返回明确错误，
    // 而不是先 200 建流再中途崩断（那样前端只能看到空白）。
    const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    try {
      const probe = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
    } catch (err) {
      return NextResponse.json(
        {
          error: "AI 服务不可用",
          detail: `无法连接 ${base}。请确认 Ollama 已启动（或运行 npm run demo:mocks）。`,
          reason: (err as Error).message,
        },
        { status: 503 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const piece of streamChat(full)) {
            controller.enqueue(encoder.encode(piece));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`\n[生成中断] ${(err as Error).message}`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  });
}
