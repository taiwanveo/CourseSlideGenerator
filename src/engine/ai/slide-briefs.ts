/**
 * 將三層大綱轉成明確的「每頁該有什麼內容」規格，並與 AI 版面意圖對齊。
 */
import type { AssetRef, OutlineNode } from "../../model/types";
import { FALLBACK_PRESET_ID, getPreset } from "../layout/presets";
import type { LayoutIntent } from "../layout/intent";

export interface SlideBrief {
  kind: "chapter" | "section" | "image";
  chapterTitle?: string;
  title: string;
  keyPoints: string[];
  presetHint: string;
  /** 從原文擷取、與本節相關的段落摘要 */
  sourceExcerpt?: string;
  imageAssetId?: string;
  /** 對應原文第幾段（逐段分析時使用） */
  paragraphIndex?: number;
  /** 本頁核心訊息（Stage 1） */
  mainMessage?: string;
  /** 講者備註（Stage 2） */
  speakerNote?: string;
}

const PUNCT_RE = /[\s，。、；：！？""''（）\[\]【】《》\-—·…,.;:!?'"()]/g;

function normalize(text: string): string {
  return text.replace(PUNCT_RE, "").toLowerCase();
}

/** 大綱 → 投影片規格：章節分隔頁 + 每節一頁（含重點條列）。 */
export function outlineToSlideBriefs(outline: OutlineNode[]): SlideBrief[] {
  const briefs: SlideBrief[] = [];
  for (const l1 of outline) {
    const chapter = l1.text.trim();
    if (!chapter) continue;

    if (l1.children.length === 0) {
      briefs.push({
        kind: "section",
        chapterTitle: chapter,
        title: chapter,
        keyPoints: [chapter],
        presetHint: "bullet-list",
      });
      continue;
    }

    briefs.push({
      kind: "chapter",
      title: chapter,
      keyPoints: [],
      presetHint: "section-divider",
    });

    for (const l2 of l1.children) {
      const section = l2.text.trim();
      if (!section) continue;
      const keyPoints =
        l2.children.length > 0
          ? l2.children.map((c) => c.text.trim()).filter(Boolean)
          : [section];
      briefs.push({
        kind: "section",
        chapterTitle: chapter,
        title: section,
        keyPoints,
        presetHint: "bullet-list",
      });
    }
  }
  return briefs;
}

/** 條列過多時拆成多頁，避免單頁內容過少或過擠。 */
export function splitLargeBriefs(briefs: SlideBrief[], maxBullets = 5): SlideBrief[] {
  const out: SlideBrief[] = [];
  for (const brief of briefs) {
    if (brief.kind === "chapter" || brief.kind === "image" || brief.keyPoints.length <= maxBullets) {
      out.push(brief);
      continue;
    }
    const parts = Math.ceil(brief.keyPoints.length / maxBullets);
    for (let p = 0; p < parts; p++) {
      const chunk = brief.keyPoints.slice(p * maxBullets, (p + 1) * maxBullets);
      out.push({
        ...brief,
        title: parts > 1 ? `${brief.title}（${p + 1}/${parts}）` : brief.title,
        keyPoints: chunk,
        imageAssetId: p === 0 ? brief.imageAssetId : undefined,
      });
    }
  }
  return out;
}

/** 從原文段落補充各節的 excerpt 與條列要點。 */
export function attachSourceExcerpts(briefs: SlideBrief[], source: string): void {
  const paras = source
    .split(/\n{2,}|\n(?=[•\-*]\s)|\n(?=\d+[.)]\s)/)
    .map((p) => p.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter((p) => p.length > 12 && !p.startsWith("【原文附圖"));

  for (const brief of briefs) {
    if (brief.kind !== "section") continue;

    const matched = paras.filter((p) => paragraphMatchesBrief(p, brief));
    if (matched.length === 0) continue;

    brief.sourceExcerpt = matched.slice(0, 2).join("\n\n");

    const sentences = matched
      .join(" ")
      .split(/[。！？.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);

    for (const sentence of sentences) {
      if (brief.keyPoints.length >= 8) break;
      const dup = brief.keyPoints.some(
        (kp) => normalize(kp).includes(normalize(sentence).slice(0, 12)) || normalize(sentence).includes(normalize(kp).slice(0, 12)),
      );
      if (!dup) brief.keyPoints.push(sentence);
    }
  }
}

function paragraphMatchesBrief(paragraph: string, brief: SlideBrief): boolean {
  const p = normalize(paragraph);
  if (p.includes(normalize(brief.title).slice(0, Math.min(8, brief.title.length)))) return true;
  return brief.keyPoints.some((kp) => {
    const k = normalize(kp);
    return k.length >= 4 && (p.includes(k.slice(0, Math.min(12, k.length))) || k.includes(p.slice(0, 12)));
  });
}

/** 將圖片依標籤、名稱與內文關聯分配到各節（剩餘圖片輪流嵌入，不堆在末尾）。 */
export function assignImagesToBriefs(
  briefs: SlideBrief[],
  assets: AssetRef[],
  sourceContent: string,
): Map<number, string> {
  const map = new Map<number, string>();
  const used = new Set<string>();
  const sectionIndices = briefs.map((b, i) => (b.kind === "section" ? i : -1)).filter((i) => i >= 0);

  for (const asset of assets) {
    const marker = `[Image: ${asset.id}]`;
    const markerPos = sourceContent.indexOf(marker);
    if (markerPos >= 0) {
      const idx = findBriefBySourcePosition(briefs, sourceContent, markerPos);
      if (idx >= 0 && !used.has(asset.id)) {
        map.set(idx, asset.id);
        used.add(asset.id);
        briefs[idx]!.imageAssetId = asset.id;
      }
    }
  }

  for (const asset of assets) {
    if (used.has(asset.id)) continue;
    let bestIdx = -1;
    let bestScore = 0;
    for (const i of sectionIndices) {
      const b = briefs[i]!;
      const corpus = `${b.title} ${b.keyPoints.join(" ")} ${b.sourceExcerpt ?? ""} ${b.chapterTitle ?? ""}`;
      const score = scoreOverlap(asset.name, corpus);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestScore >= 1) {
      map.set(bestIdx, asset.id);
      used.add(asset.id);
      briefs[bestIdx]!.imageAssetId = asset.id;
    }
  }

  let rr = 0;
  for (const asset of assets) {
    if (used.has(asset.id)) continue;
    const targets = sectionIndices.filter((i) => !map.has(i));
    const pool = targets.length > 0 ? targets : sectionIndices;
    if (pool.length === 0) continue;
    const idx = pool[rr % pool.length]!;
    map.set(idx, asset.id);
    used.add(asset.id);
    briefs[idx]!.imageAssetId = asset.id;
    rr += 1;
  }

  return map;
}

function findBriefBySourcePosition(briefs: SlideBrief[], source: string, pos: number): number {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < briefs.length; i++) {
    const b = briefs[i]!;
    if (b.kind !== "section" || !b.sourceExcerpt) continue;
    const p = source.indexOf(b.sourceExcerpt.slice(0, Math.min(40, b.sourceExcerpt.length)));
    if (p < 0) continue;
    const dist = Math.abs(p - pos);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) return bestIdx;
  return findBestBriefIndex(briefs, source.slice(Math.max(0, pos - 300), pos + 300), "");
}

function findBestBriefIndex(briefs: SlideBrief[], context: string, assetName: string): number {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < briefs.length; i++) {
    const b = briefs[i]!;
    if (b.kind !== "section") continue;
    const score = scoreOverlap(`${context} ${assetName}`, `${b.title} ${b.keyPoints.join(" ")}`);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function scoreOverlap(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  let score = 0;
  const tokens = nb.match(/[\u4e00-\u9fff]{2,}|[a-z0-9]{3,}/gi) ?? [];
  for (const t of tokens) {
    if (na.includes(t)) score += 1;
  }
  return score;
}

/** 以規格為準合併 AI 版面：保證每節有完整條列，並嵌入對應圖片。 */
export function reconcileIntentsWithBriefs(aiIntents: LayoutIntent[], briefs: SlideBrief[]): LayoutIntent[] {
  const result: LayoutIntent[] = [];
  const usedAi = new Set<number>();

  for (let i = 0; i < briefs.length; i++) {
    const spec = briefs[i]!;
    const aiMatch = findMatchingAiIntent(aiIntents, usedAi, spec);

    if (aiMatch) {
      usedAi.add(aiMatch.index);
      result.push(mergeSpecIntoIntent(aiMatch.intent, spec));
    } else {
      result.push(buildIntentFromBrief(spec));
    }
  }

  return result;
}

function findMatchingAiIntent(
  intents: LayoutIntent[],
  used: Set<number>,
  spec: SlideBrief,
): { intent: LayoutIntent; index: number } | null {
  const target = normalize(spec.title);
  let best: { intent: LayoutIntent; index: number; score: number } | null = null;

  for (let i = 0; i < intents.length; i++) {
    if (used.has(i)) continue;
    const intent = intents[i]!;
    const title = normalize(intent.slideTitle);
    let score = 0;
    if (title === target) score = 100;
    else if (title.includes(target) || target.includes(title)) score = 60;
    else if (spec.kind === "chapter" && intent.presetId === "section-divider") score = 40;

    if (score > 0 && (!best || score > best.score)) {
      best = { intent, index: i, score };
    }
  }

  return best ? { intent: best.intent, index: best.index } : null;
}

export function buildIntentFromBrief(spec: SlideBrief): LayoutIntent {
  if (spec.kind === "image" && spec.imageAssetId) {
    return {
      slideTitle: spec.title,
      presetId: spec.presetHint === "full-bleed-image" ? "full-bleed-image" : "big-image-center",
      reason: "spec-image",
      slots: [
        { slotName: "title", contentType: "text", text: spec.title },
        { slotName: "image", contentType: "image", imageAssetId: spec.imageAssetId },
      ],
      emphasisPoints: [],
    };
  }

  if (spec.kind === "chapter") {
    return {
      slideTitle: spec.title,
      presetId: "section-divider",
      reason: "spec-chapter",
      slots: [
        { slotName: "label", contentType: "text", text: spec.chapterTitle ?? "章節" },
        { slotName: "title", contentType: "text", text: spec.title },
      ],
      emphasisPoints: [],
    };
  }

  const presetId = spec.imageAssetId ? "text-left-image-right" : spec.presetHint;
  const slots: LayoutIntent["slots"] = [
    { slotName: "title", contentType: "text", text: spec.title },
    {
      slotName: "bullets",
      contentType: "list",
      listItems: spec.keyPoints.length > 0 ? spec.keyPoints : [spec.title],
      ordered: false,
    },
  ];

  if (spec.imageAssetId) {
    slots.push({ slotName: "image", contentType: "image", imageAssetId: spec.imageAssetId });
  }

  const noteParts = [spec.mainMessage, spec.speakerNote].filter(Boolean);
  return {
    slideTitle: spec.title,
    presetId,
    reason: noteParts.length > 0 ? noteParts.join("\n\n") : "spec-section",
    slots,
    emphasisPoints: spec.keyPoints.filter((_, idx) => idx < 3),
  };
}

function mergeSpecIntoIntent(intent: LayoutIntent, spec: SlideBrief): LayoutIntent {
  if (spec.kind === "chapter") {
    return buildIntentFromBrief(spec);
  }

  const presetId = spec.imageAssetId ? "text-left-image-right" : intent.presetId;
  const preset = getPreset(presetId) ?? getPreset(FALLBACK_PRESET_ID)!;
  const bulletSlotName = preset.slots.find((s) => s.role === "bullets")?.name ?? "bullets";
  const titleSlotName = preset.slots.find((s) => s.role === "title")?.name ?? "title";
  const imageSlotName = preset.slots.find((s) => s.role === "image")?.name ?? "image";

  const slots: LayoutIntent["slots"] = intent.slots.map((s) => ({ ...s }));

  let titleSlot = slots.find((s) => s.slotName === titleSlotName);
  if (!titleSlot) {
    titleSlot = { slotName: titleSlotName, contentType: "text", text: spec.title };
    slots.unshift(titleSlot);
  } else {
    titleSlot.text = spec.title;
  }

  const aiBullets = slots.find((s) => s.slotName === bulletSlotName)?.listItems ?? [];
  const merged = mergeBulletItems(spec.keyPoints, aiBullets, spec.sourceExcerpt);

  let bulletSlot = slots.find((s) => s.slotName === bulletSlotName);
  if (bulletSlot) {
    bulletSlot.contentType = "list";
    bulletSlot.listItems = [...merged];
    bulletSlot.ordered = bulletSlot.ordered ?? false;
  } else {
    slots.push({
      slotName: bulletSlotName,
      contentType: "list",
      listItems: merged,
      ordered: false,
    });
  }

  if (spec.imageAssetId) {
    let imageSlot = slots.find((s) => s.slotName === imageSlotName);
    if (imageSlot) {
      imageSlot.contentType = "image";
      imageSlot.imageAssetId = spec.imageAssetId;
    } else {
      slots.push({ slotName: imageSlotName, contentType: "image", imageAssetId: spec.imageAssetId });
    }
  }

  return {
    ...intent,
    slideTitle: spec.title,
    presetId,
    slots,
    reason: `${intent.reason ?? ""} | merged-spec`.trim(),
  };
}

function mergeBulletItems(specPoints: string[], aiPoints: string[], excerpt?: string): string[] {
  const out: string[] = [];
  const push = (item: string) => {
    const t = item.trim();
    if (!t || t.length < 2) return;
    const n = normalize(t);
    if (out.some((o) => normalize(o) === n)) return;
    if (out.some((o) => normalize(o).includes(n) && n.length < normalize(o).length)) return;
    const dupIdx = out.findIndex((o) => n.includes(normalize(o)) && normalize(o).length < n.length);
    if (dupIdx >= 0) out[dupIdx] = t;
    else out.push(t);
  };

  for (const p of specPoints) push(p);
  for (const p of aiPoints) push(p);

  if (excerpt) {
    for (const s of excerpt.split(/[。！？.!?]+/)) push(s);
  }

  return out.slice(0, 12);
}

/** 補齊 AI 漏填的槽位（尤其 bullets）。 */
export function enrichSlideIntents(slides: LayoutIntent[]): LayoutIntent[] {
  return slides.map(enrichSingleIntent);
}

function enrichSingleIntent(slide: LayoutIntent): LayoutIntent {
  const preset = getPreset(slide.presetId) ?? getPreset(FALLBACK_PRESET_ID)!;
  const slots = slide.slots.map((s) => ({ ...s, listItems: s.listItems ? [...s.listItems] : undefined }));
  const bulletDef = preset.slots.find((s) => s.role === "bullets");
  const titleDef = preset.slots.find((s) => s.role === "title");

  if (bulletDef) {
    const bulletSlot = slots.find((s) => s.slotName === bulletDef.name);
    const titleSlot = titleDef ? slots.find((s) => s.slotName === titleDef.name) : undefined;
    const titleText = (titleSlot?.text ?? slide.slideTitle).trim();

    if (!bulletSlot?.listItems?.length) {
      const { title, points } = splitTitleAndBody(titleText);
      if (titleSlot && title.length > 0 && title.length < titleText.length) {
        titleSlot.text = title;
      }
      const items = points.length > 0 ? points : titleText ? [titleText] : ["（待補充要點）"];
      if (bulletSlot) {
        bulletSlot.contentType = "list";
        bulletSlot.listItems = items;
        bulletSlot.ordered = bulletSlot.ordered ?? false;
      } else {
        slots.push({
          slotName: bulletDef.name,
          contentType: "list",
          listItems: items,
          ordered: false,
        });
      }
    }
  }

  return { ...slide, presetId: preset.id, slots };
}

function splitTitleAndBody(text: string): { title: string; points: string[] } {
  const trimmed = text.trim();
  if (!trimmed) return { title: "", points: [] };

  const lines = trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) {
    return { title: lines[0]!, points: lines.slice(1) };
  }

  const sentenceSplit = trimmed.match(/^(.+?[。！？.!?])\s*(.+)$/);
  if (sentenceSplit) {
    return { title: sentenceSplit[1]!.trim(), points: [sentenceSplit[2]!.trim()] };
  }

  return { title: trimmed, points: trimmed.length > 28 ? [trimmed] : [] };
}
