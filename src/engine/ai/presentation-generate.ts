/**
 * Stage 2：簡報架構 → 投影片內容（presentation_generation）
 */
import { deckIntentSchema } from "../layout/intent";
import { requestJson } from "../llm/json";
import { PRESENTATION_GENERATION_SYSTEM, userPresentationGenerationPrompt } from "../llm/prompts";
import type { ProviderCredentials } from "../llm/types";
import type { LayoutIntent } from "../layout/intent";
import { getPreset, FALLBACK_PRESET_ID } from "../layout/presets";
import { presetIdForVisual } from "./visual-preset-map";
import type { PresentationStructure, SlideStructureItem } from "./presentation-structure-types";
import { enrichSlideIntents } from "./slide-briefs";

function normalizeIntentTitle(t: string): string {
  return t.replace(/[\s，。、；：！？""''（）\[\]【】《》\-—·…,.;:!?'"()]/g, "").toLowerCase();
}

/** 規則保底：由架構項目直接組裝 LayoutIntent。 */
export function buildIntentFromStructureItem(item: SlideStructureItem): LayoutIntent {
  const hasImage = Boolean(item.imageAssetIds?.[0]);
  const presetId = presetIdForVisual(item.suggestedVisual, hasImage);

  if (item.kind === "title") {
    return {
      slideTitle: item.title,
      presetId: "title-subtitle",
      reason: [item.mainMessage, item.speakerNote].filter(Boolean).join("\n\n"),
      slots: [
        { slotName: "title", contentType: "text", text: item.title },
        {
          slotName: "subtitle",
          contentType: "text",
          text: item.mainMessage || item.keyPoints[0] || "",
        },
      ],
      emphasisPoints: [],
    };
  }

  if (item.kind === "image" && item.imageAssetIds?.[0]) {
    return {
      slideTitle: item.title,
      presetId: "big-image-center",
      reason: item.speakerNote ?? item.mainMessage,
      slots: [
        { slotName: "title", contentType: "text", text: item.title },
        { slotName: "image", contentType: "image", imageAssetId: item.imageAssetIds[0] },
      ],
      emphasisPoints: [],
    };
  }

  const slots: LayoutIntent["slots"] = [
    { slotName: "title", contentType: "text", text: item.title },
    {
      slotName: "bullets",
      contentType: "list",
      listItems: item.keyPoints.length > 0 ? item.keyPoints : [item.mainMessage],
      ordered: item.suggestedVisual === "process",
    },
  ];

  if (hasImage) {
    slots.push({
      slotName: "image",
      contentType: "image",
      imageAssetId: item.imageAssetIds![0],
    });
  }

  return {
    slideTitle: item.title,
    presetId,
    reason: [item.mainMessage, item.speakerNote].filter(Boolean).join("\n\n"),
    slots,
    emphasisPoints: item.keyPoints.slice(0, 3),
  };
}

function mergeStructureIntoIntent(intent: LayoutIntent, item: SlideStructureItem): LayoutIntent {
  const base = buildIntentFromStructureItem(item);
  const preset = getPreset(intent.presetId) ?? getPreset(base.presetId) ?? getPreset(FALLBACK_PRESET_ID)!;
  const bulletSlotName = preset.slots.find((s) => s.role === "bullets")?.name ?? "bullets";
  const titleSlotName = preset.slots.find((s) => s.role === "title")?.name ?? "title";
  const imageSlotName = preset.slots.find((s) => s.role === "image")?.name ?? "image";

  const slots = intent.slots.map((s) => ({ ...s }));

  let titleSlot = slots.find((s) => s.slotName === titleSlotName);
  if (!titleSlot) {
    titleSlot = { slotName: titleSlotName, contentType: "text", text: item.title };
    slots.unshift(titleSlot);
  } else {
    titleSlot.text = item.title;
  }

  const mergedBullets = [...item.keyPoints];
  const aiBullets = slots.find((s) => s.slotName === bulletSlotName)?.listItems ?? [];
  for (const b of aiBullets) {
    if (!mergedBullets.some((m) => normalizeIntentTitle(m) === normalizeIntentTitle(b))) {
      mergedBullets.push(b);
    }
  }

  let bulletSlot = slots.find((s) => s.slotName === bulletSlotName);
  if (bulletSlot) {
    bulletSlot.contentType = "list";
    bulletSlot.listItems = mergedBullets.slice(0, 12);
    bulletSlot.ordered = bulletSlot.ordered ?? false;
  } else {
    slots.push({
      slotName: bulletSlotName,
      contentType: "list",
      listItems: mergedBullets,
      ordered: false,
    });
  }

  const imgId = item.imageAssetIds?.[0];
  if (imgId) {
    let imageSlot = slots.find((s) => s.slotName === imageSlotName);
    if (imageSlot) {
      imageSlot.contentType = "image";
      imageSlot.imageAssetId = imgId;
    } else {
      slots.push({ slotName: imageSlotName, contentType: "image", imageAssetId: imgId });
    }
  }

  const note = [item.mainMessage, item.speakerNote, intent.reason].filter(Boolean).join("\n\n");

  return {
    ...intent,
    slideTitle: item.title,
    presetId: imgId ? "text-left-image-right" : intent.presetId || base.presetId,
    slots,
    reason: note,
    emphasisPoints: item.keyPoints.slice(0, 3),
  };
}

export function reconcileIntentsWithStructure(
  aiIntents: LayoutIntent[],
  structure: PresentationStructure,
): LayoutIntent[] {
  const result: LayoutIntent[] = [];
  const used = new Set<number>();

  for (const item of structure.slides) {
    const target = normalizeIntentTitle(item.title);
    let best: { intent: LayoutIntent; index: number; score: number } | null = null;

    for (let i = 0; i < aiIntents.length; i++) {
      if (used.has(i)) continue;
      const intent = aiIntents[i]!;
      const title = normalizeIntentTitle(intent.slideTitle);
      let score = 0;
      if (title === target) score = 100;
      else if (title.includes(target) || target.includes(title)) score = 60;
      if (score > 0 && (!best || score > best.score)) {
        best = { intent, index: i, score };
      }
    }

    if (best && best.score >= 60) {
      used.add(best.index);
      result.push(mergeStructureIntoIntent(best.intent, item));
    } else {
      result.push(buildIntentFromStructureItem(item));
    }
  }

  return result;
}

export async function generateSlidesFromStructure(
  structure: PresentationStructure,
  creds: ProviderCredentials,
  opts: {
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
    deckStyle?: "teaching" | "business" | "academic" | "casual";
    pageStrategy?: "compact" | "balanced" | "full";
    availableImages?: { id: string; name: string }[];
  },
): Promise<LayoutIntent[]> {
  const slides = structure.slides;
  if (slides.length === 0) return [];

  const allIntents: LayoutIntent[] = [];
  const CHUNK = 3;

  for (let i = 0; i < slides.length; i += CHUNK) {
    const chunk = slides.slice(i, i + CHUNK);
    opts.onProgress?.(`產生投影片內容…（${Math.min(i + 1, slides.length)}/${slides.length}）`);

    try {
      const raw = await requestJson(
        creds,
        [
          { role: "system", content: PRESENTATION_GENERATION_SYSTEM },
          {
            role: "user",
            content: userPresentationGenerationPrompt(structure, chunk, opts.availableImages, {
              deckStyle: opts.deckStyle,
              pageStrategy: opts.pageStrategy,
            }),
          },
        ],
        { temperature: 0.45, maxTokens: 16384, signal: opts.signal },
        "投影片內容",
      );

      const normalized =
        Array.isArray(raw) ? { slides: raw } : raw;
      const parsed = deckIntentSchema.safeParse(normalized);
      if (parsed.success) {
        allIntents.push(...parsed.data.slides);
      } else {
        for (const item of chunk) {
          allIntents.push(buildIntentFromStructureItem(item));
        }
      }
    } catch (err) {
      console.warn(`投影片內容批次 ${i} 失敗:`, err);
      for (const item of chunk) {
        allIntents.push(buildIntentFromStructureItem(item));
      }
    }
  }

  let merged = reconcileIntentsWithStructure(enrichSlideIntents(allIntents), structure);

  if (merged.length < slides.length) {
    const extras = slides.slice(merged.length).map(buildIntentFromStructureItem);
    merged = [...merged, ...extras];
  }

  return merged;
}
