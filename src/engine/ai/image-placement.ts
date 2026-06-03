/**
 * 圖片分配：依段落位置嵌入簡報，過大圖片單獨成頁，確保不遺漏任何一張。
 */
import type { AssetRef } from "../../model/types";
import type { SlideBrief } from "./slide-briefs";

const INLINE_SLOT = 780;
const IMAGE_MARKER_RE = /\[Image:\s*([^\]]+)\]/g;

export function stripImageMarkers(text: string): string {
  return text
    .replace(IMAGE_MARKER_RE, "")
    .replace(/\[IMG:\d+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 將解析階段的 [IMG:n] 占位符替換為實際 asset id。 */
export function replaceImagePlaceholders(content: string, assets: AssetRef[]): string {
  return content.replace(/\[IMG:(\d+)\]/g, (_, n) => {
    const asset = assets[Number(n)];
    return asset ? `[Image: ${asset.id}]` : "";
  });
}

/** 正文尚未出現標記的圖片，依序附加在文末（保底不遺漏）。 */
export function appendMissingImageMarkers(content: string, assets: AssetRef[]): string {
  const missing = assets.filter((a) => !content.includes(`[Image: ${a.id}]`));
  if (missing.length === 0) return content;
  const lines = missing.map((img) => `[Image: ${img.id}] ${img.name}`);
  return `${content}\n\n【原文附圖】\n${lines.join("\n")}`;
}

/** 過大或比例極端的圖片不適合縮小塞在右側欄，改單獨成頁。 */
export function shouldUseDedicatedSlide(asset: AssetRef): boolean {
  const w = asset.width ?? 960;
  const h = asset.height ?? 720;
  if (w <= 0 || h <= 0) return false;

  const scale = Math.min(INLINE_SLOT / w, INLINE_SLOT / h);
  if (scale < 0.38) return true;
  if (w * h > 1_200_000) return true;

  const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
  if (ratio > 2.8 || ratio < 0.36) return true;

  return false;
}

function buildParagraphImagePlan(assets: AssetRef[], rawParagraphs: string[]): Map<number, string[]> {
  const plan = new Map<number, string[]>();
  const assigned = new Set<string>();
  const validIds = new Set(assets.map((a) => a.id));

  const add = (pIdx: number, id: string) => {
    if (!validIds.has(id) || assigned.has(id)) return;
    assigned.add(id);
    const list = plan.get(pIdx) ?? [];
    list.push(id);
    plan.set(pIdx, list);
  };

  rawParagraphs.forEach((para, pIdx) => {
    for (const m of para.matchAll(IMAGE_MARKER_RE)) {
      add(pIdx, m[1]!.trim());
    }
  });

  const paraCount = Math.max(1, rawParagraphs.length);
  let rr = 0;
  for (const asset of assets) {
    if (assigned.has(asset.id)) continue;
    add(rr % paraCount, asset.id);
    rr += 1;
  }

  return plan;
}

function makeImageBrief(assetId: string, title: string, asset?: AssetRef): SlideBrief {
  const w = asset?.width ?? 960;
  const h = asset?.height ?? 720;
  const presetHint = w * h > 2_000_000 ? "full-bleed-image" : "big-image-center";
  return {
    kind: "image",
    title: title || asset?.name || "附圖",
    keyPoints: [],
    presetHint,
    imageAssetId: assetId,
  };
}

function isFirstSectionForParagraph(briefs: SlideBrief[], index: number): boolean {
  const brief = briefs[index]!;
  if (brief.kind !== "section" || brief.paragraphIndex === undefined) return false;
  for (let i = 0; i < index; i++) {
    const b = briefs[i]!;
    if (b.kind === "section" && b.paragraphIndex === brief.paragraphIndex) return false;
  }
  return true;
}

function isLastSectionForParagraph(briefs: SlideBrief[], index: number): boolean {
  const brief = briefs[index]!;
  if (brief.kind !== "section" || brief.paragraphIndex === undefined) return false;
  for (let i = index + 1; i < briefs.length; i++) {
    const b = briefs[i]!;
    if (b.kind === "section" && b.paragraphIndex === brief.paragraphIndex) return false;
  }
  return true;
}

/**
 * 依段落位置分配所有圖片：
 * - 可縮小的首圖嵌入對應段落投影片（左文右圖）
 * - 其餘或過大圖片插入該段後的獨立附圖頁
 * - 仍無歸屬的圖片追加在簡報末尾
 */
export function insertAllImagesIntoBriefs(
  briefs: SlideBrief[],
  assets: AssetRef[],
  rawParagraphs: string[],
): SlideBrief[] {
  if (assets.length === 0) return briefs;

  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const plan = buildParagraphImagePlan(assets, rawParagraphs);
  const used = new Set<string>();
  const out: SlideBrief[] = [];

  for (let i = 0; i < briefs.length; i++) {
    const brief = { ...briefs[i]! };
    const paraIdx = brief.paragraphIndex;
    const imgIds = paraIdx !== undefined ? (plan.get(paraIdx) ?? []) : [];

    if (brief.kind === "section" && paraIdx !== undefined && isFirstSectionForParagraph(briefs, i)) {
      for (const id of imgIds) {
        if (used.has(id)) continue;
        const asset = assetMap.get(id);
        if (!asset || shouldUseDedicatedSlide(asset)) continue;
        brief.imageAssetId = id;
        used.add(id);
        break;
      }
    }

    out.push(brief);

    if (brief.kind === "section" && paraIdx !== undefined && isLastSectionForParagraph(briefs, i)) {
      for (const id of imgIds) {
        if (used.has(id)) continue;
        const asset = assetMap.get(id)!;
        used.add(id);
        out.push(makeImageBrief(id, brief.title, asset));
      }
    }
  }

  for (const asset of assets) {
    if (used.has(asset.id)) continue;
    used.add(asset.id);
    out.push(makeImageBrief(asset.id, asset.name, asset));
  }

  return out;
}
