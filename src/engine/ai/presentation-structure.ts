/**
 * Stage 1：文章 → 簡報架構（article_to_presentation_structure）
 */
import type { OutlineNode } from "../../model/types";
import type { AssetRef } from "../../model/types";
import { requestJson } from "../llm/json";
import {
  ARTICLE_TO_STRUCTURE_SYSTEM,
  userArticleToStructurePrompt,
} from "../llm/prompts";
import type { ProviderCredentials } from "../llm/types";
import { fallbackAnalyzeParagraph } from "./paragraph-analysis";
import type {
  PresentationStructure,
  SlideStructureItem,
  SlideVisualType,
  StructureCoverageReport,
  StructureOmittedItem,
} from "./presentation-structure-types";
import { presetHintForVisual } from "./visual-preset-map";
import type { SlideBrief } from "./slide-briefs";

const VISUAL_SET = new Set<string>([
  "title", "agenda", "section-divider", "executive-summary", "bullet-list",
  "comparison", "timeline", "process", "framework", "chart", "case", "quote",
  "problem", "recommendation", "closing", "image-focus",
]);

function coerceVisual(v: unknown): SlideVisualType {
  const s = typeof v === "string" ? v : "bullet-list";
  return VISUAL_SET.has(s) ? (s as SlideVisualType) : "bullet-list";
}

function coerceStructure(raw: unknown): PresentationStructure | null {
  const root = raw as Record<string, unknown>;
  if (!root || typeof root !== "object") return null;

  const slidesRaw = Array.isArray(root.slides) ? root.slides : [];
  const slides: SlideStructureItem[] = [];

  for (let i = 0; i < slidesRaw.length; i++) {
    const o = slidesRaw[i] as Record<string, unknown>;
    if (!o || typeof o !== "object") continue;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const keyPoints = Array.isArray(o.keyPoints)
      ? o.keyPoints.map((k) => String(k).trim()).filter(Boolean)
      : [];
    if (!title && keyPoints.length === 0) continue;

    const sourceRefs = Array.isArray(o.sourceRefs)
      ? o.sourceRefs.filter((x): x is number => typeof x === "number" && x >= 0)
      : [];

    slides.push({
      slideNo: typeof o.slideNo === "number" ? o.slideNo : i + 1,
      title: title || keyPoints[0] || "重點",
      mainMessage: typeof o.mainMessage === "string" ? o.mainMessage.trim() : title,
      keyPoints: keyPoints.length > 0 ? keyPoints : [title],
      suggestedVisual: coerceVisual(o.suggestedVisual),
      speakerNote: typeof o.speakerNote === "string" ? o.speakerNote.trim() : undefined,
      sourceRefs,
      kind:
        o.kind === "title" || o.kind === "chapter" || o.kind === "image" || o.kind === "section"
          ? o.kind
          : "section",
    });
  }

  const omitted: StructureOmittedItem[] = [];
  if (Array.isArray(root.omitted)) {
    for (const item of root.omitted) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.sourceIndex !== "number") continue;
      omitted.push({
        sourceIndex: o.sourceIndex,
        reason: typeof o.reason === "string" ? o.reason : "未說明",
      });
    }
  }

  return {
    objective: typeof root.objective === "string" ? root.objective : "教學簡報",
    audience: typeof root.audience === "string" ? root.audience : "學習者",
    coreMessage: typeof root.coreMessage === "string" ? root.coreMessage : "",
    narrativeFlow: typeof root.narrativeFlow === "string" ? root.narrativeFlow : "",
    slides,
    omitted,
  };
}

/** 規則保底：逐段轉成 section slides（敘事順序 = 原文順序）。 */
export function fallbackStructureFromParagraphs(
  paragraphs: string[],
  pageStrategy: "compact" | "balanced" | "full",
): PresentationStructure {
  const slides: SlideStructureItem[] = [];
  if (pageStrategy !== "compact") {
    slides.push({
      slideNo: 1,
      title: "課程簡報",
      mainMessage: "本簡報將依序說明各段重點",
      keyPoints: ["依原文段落完整展開"],
      suggestedVisual: "title",
      kind: "title",
      sourceRefs: [],
    });
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const p = fallbackAnalyzeParagraph(i, paragraphs[i]!);
    slides.push({
      slideNo: slides.length + 1,
      title: p.title,
      mainMessage: p.bullets[0] ?? p.title,
      keyPoints: p.bullets,
      suggestedVisual: "bullet-list",
      sourceRefs: [i],
      kind: "section",
    });
  }

  return {
    objective: "完整教學簡報",
    audience: "學習者",
    coreMessage: slides.find((s) => s.kind === "section")?.title ?? "教學內容",
    narrativeFlow: "依原文段落循序說明（What → Why → How → Takeaway）",
    slides,
    omitted: [],
  };
}

export async function buildPresentationStructure(
  content: string,
  paragraphs: string[],
  creds: ProviderCredentials,
  opts: {
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
    pageStrategy?: "compact" | "balanced" | "full";
    deckStyle?: "teaching" | "business" | "academic" | "casual";
    emphasisKeywords?: string[];
  },
): Promise<PresentationStructure> {
  opts.onProgress?.("分析文章並建立簡報架構…");

  try {
    const raw = await requestJson(
      creds,
      [
        { role: "system", content: ARTICLE_TO_STRUCTURE_SYSTEM(opts.pageStrategy ?? "full") },
        {
          role: "user",
          content: userArticleToStructurePrompt(content, paragraphs, {
            pageStrategy: opts.pageStrategy,
            deckStyle: opts.deckStyle,
            emphasisKeywords: opts.emphasisKeywords,
          }),
        },
      ],
      { temperature: 0.4, maxTokens: 16384, signal: opts.signal },
      "簡報架構",
    );

    const parsed = coerceStructure(raw);
    if (parsed && parsed.slides.length > 0) {
      return renumberSlides(parsed);
    }
  } catch (err) {
    console.warn("簡報架構 AI 失敗，改用規則保底:", err);
  }

  return fallbackStructureFromParagraphs(paragraphs, opts.pageStrategy ?? "full");
}

function renumberSlides(structure: PresentationStructure): PresentationStructure {
  return {
    ...structure,
    slides: structure.slides.map((s, i) => ({ ...s, slideNo: i + 1 })),
  };
}

/** Stage 1.5：段落覆蓋率對帳。full 強制補洞；balanced 補洞並允許 omitted；compact 較寬鬆。 */
export function reconcileStructureCoverage(
  structure: PresentationStructure,
  paragraphs: string[],
  pageStrategy: "compact" | "balanced" | "full",
): { structure: PresentationStructure; report: StructureCoverageReport } {
  const total = paragraphs.length;
  const covered = new Set<number>();
  for (const slide of structure.slides) {
    for (const idx of slide.sourceRefs) {
      if (idx >= 0 && idx < total) covered.add(idx);
    }
  }

  const missing: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!covered.has(i)) missing.push(i);
  }

  let patchedSlides = 0;
  const slides = [...structure.slides];

  if (pageStrategy === "full" || pageStrategy === "balanced") {
    for (const idx of missing) {
      const p = fallbackAnalyzeParagraph(idx, paragraphs[idx]!);
      slides.push({
        slideNo: slides.length + 1,
        title: p.title,
        mainMessage: p.bullets[0] ?? p.title,
        keyPoints: p.bullets,
        suggestedVisual: "bullet-list",
        speakerNote: `補充自原文段落 ${idx}`,
        sourceRefs: [idx],
        kind: "section",
      });
      covered.add(idx);
      patchedSlides += 1;
    }
  }

  const missingAfter = [];
  for (let i = 0; i < total; i++) {
    if (!covered.has(i)) missingAfter.push(i);
  }

  const coveredCount = total - missingAfter.length;
  const report: StructureCoverageReport = {
    totalParagraphs: total,
    coveredParagraphs: coveredCount,
    coveragePercent: total > 0 ? Math.round((coveredCount / total) * 1000) / 10 : 100,
    patchedSlides,
    missingParagraphIndices: missingAfter,
  };

  return {
    structure: {
      ...structure,
      slides: renumberSlides({ ...structure, slides }).slides,
      omitted: pageStrategy === "full" ? [] : structure.omitted,
    },
    report,
  };
}

/** 依段落標記分配圖片到架構 slides。 */
export function assignImagesToStructure(
  structure: PresentationStructure,
  assets: AssetRef[],
  rawParagraphs: string[],
): void {
  const IMAGE_MARKER_RE = /\[Image:\s*([^\]]+)\]/g;
  const validIds = new Set(assets.map((a) => a.id));
  const paraToImages = new Map<number, string[]>();

  rawParagraphs.forEach((para, pIdx) => {
    for (const m of para.matchAll(IMAGE_MARKER_RE)) {
      const id = m[1]!.trim();
      if (!validIds.has(id)) continue;
      const list = paraToImages.get(pIdx) ?? [];
      if (!list.includes(id)) list.push(id);
      paraToImages.set(pIdx, list);
    }
  });

  const used = new Set<string>();
  for (const slide of structure.slides) {
    const ids: string[] = [];
    for (const ref of slide.sourceRefs) {
      for (const imgId of paraToImages.get(ref) ?? []) {
        if (!used.has(imgId)) {
          ids.push(imgId);
          used.add(imgId);
        }
      }
    }
    if (ids.length > 0) {
      slide.imageAssetIds = ids;
      if (slide.suggestedVisual === "bullet-list" || slide.suggestedVisual === "framework") {
        slide.suggestedVisual = "case";
      }
    }
  }

  let rr = 0;
  const sectionSlides = structure.slides.filter((s) => s.kind === "section" || !s.kind);
  for (const asset of assets) {
    if (used.has(asset.id)) continue;
    const target = sectionSlides[rr % Math.max(1, sectionSlides.length)];
    if (target) {
      target.imageAssetIds = [...(target.imageAssetIds ?? []), asset.id];
      target.suggestedVisual = "case";
      used.add(asset.id);
    }
    rr += 1;
  }
}

export function structureToOutline(structure: PresentationStructure): OutlineNode[] {
  return structure.slides
    .filter((s) => s.kind !== "title" && s.kind !== "image")
    .map((s) => ({
      level: 2 as const,
      text: s.title,
      keyPoint: true,
      children: s.keyPoints.map((b) => ({
        level: 3 as const,
        text: b,
        keyPoint: true,
        children: [],
      })),
    }));
}

/** 條列過多時拆成多張 slide（保留 sourceRefs）。 */
export function splitLargeStructureSlides(
  structure: PresentationStructure,
  maxBullets = 7,
): PresentationStructure {
  const out: SlideStructureItem[] = [];
  for (const slide of structure.slides) {
    if (slide.kind === "title" || slide.keyPoints.length <= maxBullets) {
      out.push(slide);
      continue;
    }
    const parts = Math.ceil(slide.keyPoints.length / maxBullets);
    for (let p = 0; p < parts; p++) {
      const chunk = slide.keyPoints.slice(p * maxBullets, (p + 1) * maxBullets);
      out.push({
        ...slide,
        title: parts > 1 ? `${slide.title}（${p + 1}/${parts}）` : slide.title,
        keyPoints: chunk,
        imageAssetIds: p === 0 ? slide.imageAssetIds : undefined,
      });
    }
  }
  return renumberSlides({ ...structure, slides: out });
}

export function structureToSlideBriefs(structure: PresentationStructure): SlideBrief[] {
  return structure.slides.map((s) => {
    if (s.kind === "chapter") {
      return {
        kind: "chapter" as const,
        title: s.title,
        keyPoints: [],
        presetHint: "section-divider",
        sourceExcerpt: undefined,
        paragraphIndex: s.sourceRefs[0],
        speakerNote: s.speakerNote,
        mainMessage: s.mainMessage,
      };
    }
    if (s.kind === "image" && s.imageAssetIds?.[0]) {
      return {
        kind: "image" as const,
        title: s.title,
        keyPoints: [],
        presetHint: "big-image-center",
        imageAssetId: s.imageAssetIds[0],
        paragraphIndex: s.sourceRefs[0],
        speakerNote: s.speakerNote,
        mainMessage: s.mainMessage,
      };
    }
    return {
      kind: "section" as const,
      title: s.title,
      keyPoints: s.keyPoints,
      presetHint: presetHintForVisual(s.suggestedVisual),
      imageAssetId: s.imageAssetIds?.[0],
      paragraphIndex: s.sourceRefs[0],
      speakerNote: s.speakerNote,
      mainMessage: s.mainMessage,
    };
  });
}
