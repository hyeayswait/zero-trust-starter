import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/security/require";
import { streamChat, type ChatMessage } from "@/lib/ai/client";
import { buildPrompt } from "@/lib/ai/rag";

export async function POST(req: NextRequest) {
  return protect(req, "chat:use", async () => {
    const { messages } = await req.json();
    const last = messages?.slice(-1)?.[0]?.content ?? "";
    const full: ChatMessage[] = [
      { role: "system", content: "你是本系统的安全助手，只回答与产品/安全相关的问题。" },
      ...messages,
      { role: "user", content: buildPrompt(last) },
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const piece of streamChat(full)) {
          controller.enqueue(encoder.encode(piece));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  });
}
