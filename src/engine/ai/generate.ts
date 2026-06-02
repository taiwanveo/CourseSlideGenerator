/**
 * AI 生成流程：原文 → 繁中整理 → 三層大綱 → 版型意圖 → 物件樹 Project。
 */
import { DEFAULT_MOTION, createBlankProject, createBlankSlide, createImageElement, createTextElement, newId } from "../../model/factory";
import type { OutlineNode, Project, AssetRef, Slide, GenerationQualityReport } from "../../model/types";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../model/types";
import { deckIntentSchema, type LayoutIntent } from "../layout/intent";
import { buildPatchIntentForRequirement, ensureOutlineCoverage } from "./outline-coverage";
import { translateDeck } from "../layout/translate";
import { chat } from "../llm/client";
import {
  OUTLINE_SYSTEM,
  TRANSLATE_SYSTEM,
  intentSystem,
  userIntentPrompt,
  userOutlinePrompt,
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

/** 從 LLM 回傳中萃取 JSON 物件（容忍 ```json 包裹、前後雜訊、尾逗號與截斷）。 */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : raw;
  const start = body.indexOf("{");
  if (start < 0) throw new Error("AI 未回傳有效 JSON");

  // 以括號平衡掃描，找出第一個完整的頂層物件（忽略字串內的括號）。
  const balanced = sliceBalanced(body, start);
  const candidate = balanced ?? body.slice(start);

  // 先嘗試直接解析；失敗則修復（去尾逗號 + 補齊截斷的括號）再試。
  try {
    return JSON.parse(candidate);
  } catch {
    const repaired = repairJson(candidate);
    try {
      return JSON.parse(repaired);
    } catch (e) {
      throw new Error(`AI 回傳的 JSON 無法解析：${e instanceof Error ? e.message : "格式錯誤"}`);
    }
  }
}

/** 從 start（'{'）開始掃描，回傳括號平衡後的字串；若被截斷回傳 null。 */
function sliceBalanced(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** 修復常見的非法 JSON：尾逗號、未閉合字串、被截斷的括號。 */
function repairJson(input: string): string {
  let s = input;

  // 補齊未閉合的字串並追蹤括號堆疊。
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) s += '"';

  // 移除結尾被截斷的不完整片段（如 "key": 或 "key":"value）。
  s = s.replace(/,\s*"[^"]*"\s*:?\s*$/g, "");
  // 移除尾逗號（物件 / 陣列）。
  s = s.replace(/,\s*$/g, "");

  // 依堆疊補齊缺少的括號。
  while (stack.length > 0) {
    s = s.replace(/,\s*$/g, "");
    s += stack.pop();
  }
  // 最後再清一次物件 / 陣列內的尾逗號。
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

function coerceOutline(value: unknown): OutlineNode[] {
  const root = value as { outline?: unknown };
  const arr = Array.isArray(root.outline) ? root.outline : Array.isArray(value) ? value : [];
  const walk = (n: unknown): OutlineNode | null => {
    if (!n || typeof n !== "object") return null;
    const o = n as Record<string, unknown>;
    const level = o.level === 2 ? 2 : o.level === 3 ? 3 : 1;
    const text = typeof o.text === "string" ? o.text : "";
    if (!text) return null;
    const children = Array.isArray(o.children)
      ? o.children.map(walk).filter((x): x is OutlineNode => x !== null)
      : [];
    return { level: level as 1 | 2 | 3, text, keyPoint: o.keyPoint === true, children };
  };
  return (arr as unknown[]).map(walk).filter((x): x is OutlineNode => x !== null);
}

export async function generatePresentation(input: GenerateInput): Promise<Project> {
  const { creds, signal, onProgress } = input;
  const minCoverageThreshold = Math.max(50, Math.min(100, Math.round(input.minCoverageThreshold ?? 90)));

  // 建立 project（唯一真相）
  const project = createBlankProject(input.title ?? "AI 教學簡報");
  project.id = newId("proj");

  // 1. 處理圖片：先全數加入 project.assets，提供給 AI 選擇
  const availableImages: { id: string; name: string }[] = [];
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
      availableImages.push({ id: asset.id, name: asset.name });
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

  // 3. 在內容尾端附加圖片標籤清單，強化 AI 回填圖片的機率
  const contentForOutline = appendImageMarkers(content, availableImages);

  // 4. 規劃大綱
  onProgress?.("規劃大綱中…");
  const outlineRaw = await chat(
    creds,
    [
      { role: "system", content: OUTLINE_SYSTEM },
      {
        role: "user",
        content: userOutlinePrompt(contentForOutline, {
          pageStrategy: input.pageStrategy,
          emphasisKeywords: input.emphasisKeywords,
        }),
      },
    ],
    { temperature: 0.4, json: true, maxTokens: 16384, signal },
  );
  const outline = coerceOutline(extractJson(outlineRaw));

  // 5. 分段設計版面（Chunking 避免 LLM 10 頁截斷問題）
  onProgress?.("設計版面中…");
  const allSlides: LayoutIntent[] = [];
  const CHUNK_SIZE = 2;
  for (let i = 0; i < outline.length; i += CHUNK_SIZE) {
    const chunkOutline = outline.slice(i, i + CHUNK_SIZE);
    onProgress?.(`設計版面中… (進度 ${i + 1}/${outline.length})`);

    try {
      const intentRaw = await chat(
        creds,
        [
          { role: "system", content: intentSystem() },
          {
            role: "user",
            content: userIntentPrompt(JSON.stringify({ outline: chunkOutline }), availableImages, {
              deckStyle: input.deckStyle,
              pageStrategy: input.pageStrategy,
            }),
          },
        ],
        { temperature: 0.5, json: true, maxTokens: 16384, signal },
      );

      const parsed = deckIntentSchema.safeParse(extractJson(intentRaw));
      if (parsed.success) {
        allSlides.push(...parsed.data.slides);
      } else {
        console.warn(`批次 ${i} 版面解析失敗:`, parsed.error);
      }
    } catch (err) {
      console.warn(`批次 ${i} 生成失敗:`, err);
    }
  }

  if (allSlides.length === 0) {
    throw new Error("AI 產生的版面全數失敗或為空，請稍後再試。");
  }

  // 6. 大綱覆蓋率檢查：缺漏節點自動補頁
  onProgress?.("檢查大綱覆蓋率…");
  const coverage = ensureOutlineCoverage(outline, allSlides);
  let slidesWithCoverage = coverage.intents;
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
  const slides = translateDeck(slidesWithCoverage, { motionDefaults: DEFAULT_MOTION });

  project.source = {
    originalText: input.rawText,
    translatedText: content,
    outline,
    coverage: coverageReport,
    quality: quality.report,
  };
  project.deck.slides = slides.length > 0 ? slides : project.deck.slides;

  // 8. 鐵律：找出未被 AI 使用的圖片，強制附加到簡報後方
  const usedImageIds = new Set<string>();
  for (const slide of slidesWithCoverage) {
    for (const slot of slide.slots ?? []) {
      if (slot.imageAssetId) usedImageIds.add(slot.imageAssetId);
    }
  }
  const unusedImages = imageAssets.filter((a) => !usedImageIds.has(a.id));
  appendUnusedImageSlides(project, unusedImages);

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

function appendImageMarkers(content: string, images: { id: string; name: string }[]): string {
  if (!images.length) return content;
  const lines = images.map((img) => `- [Image: ${img.id}] ${img.name}`);
  return `${content}\n\n【原文附圖標籤（不得遺漏）】\n${lines.join("\n")}`;
}

/** 鐵律｜把未被 AI 妥善使用的圖片放入簡報，確保不遺漏。 */
function appendUnusedImageSlides(project: Project, unusedImages: AssetRef[]): void {
  if (unusedImages.length === 0) return;
  const extraSlides: Slide[] = [];

  for (const asset of unusedImages) {
    const slide = createBlankSlide("image-feature");
    const title = createTextElement(
      asset.name,
      { x: 120, y: 72, width: CANVAS_WIDTH - 240, height: 96 },
      { fontSize: 44, color: "var(--text)" },
    );
    title.autoSize = false;

    const maxW = CANVAS_WIDTH - 240;
    const maxH = CANVAS_HEIGHT - 320;
    const natW = asset.width ?? maxW;
    const natH = asset.height ?? maxH;
    const scale = Math.min(maxW / natW, maxH / natH, 1);
    const w = Math.round(natW * scale) || maxW;
    const h = Math.round(natH * scale) || maxH;

    const imageEl = createImageElement(asset.id, {
      x: Math.round((CANVAS_WIDTH - w) / 2),
      y: 200,
      width: w,
      height: h,
      zIndex: 1,
    });
    imageEl.fit = "contain";

    const caption = createTextElement(
      asset.name,
      { x: 120, y: CANVAS_HEIGHT - 96, width: CANVAS_WIDTH - 240, height: 56 },
      { fontSize: 26, color: "var(--text-mute)", align: "center" },
    );
    caption.autoSize = false;

    slide.elements = [title, imageEl, caption];
    extraSlides.push(slide);
  }

  project.deck.slides = [...project.deck.slides, ...extraSlides];
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

  const raw = await chat(
    creds,
    [{ role: "system", content: system }, { role: "user", content: prompt }],
    { temperature: 0.7, json: true },
  );
  const parsed = extractJson(raw) as any;
  if (!parsed || !parsed.tokens) throw new Error("AI 主題產生失敗");
  return parsed.tokens;
}
