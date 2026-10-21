// RAG 桩：把业务文档切片后做检索增强。生产可替换为 pgvector / Chroma / Qdrant。
export interface Chunk { id: string; text: string; }

const STORE: Chunk[] = [];

export function ingest(text: string): void {
  // 简单按段落切片
  text.split(/\n{2,}/).forEach((p, i) =>
    STORE.push({ id: `c${i}`, text: p.trim() })
  );
}

// 朴素关键词检索（演示）；真实场景用 embedding + 向量相似度
export function retrieve(query: string, topK = 3): Chunk[] {
  const q = query.toLowerCase();
  return STORE
    .map((c) => ({ c, score: c.text.toLowerCase().split(/\s+/).filter((w) => q.includes(w)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.c);
}

export function buildPrompt(query: string): string {
  if (process.env.RAG_ENABLED !== "true") return query;
  const ctx = retrieve(query).map((c) => c.text).join("\n---\n");
  return `参考上下文:\n${ctx}\n\n问题: ${query}`;
}
