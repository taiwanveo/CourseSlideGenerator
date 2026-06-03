/**
 * AI 生成流程：原文 → 簡報架構（Skill 1）→ 投影片內容（Skill 2）→ 物件樹 Project。
 */
import { DEFAULT_MOTION, createBlankProject, newId } from "../../model/factory";
import type {
  OutlineNode,
  Project,
  AssetRef,
  GenerationQualityReport,
  PresentationStructureMeta,
} from "../../model/types";
import type { LayoutIntent } from "../layout/intent";
import { buildPatchIntentForRequirement, ensureOutlineCoverage } from "./outline-coverage";
import { splitArticleParagraphs } from "./paragraph-analysis";
import { appendMissingImageMarkers, replaceImagePlaceholders } from "./image-placement";
import {
  assignImagesToStructure,
  buildPresentationStructure,
  reconcileStructureCoverage,
  splitLargeStructureSlides,
  structureToOutline,
} from "./presentation-structure";
import { generateSlidesFromStructure } from "./presentation-generate";
import { refineLongTitles } from "./title-refine";
import { translateDeck } from "../layout/translate";
import { chat } from "../llm/client";
import { requestJson } from "../llm/json";
import { TRANSLATE_SYSTEM } from "../llm/prompts";
import type { ProviderCredentials } from "../llm/types";
import type { ParsedImage } from "../import/parse-document";

export interface GenerateInput {
  rawText: string;
  title?: string;
  creds: ProviderCredentials;
  refine?: boolean;
  images?: ParsedImage[];
  minCoverageThreshold?: number;
  deckStyle?: "teaching" | "business" | "academic" | "casual";
  pageStrategy?: "compact" | "balanced" | "full";
  emphasisKeywords?: string[];
  signal?: AbortSignal;
  onProgress?: (stage: string) => void;
}

export { extractJson } from "../llm/json";

function buildImageAssetMap(assets: AssetRef[]): Record<string, { width?: number; height?: number }> {
  const map: Record<string, { width?: number; height?: number }> = {};
  for (const a of assets) {
    if (a.kind === "image") map[a.id] = { width: a.width, height: a.height };
  }
  return map;
}

function structureMeta(
  structure: {
    objective: string;
    audience: string;
    coreMessage: string;
    narrativeFlow: string;
    slides: unknown[];
    omitted: unknown[];
  },
  coveragePercent?: number,
): PresentationStructureMeta {
  return {
    objective: structure.objective,
    audience: structure.audience,
    coreMessage: structure.coreMessage,
    narrativeFlow: structure.narrativeFlow,
    slideCount: structure.slides.length,
    omittedCount: structure.omitted.length,
    structureCoveragePercent: coveragePercent,
  };
}

export async function generatePresentation(input: GenerateInput): Promise<Project> {
  const { creds, signal, onProgress } = input;
  const pageStrategy = input.pageStrategy ?? "full";
  const minCoverageThreshold = Math.max(50, Math.min(100, Math.round(input.minCoverageThreshold ?? 90)));

  const project = createBlankProject(input.title ?? "AI 教學簡報");
  project.id = newId("proj");

  const imageAssets: AssetRef[] = [];
  const availableImages: { id: string; name: string }[] = [];
  if (input.images && input.images.length > 0) {
    const seen = new Set<string>();
    let idx = 0;
    for (const img of input.images) {
      if (seen.has(img.dataUrl)) continue;
      seen.add(img.dataUrl);
      idx += 1;
      const asset: AssetRef = {
        id: newId("asset"),
        kind: "image",
        src: img.dataUrl,
        name: img.name || `原文附圖 ${idx}`,
        ...(img.width ? { width: img.width } : {}),
        ...(img.height ? { height: img.height } : {}),
      };
      imageAssets.push(asset);
      project.assets.push(asset);
      availableImages.push({ id: asset.id, name: asset.name });
    }
  }

  let content = input.rawText.trim();
  if (input.refine) {
    onProgress?.("整理內容中…");
    content = await chat(
      creds,
      [
        { role: "system", content: TRANSLATE_SYSTEM },
        { role: "user", content },
      ],
      { temperature: 0.3, signal },
    );
  }

  content = replaceImagePlaceholders(content, imageAssets);
  content = appendMissingImageMarkers(content, imageAssets);

  const rawParagraphs = splitArticleParagraphs(content);
  if (rawParagraphs.length === 0) {
    throw new Error("無法從文章切出有效段落，請確認內容長度足夠。");
  }

  // Stage 1：article_to_presentation_structure
  let structure = await buildPresentationStructure(content, rawParagraphs, creds, {
    signal,
    onProgress,
    pageStrategy,
    deckStyle: input.deckStyle,
    emphasisKeywords: input.emphasisKeywords,
  });

  const { structure: reconciled, report: structCoverage } = reconcileStructureCoverage(
    structure,
    rawParagraphs,
    pageStrategy,
  );
  structure = reconciled;
  if (structCoverage.patchedSlides > 0) {
    onProgress?.(
      `架構補段 ${structCoverage.patchedSlides} 張（段落覆蓋率 ${structCoverage.coveragePercent}%）`,
    );
  }

  assignImagesToStructure(structure, imageAssets, rawParagraphs);
  structure = splitLargeStructureSlides(structure, pageStrategy === "compact" ? 5 : 7);

  const titleRefined = await refineLongTitles(
    structure.slides.map((s) => ({
      index: s.slideNo,
      title: s.title,
      source: s.mainMessage,
    })),
    creds,
    { signal, onProgress },
  );
  for (const slide of structure.slides) {
    const t = titleRefined.get(slide.slideNo);
    if (t) slide.title = t;
  }

  const outline: OutlineNode[] = structureToOutline(structure);

  // Stage 2：presentation_generation
  onProgress?.("產生投影片內容與版型…");
  let slidesWithCoverage = await generateSlidesFromStructure(structure, creds, {
    signal,
    onProgress,
    deckStyle: input.deckStyle,
    pageStrategy,
    availableImages,
  });

  if (slidesWithCoverage.length === 0) {
    throw new Error("無法從簡報架構產生投影片，請稍後再試。");
  }

  onProgress?.("檢查大綱覆蓋率…");
  const coverage = ensureOutlineCoverage(outline, slidesWithCoverage);
  slidesWithCoverage = coverage.intents;
  let coverageReport = coverage.report;

  if (coverageReport.coveragePercentAfter < minCoverageThreshold && coverageReport.missingAfterPatch.length > 0) {
    onProgress?.(`覆蓋率低於門檻 ${minCoverageThreshold}% ，啟動強制補頁…`);
    const missingNodes = collectMissingNodes(outline, coverageReport.missingAfterPatch);
    const forcedPatch = missingNodes.map((n) => buildPatchIntentForRequirement(n));
    slidesWithCoverage = [...slidesWithCoverage, ...forcedPatch];
    const recalc = ensureOutlineCoverage(outline, slidesWithCoverage);
    slidesWithCoverage = recalc.intents;
    coverageReport = recalc.report;
  }

  onProgress?.("進行品質檢查…");
  const quality = buildQualityReportAndPatchSlides(content, slidesWithCoverage);
  slidesWithCoverage = quality.patchedSlides;

  onProgress?.("組裝簡報中…");
  const imageMap = buildImageAssetMap(imageAssets);
  const slides = translateDeck(slidesWithCoverage, {
    motionDefaults: DEFAULT_MOTION,
    imageAssets: imageMap,
  });

  project.source = {
    originalText: input.rawText,
    translatedText: content,
    outline,
    presentationStructure: structureMeta(structure, structCoverage.coveragePercent),
    coverage: coverageReport,
    quality: quality.report,
  };
  project.deck.slides = slides.length > 0 ? slides : project.deck.slides;

  return project;
}

function collectMissingNodes(
  outline: OutlineNode[],
  missingTexts: string[],
): Array<{ level: 1 | 2 | 3; text: string; path: string; keyPoint: boolean; node: OutlineNode; parentId?: string; id: string }> {
  const need = new Set(missingTexts.map((t) => t.trim()));
  const out: Array<{ level: 1 | 2 | 3; text: string; path: string; keyPoint: boolean; node: OutlineNode; parentId?: string; id: string }> = [];
  const walk = (nodes: OutlineNode[], parentPath = "", parentId?: string) => {
    for (const node of nodes) {
      const text = node.text.trim();
      const id = `${node.level}:${parentPath}:${text}`;
      const path = parentPath ? `${parentPath} › ${text}` : text;
      if (need.has(text)) {
        out.push({ level: node.level, text, path, keyPoint: node.keyPoint, node, parentId, id });
      }
      walk(node.children, path, id);
    }
  };
  walk(outline);
  return out;
}

function normalizeText(input: string): string {
  return input.replace(/[\s，。、；：！？""''（）\[\]【】《》\-—·…,.;:!?'"()]/g, "").toLowerCase();
}

function collectSlideTexts(slide: LayoutIntent): string[] {
  const out: string[] = [];
  if (slide.slideTitle) out.push(slide.slideTitle);
  for (const slot of slide.slots) {
    if (slot.text) out.push(slot.text);
    if (slot.listItems?.length) out.push(...slot.listItems);
  }
  if (slide.emphasisPoints?.length) out.push(...slide.emphasisPoints);
  return out;
}

function isDenseSlide(slide: LayoutIntent): boolean {
  let textChars = 0;
  let bulletCount = 0;
  for (const slot of slide.slots) {
    if (slot.text) textChars += slot.text.length;
    if (slot.listItems?.length) {
      bulletCount += slot.listItems.length;
      textChars += slot.listItems.reduce((s, x) => s + x.length, 0);
    }
  }
  return bulletCount > 7 || textChars > 320;
}

function splitDenseSlide(slide: LayoutIntent): LayoutIntent[] {
  const target = slide.slots.find((s) => s.contentType === "list" && s.listItems && s.listItems.length > 7);
  if (!target || !target.listItems) {
    return [slide];
  }
  const items = target.listItems;
  const mid = Math.ceil(items.length / 2);
  const a = items.slice(0, mid);
  const b = items.slice(mid);
  const mk = (chunk: string[], suffix: string): LayoutIntent => ({
    ...slide,
    slideTitle: `${slide.slideTitle} ${suffix}`,
    slots: slide.slots.map((s) => (s === target ? { ...s, listItems: chunk } : s)),
    reason: `${slide.reason ?? ""} | auto-split`,
  });
  return [mk(a, "(1/2)"), mk(b, "(2/2)")];
}

function buildQualityReportAndPatchSlides(
  sourceText: string,
  slides: LayoutIntent[],
): { patchedSlides: LayoutIntent[]; report: GenerationQualityReport } {
  const sourceNorm = normalizeText(sourceText);
  const unsupported: string[] = [];
  const denseBefore = slides.filter(isDenseSlide).length;
  const patched: LayoutIntent[] = [];
  let splitSlidesAdded = 0;

  for (const slide of slides) {
    const texts = collectSlideTexts(slide);
    for (const t of texts) {
      const n = normalizeText(t);
      if (!n) continue;
      if (n.length >= 20 && !sourceNorm.includes(n.slice(0, Math.min(26, n.length)))) {
        unsupported.push(t);
      }
    }

    if (isDenseSlide(slide)) {
      const chunks = splitDenseSlide(slide);
      patched.push(...chunks);
      splitSlidesAdded += Math.max(0, chunks.length - 1);
    } else {
      patched.push(slide);
    }
  }

  const denseAfter = patched.filter(isDenseSlide).length;
  const uniqueUnsupported = Array.from(new Set(unsupported)).slice(0, 80);
  const factualConsistencyPercent = (() => {
    const checked = slides.reduce((n, s) => n + collectSlideTexts(s).length, 0);
    if (checked <= 0) return 100;
    return Math.max(0, Math.round(((checked - uniqueUnsupported.length) / checked) * 1000) / 10);
  })();

  return {
    patchedSlides: patched,
    report: {
      factualConsistencyPercent,
      unsupportedClaims: uniqueUnsupported,
      denseSlidesBeforePatch: denseBefore,
      denseSlidesAfterPatch: denseAfter,
      splitSlidesAdded,
    },
  };
}

/** AI 風格主題生成 */
export async function generateTheme(
  prompt: string,
  creds: ProviderCredentials,
): Promise<Partial<Record<string, string>>> {
  const system = `你是專業的 UI/UX 設計師。請根據使用者的需求，產生一組適用於簡報的 CSS 主題變數。
輸出 JSON，格式：
{"tokens": {
  "--shell": "背景色(外圍)",
  "--surface": "主背景色",
  "--surface-2": "次背景色/強調背景",
  "--text": "主文字顏色",
  "--text-mute": "次文字顏色",
  "--accent": "主視覺點綴色",
  "--accent-soft": "主視覺點綴色(帶透明度, 例如 rgba)",
  "--rule": "分隔線顏色",
  "--font-display": "標題字型 (css font-family字串)",
  "--font-body": "內文字型 (css font-family字串)",
  "--r-card": "圓角大小 (例如 8px)"
}}
只輸出單一合法 JSON 物件。字型建議使用系統內建字型如 "Inter", "Noto Sans TC", "Noto Serif TC" 等。`;

  const parsed = (await requestJson(
    creds,
    [{ role: "system", content: system }, { role: "user", content: prompt }],
    { temperature: 0.7, maxTokens: 4096 },
    "AI 主題",
  )) as { tokens?: Record<string, string> };
  if (!parsed?.tokens) throw new Error("AI 主題產生失敗");
  return parsed.tokens;
}
