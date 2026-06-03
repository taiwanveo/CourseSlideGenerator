/**
 * 逐段分析文章：每段先摘要成條列，再提煉簡報標題，確保無遺漏。
 */
import { requestJson } from "../llm/json";
import { PARAGRAPH_ANALYSIS_SYSTEM, userParagraphAnalysisPrompt } from "../llm/prompts";
import type { ProviderCredentials } from "../llm/types";
import type { OutlineNode } from "../../model/types";
import type { SlideBrief } from "./slide-briefs";

export interface AnalyzedParagraph {
  index: number;
  source: string;
  title: string;
  bullets: string[];
}

const MIN_PARA_LEN = 8;

/** 將文章切成段落（不遺漏任何有內容的段）。 */
export function splitArticleParagraphs(text: string): string[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/【原文附圖標籤[\s\S]*$/m, "")
    .trim();

  let parts = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter((p) => p.length >= MIN_PARA_LEN);

  if (parts.length <= 1) {
    parts = cleaned
      .split(/\n/)
      .map((p) => p.replace(/^\s*[•\-*]\s*/, "").trim())
      .filter((p) => p.length >= MIN_PARA_LEN);
  }

  if (parts.length === 0 && cleaned.length >= MIN_PARA_LEN) {
    parts = [cleaned];
  }

  return parts;
}

/** 批次呼叫 AI 逐段分析；缺段時以規則保底。 */
export async function analyzeParagraphsInBatches(
  paragraphs: string[],
  creds: ProviderCredentials,
  opts: {
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
    pageStrategy?: "compact" | "balanced" | "full";
  },
): Promise<AnalyzedParagraph[]> {
  const out: AnalyzedParagraph[] = [];
  const BATCH = 4;

  for (let i = 0; i < paragraphs.length; i += BATCH) {
    const batch = paragraphs.slice(i, i + BATCH).map((source, j) => ({ index: i + j, source }));
    opts.onProgress?.(`逐段分析中…（${Math.min(i + 1, paragraphs.length)}/${paragraphs.length}）`);

    try {
      const raw = await requestJson(
        creds,
        [
          { role: "system", content: PARAGRAPH_ANALYSIS_SYSTEM },
          {
            role: "user",
            content: userParagraphAnalysisPrompt(batch, opts.pageStrategy),
          },
        ],
        { temperature: 0.35, maxTokens: 16384, signal: opts.signal },
        "逐段分析",
      );

      const parsed = coerceParagraphAnalysis(raw, batch);
      out.push(...parsed);
    } catch (err) {
      console.warn(`逐段分析批次 ${i} 失敗，改用規則保底:`, err);
      for (const item of batch) {
        out.push(fallbackAnalyzeParagraph(item.index, item.source));
      }
    }
  }

  return ensureAllParagraphs(paragraphs, out);
}

function coerceParagraphAnalysis(
  raw: unknown,
  batch: Array<{ index: number; source: string }>,
): AnalyzedParagraph[] {
  const root = raw as { paragraphs?: unknown[] };
  const arr = Array.isArray(root.paragraphs) ? root.paragraphs : [];
  const byIndex = new Map<number, AnalyzedParagraph>();

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const index = typeof o.index === "number" ? o.index : -1;
    const source = batch.find((b) => b.index === index)?.source ?? "";
    if (index < 0 || !source) continue;

    const bullets = Array.isArray(o.bullets)
      ? o.bullets.map((b) => String(b).trim()).filter(Boolean)
      : [];
    let title = typeof o.title === "string" ? o.title.trim() : "";

    if (bullets.length === 0) {
      byIndex.set(index, fallbackAnalyzeParagraph(index, source));
      continue;
    }
    if (!title) title = deriveTitleFromBullets(bullets, source);

    byIndex.set(index, { index, source, title, bullets });
  }

  return batch.map((b) => byIndex.get(b.index) ?? fallbackAnalyzeParagraph(b.index, b.source));
}

function ensureAllParagraphs(paragraphs: string[], analyzed: AnalyzedParagraph[]): AnalyzedParagraph[] {
  const byIndex = new Map(analyzed.map((a) => [a.index, a]));
  return paragraphs.map((source, index) => byIndex.get(index) ?? fallbackAnalyzeParagraph(index, source));
}

/** 規則保底：先拆句成條列，再取首句/主旨為標題。 */
export function fallbackAnalyzeParagraph(index: number, source: string): AnalyzedParagraph {
  const sentences = source
    .split(/[。！？.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const bullets =
    sentences.length > 0
      ? sentences
      : source
          .split(/[，,、；;]+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 4);

  const finalBullets = bullets.length > 0 ? bullets : [source.trim()];
  const title = deriveTitleFromBullets(finalBullets, source);

  return { index, source, title, bullets: finalBullets };
}

function deriveTitleFromBullets(bullets: string[], source: string): string {
  const first = bullets[0]?.trim() ?? source.trim();
  if (first.length <= 22) return first;
  const cut = first.slice(0, 20).trim();
  return cut.endsWith("…") ? cut : `${cut}…`;
}

/** 逐段分析結果 → 投影片規格（一段至少一頁）。 */
export function paragraphsToSlideBriefs(analyzed: AnalyzedParagraph[]): SlideBrief[] {
  return analyzed.map((p) => ({
    kind: "section" as const,
    title: p.title,
    keyPoints: p.bullets,
    sourceExcerpt: p.source,
    presetHint: "bullet-list",
    paragraphIndex: p.index,
  }));
}

/** 由逐段結果組出側欄大綱對位用的大綱樹。 */
export function outlineFromParagraphAnalysis(analyzed: AnalyzedParagraph[]): OutlineNode[] {
  return analyzed.map((p) => ({
    level: 2 as const,
    text: p.title,
    keyPoint: true,
    children: p.bullets.map((b) => ({
      level: 3 as const,
      text: b,
      keyPoint: true,
      children: [],
    })),
  }));
}
