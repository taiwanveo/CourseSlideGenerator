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

export interface TranslateContext {
  motionDefaults: MotionDefaults;
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
    lineHeight: heavy ? 1.08 : role === "bullets" ? 1.5 : 1.3,
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
    if (fill.contentType === "image") {
      return {
        id: newId("img"),
        type: "image",
        transform: baseTransform,
        animations: anim,
        assetId: fill.imageAssetId ?? "__placeholder__",
        fit: "cover",
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
    const el = buildElementFromFill(fill, slot, z, ctx.motionDefaults.enter);
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
    );
    if (el) elements.push(el);
  }

  applyEmphasis(elements, intent.emphasisPoints, ctx.motionDefaults.emphasis);

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
