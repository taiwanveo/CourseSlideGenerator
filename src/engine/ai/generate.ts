/**
 * AI 生成流程：原文 → 繁中整理 → 逐段分析 → 版型意圖 → 物件樹 Project。
 */
import { DEFAULT_MOTION, createBlankProject, newId } from "../../model/factory";
import type { OutlineNode, Project, AssetRef, GenerationQualityReport } from "../../model/types";
import type { LayoutIntent } from "../layout/intent";
import { buildPatchIntentForRequirement, ensureOutlineCoverage } from "./outline-coverage";
import {
  analyzeParagraphsInBatches,
  outlineFromParagraphAnalysis,
  paragraphsToSlideBriefs,
  splitArticleParagraphs,
} from "./paragraph-analysis";
import {
  appendMissingImageMarkers,
  insertAllImagesIntoBriefs,
  replaceImagePlaceholders,
  stripImageMarkers,
} from "./image-placement";
import {
  buildIntentFromBrief,
  splitLargeBriefs,
} from "./slide-briefs";
import { translateDeck } from "../layout/translate";
import { chat } from "../llm/client";
import { requestJson } from "../llm/json";
import {
  TRANSLATE_SYSTEM,
} from "../llm/prompts";
import type { ProviderCredentials } from "../llm/types";
import type { ParsedImage } from "../import/parse-document";

export interface GenerateInput {
  rawText: string;
  title?: string;
  creds: ProviderCredentials;
  /** 是否需要翻譯整理（非中文或想潤飾時開啟） */
  refine?: boolean;
  /** 原始素材內含的圖片（鐵律：不得捨棄，放入簡報） */
  images?: ParsedImage[];
  /** 覆蓋率最低門檻（50-100），低於此值將啟動強制補頁。 */
  minCoverageThreshold?: number;
  /** 生成風格控制。 */
  deckStyle?: "teaching" | "business" | "academic" | "casual";
  /** 頁數策略：compact 精簡 / balanced 平衡 / full 完整。 */
  pageStrategy?: "compact" | "balanced" | "full";
  /** 需強調的關鍵詞。 */
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

export async function generatePresentation(input: GenerateInput): Promise<Project> {
  const { creds, signal, onProgress } = input;
  const minCoverageThreshold = Math.max(50, Math.min(100, Math.round(input.minCoverageThreshold ?? 90)));

  // 建立 project（唯一真相）
  const project = createBlankProject(input.title ?? "AI 教學簡報");
  project.id = newId("proj");

  // 1. 處理圖片：先全數加入 project.assets
  const imageAssets: AssetRef[] = [];
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
    }
  }

  // 2. 選擇性整理原文
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

  // 4. 逐段分析：每段先摘要條列，再提煉標題（不可遺漏任何一段）
  const rawParagraphs = splitArticleParagraphs(content);
  if (rawParagraphs.length === 0) {
    throw new Error("無法從文章切出有效段落，請確認內容長度足夠。");
  }
  const cleanParagraphs = rawParagraphs.map(stripImageMarkers);

  onProgress?.(`逐段分析中…（共 ${cleanParagraphs.length} 段）`);
  const analyzed = await analyzeParagraphsInBatches(cleanParagraphs, creds, {
    signal,
    onProgress,
    pageStrategy: input.pageStrategy,
  });

  const outline: OutlineNode[] = outlineFromParagraphAnalysis(analyzed);

  // 5. 依逐段規格組裝投影片（一段至少一頁，條列完整保留）
  onProgress?.("組裝投影片規格…");
  let slideBriefs = splitLargeBriefs(paragraphsToSlideBriefs(analyzed), 7);
  onProgress?.(`分配 ${imageAssets.length} 張附圖…`);
  slideBriefs = insertAllImagesIntoBriefs(slideBriefs, imageAssets, rawParagraphs);

  let slidesWithCoverage: LayoutIntent[] = slideBriefs.map((b) => buildIntentFromBrief(b));
  if (slidesWithCoverage.length === 0) {
    throw new Error("無法從文章產生投影片，請稍後再試。");
  }

  // 6. 大綱覆蓋率檢查：缺漏節點自動補頁
  onProgress?.("檢查大綱覆蓋率…");
  const coverage = ensureOutlineCoverage(outline, slidesWithCoverage);
  slidesWithCoverage = coverage.intents;
  let coverageReport = coverage.report;
  if (coverageReport.patchedSlides > 0) {
    onProgress?.(
      `自動補頁 ${coverageReport.patchedSlides} 張（覆蓋率 ${coverageReport.coveragePercentBefore}% → ${coverageReport.coveragePercentAfter}%）`,
    );
  } else {
    onProgress?.(`大綱覆蓋率 ${coverageReport.coveragePercentAfter}%`);
  }
  if (coverageReport.missingAfterPatch.length > 0) {
    console.warn("補頁後仍有大綱缺漏:", coverageReport.missingAfterPatch);
  }

  // 6-2. 若仍低於使用者門檻，啟動強制補頁（每個缺漏節點至少一頁）
  if (coverageReport.coveragePercentAfter < minCoverageThreshold && coverageReport.missingAfterPatch.length > 0) {
    onProgress?.(`覆蓋率低於門檻 ${minCoverageThreshold}% ，啟動強制補頁…`);
    const missingNodes = collectMissingNodes(outline, coverageReport.missingAfterPatch);
    const forcedPatch = missingNodes.map((n) => buildPatchIntentForRequirement(n));
    slidesWithCoverage = [...slidesWithCoverage, ...forcedPatch];
    const recalc = ensureOutlineCoverage(outline, slidesWithCoverage);
    slidesWithCoverage = recalc.intents;
    coverageReport = recalc.report;
    onProgress?.(`強制補頁完成，覆蓋率提升至 ${coverageReport.coveragePercentAfter}%`);
  }

  // 6-3. 品質補強：事實一致性檢查 + 過密頁面自動拆頁
  onProgress?.("進行品質檢查…");
  const quality = buildQualityReportAndPatchSlides(content, slidesWithCoverage);
  slidesWithCoverage = quality.patchedSlides;

  // 7. 組裝
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
      if (node.children.length > 0) walk(node.children, path, id);
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
  return out.map((x) => x.trim()).filter(Boolean);
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

/** AI 風格主題生成：根據文字描述，產生一組 CSS 自訂屬性覆寫值。 */
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
