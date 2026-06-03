/**
 * 翻譯器 — Layout Intent → 物件樹 Slide[]。
 * AI 負責語意；此處負責精準座標、主題字級、預設動效、安全降級。
 */
import { newId, plainText } from "../../model/factory";
import type {
  Element,
  ElementAnimation,
  ListElement,
  MotionDefaults,
  Slide,
  TextElement,
  TextStyle,
} from "../../model/types";
import { getMotionPreset } from "../motion/catalog";
import type { LayoutIntent, SlotFill } from "./intent";
import {
  fontSizeForRole,
  isHeavyRole,
  type LayoutPreset,
  type SlotDef,
  type SlotRole,
} from "./preset-types";
import { FALLBACK_PRESET_ID, getPreset } from "./presets";
import {
  estimateWrappedLines,
  fitAllTitleElementsToSingleLine,
  isTitleLikeText,
} from "./text-fit";

export interface TranslateContext {
  motionDefaults: MotionDefaults;
  /** 圖片資產尺寸，用於等比縮放至槽位內 */
  imageAssets?: Record<string, { width?: number; height?: number }>;
}

function enterAnim(preset: string, delay: number): ElementAnimation {
  const p = getMotionPreset(preset);
  return {
    kind: "enter",
    preset,
    delay,
    duration: p?.defaultDuration ?? 600,
    easing: p?.defaultEasing ?? "ease-out",
  };
}

function styleForRole(role: SlotRole, align: TextStyle["align"]): TextStyle {
  const fontSize = fontSizeForRole(role);
  const heavy = isHeavyRole(role);
  return {
    fontFamily: heavy || role === "quote" ? "var(--font-display)" : "var(--font-body)",
    fontSize,
    color: role === "label" ? "var(--accent)" : "var(--text)",
    align,
    lineHeight: heavy ? 1.22 : role === "bullets" ? 1.5 : 1.35,
    fontWeight: heavy ? 700 : role === "subtitle" ? 600 : 400,
    valign: role === "bignumber" || role === "quote" ? "middle" : "top",
  };
}

function findSlotDef(preset: LayoutPreset, name: string): SlotDef | undefined {
  return preset.slots.find((s) => s.name === name);
}

function buildElementFromFill(
  fill: SlotFill,
  slot: SlotDef,
  zIndex: number,
  enterPreset: string,
  imageAssets?: Record<string, { width?: number; height?: number }>,
): Element | null {
  const frame = slot.frame;
  const align = slot.align ?? "left";
  const baseTransform = {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    rotation: 0,
    zIndex,
    opacity: 1,
  };
  const anim = [enterAnim(enterPreset, zIndex * 80)];

  // 圖片
  if (slot.role === "image" || fill.contentType === "image") {
    if (fill.contentType === "image" && fill.imageAssetId) {
      const transform = layoutImageContain(frame, fill.imageAssetId, imageAssets);
      return {
        id: newId("img"),
        type: "image",
        transform: { ...transform, rotation: 0, zIndex, opacity: 1 },
        animations: anim,
        assetId: fill.imageAssetId,
        fit: "contain",
        cornerRadius: 16,
      };
    }
    // chart/table 暫以文字佔位（渲染器另有 chart/table 支援，AI 之後可填 config）
  }

  // 列表
  if (fill.contentType === "list" && fill.listItems && fill.listItems.length > 0) {
    const style = styleForRole(slot.role === "image" ? "bullets" : slot.role, align);
    const el: ListElement = {
      id: newId("list"),
      type: "list",
      transform: baseTransform,
      animations: anim,
      ordered: fill.ordered ?? false,
      items: fill.listItems.map((t) => plainText(t)),
      style: { ...style, itemGap: 20 },
    };
    return el;
  }

  // 文字（含 bignumber / quote / title / subtitle / caption / label）
  const text = fill.text ?? (fill.listItems ? fill.listItems.join("、") : "");
  if (!text) return null;
  const el: TextElement = {
    id: newId("text"),
    type: "text",
    transform: baseTransform,
    animations: anim,
    content: plainText(text),
    style: styleForRole(slot.role, align),
  };
  return el;
}

/** 把強調詞轉成粗體（在文字 span 內標記）+ emphasis 動效。 */
function applyEmphasis(elements: Element[], points: string[], emphasisPreset: string): void {
  if (points.length === 0) return;
  for (const el of elements) {
    if (el.type === "text") {
      for (const span of el.content.spans) {
        if (points.some((p) => span.text.includes(p))) {
          el.animations.push({
            kind: "emphasis",
            preset: emphasisPreset,
            delay: 800,
            duration: getMotionPreset(emphasisPreset)?.defaultDuration ?? 700,
            easing: "ease-in-out",
          });
        }
      }
    }
  }
}

export function translateIntentToSlide(
  intent: LayoutIntent,
  ctx: TranslateContext,
): Slide {
  const preset = getPreset(intent.presetId) ?? getPreset(FALLBACK_PRESET_ID)!;
  const elements: Element[] = [];
  let z = 1;

  for (const fill of intent.slots) {
    const slot = findSlotDef(preset, fill.slotName);
    if (!slot) continue;
    const el = buildElementFromFill(fill, slot, z, ctx.motionDefaults.enter, ctx.imageAssets);
    if (el) {
      elements.push(el);
      z += 1;
    }
  }

  // 若 AI 沒填 title 但 preset 有 title 槽，補上 slideTitle
  const hasTitle = intent.slots.some((s) => s.slotName === "title");
  const titleSlot = findSlotDef(preset, "title");
  if (!hasTitle && titleSlot && intent.slideTitle) {
    const el = buildElementFromFill(
      { slotName: "title", contentType: "text", text: intent.slideTitle },
      titleSlot,
      z,
      ctx.motionDefaults.enter,
      ctx.imageAssets,
    );
    if (el) elements.push(el);
  }

  applyEmphasis(elements, intent.emphasisPoints, ctx.motionDefaults.emphasis);

  fitAllTitleElementsToSingleLine(elements);
  fitTextElementHeights(elements);
  reflowVerticalStack(elements);

  const transition = getMotionPreset(ctx.motionDefaults.transition);
  return {
    id: newId("slide"),
    layoutPreset: preset.id,
    background: { type: "solid", color: "var(--shell)" },
    transition: {
      preset: ctx.motionDefaults.transition,
      duration: transition?.defaultDuration ?? 600,
      easing: transition?.defaultEasing ?? "ease-in-out",
    },
    elements,
    notes: intent.reason || undefined,
  };
}

export function translateDeck(
  intents: LayoutIntent[],
  ctx: TranslateContext,
): Slide[] {
  return intents.map((i) => translateIntentToSlide(i, ctx));
}

function fitTextElementHeights(elements: Element[]): void {
  for (const el of elements) {
    if (el.type === "text") {
      if (isTitleLikeText(el)) continue;
      const text = el.content.spans.map((s) => s.text).join("");
      const { fontSize, lineHeight } = el.style;
      let size = fontSize;
      let lines = estimateWrappedLines(text, el.transform.width, size);
      let needed = Math.ceil(lines * size * lineHeight + 6);
      while (needed > el.transform.height && size > 52) {
        size -= 4;
        el.style.fontSize = size;
        lines = estimateWrappedLines(text, el.transform.width, size);
        needed = Math.ceil(lines * size * lineHeight + 6);
      }
      if (needed > el.transform.height) {
        el.transform.height = needed;
      }
    } else if (el.type === "list") {
      const { fontSize, lineHeight, itemGap = 16 } = el.style;
      let total = 0;
      for (let i = 0; i < el.items.length; i++) {
        const itemText = el.items[i]!.spans.map((s) => s.text).join("");
        const lines = estimateWrappedLines(itemText, el.transform.width - 48, fontSize);
        total += lines * fontSize * lineHeight + (i < el.items.length - 1 ? itemGap : 0);
      }
      const needed = Math.ceil(total + 8);
      if (needed > el.transform.height) {
        el.transform.height = needed;
      }
    }
  }
}

/** 依原圖比例縮放至槽位內（contain），置中，不裁切。 */
function layoutImageContain(
  frame: { x: number; y: number; width: number; height: number },
  assetId: string,
  imageAssets?: Record<string, { width?: number; height?: number }>,
): { x: number; y: number; width: number; height: number } {
  const meta = imageAssets?.[assetId];
  if (!meta?.width || !meta?.height || meta.width <= 0 || meta.height <= 0) {
    return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
  }
  const scale = Math.min(frame.width / meta.width, frame.height / meta.height);
  const w = Math.max(1, Math.round(meta.width * scale));
  const h = Math.max(1, Math.round(meta.height * scale));
  return {
    x: frame.x + Math.round((frame.width - w) / 2),
    y: frame.y + Math.round((frame.height - h) / 2),
    width: w,
    height: h,
  };
}

/** 依 y 排序後，避免上方元件加高後與下方重疊。 */
function reflowVerticalStack(elements: Element[]): void {
  const sorted = [...elements].sort((a, b) => a.transform.y - b.transform.y);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const minY = prev.transform.y + prev.transform.height + 24;
    if (cur.transform.y < minY) {
      cur.transform.y = minY;
    }
  }
}
