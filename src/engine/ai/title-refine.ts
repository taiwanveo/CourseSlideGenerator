/**
 * 過長簡報標題：先以 LLM 換句話說縮短；仍過長則交由版面引擎縮小字級。
 */
import { requestJson } from "../llm/json";
import { titleNeedsRephrase } from "../layout/text-fit";
import type { ProviderCredentials } from "../llm/types";

const TITLE_REPHRASE_SYSTEM = `你是教學簡報標題編輯。使用者會提供一組「過長」的簡報標題。
請將每一個標題改寫成更精簡、但仍完整保留原意的繁體中文標題。

【鐵律】
- 不得使用省略號（… 或 ...）或截斷原文。
- 不得改變原意、不得新增原文沒有的事實。
- 優先刪除贅詞、合併同義語、改用更短的動詞片語。
- 目標長度約 8–24 字；若實在無法再短，可略長但仍須比原文短。

輸出 JSON：
{"titles":[{"index":0,"title":"改寫後標題"}]}
只輸出單一合法 JSON 物件。`;

export async function refineLongTitles(
  items: Array<{ index: number; title: string; source?: string }>,
  creds: ProviderCredentials,
  opts?: { signal?: AbortSignal; onProgress?: (msg: string) => void },
): Promise<Map<number, string>> {
  const longItems = items.filter((i) => titleNeedsRephrase(i.title.trim()));
  const out = new Map<number, string>();
  if (longItems.length === 0) return out;

  opts?.onProgress?.(`精簡 ${longItems.length} 個過長標題…`);

  const BATCH = 8;
  for (let i = 0; i < longItems.length; i += BATCH) {
    const batch = longItems.slice(i, i + BATCH);
    const body = batch
      .map((item) => {
        const ctx = item.source ? `\n段落摘要：${item.source.slice(0, 200)}` : "";
        return `【${item.index}】原文標題：${item.title}${ctx}`;
      })
      .join("\n\n");

    try {
      const raw = await requestJson(
        creds,
        [
          { role: "system", content: TITLE_REPHRASE_SYSTEM },
          { role: "user", content: `請改寫以下 ${batch.length} 個標題：\n\n${body}` },
        ],
        { temperature: 0.3, maxTokens: 4096, signal: opts?.signal },
        "精簡標題",
      );

      const arr = (raw as { titles?: unknown[] }).titles ?? [];
      for (const row of arr) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const index = typeof o.index === "number" ? o.index : -1;
        const title = typeof o.title === "string" ? o.title.trim() : "";
        if (index < 0 || !title || title.includes("…") || title.includes("...")) continue;
        out.set(index, title);
      }
    } catch (err) {
      console.warn("標題精簡批次失敗，將以完整標題搭配自動縮小字級:", err);
    }
  }

  return out;
}

export function applyTitleRefinements<T extends { index: number; title: string }>(
  items: T[],
  refined: Map<number, string>,
): void {
  for (const item of items) {
    const next = refined.get(item.index);
    if (next) item.title = next;
  }
}
