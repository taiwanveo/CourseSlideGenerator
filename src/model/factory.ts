/**
 * 物件樹工廠函式 — 建立預設物件、空白頁、空白專案。
 */
import { nanoid } from "nanoid";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type Element,
  type ImageElement,
  type ListElement,
  type MotionDefaults,
  type Project,
  type RichText,
  type ShapeElement,
  type Slide,
  type TextElement,
  type Transform,
  type TextStyle,
} from "./types";

export function newId(prefix = "el"): string {
  return `${prefix}_${nanoid(10)}`;
}

export function plainText(text: string): RichText {
  return { spans: [{ text }] };
}

export const DEFAULT_MOTION: MotionDefaults = {
  enter: "fade-up",
  exit: "fade-out",
  emphasis: "pulse",
  transition: "crossfade",
};

export function defaultTransform(partial: Partial<Transform> = {}): Transform {
  return {
    x: 200,
    y: 200,
    width: 600,
    height: 200,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    ...partial,
  };
}

const baseTextStyle: TextStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 48,
  color: "var(--text)",
  align: "left",
  lineHeight: 1.3,
  valign: "top",
};

export function createTextElement(
  text: string,
  transform: Partial<Transform> = {},
  style: Partial<TextStyle> = {},
): TextElement {
  return {
    id: newId("text"),
    type: "text",
    transform: defaultTransform({ width: 800, height: 140, ...transform }),
    animations: [],
    content: plainText(text),
    style: { ...baseTextStyle, ...style },
    autoSize: true,
  };
}

export function createListElement(
  items: string[],
  ordered: boolean,
  transform: Partial<Transform> = {},
  style: Partial<TextStyle> = {},
): ListElement {
  return {
    id: newId("list"),
    type: "list",
    transform: defaultTransform({ width: 820, height: 520, ...transform }),
    animations: [],
    ordered,
    items: items.map((t) => plainText(t)),
    style: { ...baseTextStyle, lineHeight: 1.6, itemGap: 18, ...style },
    autoSize: true,
  };
}

export function createImageElement(
  assetId: string,
  transform: Partial<Transform> = {},
): ImageElement {
  return {
    id: newId("img"),
    type: "image",
    transform: defaultTransform({ width: 780, height: 800, ...transform }),
    animations: [],
    assetId,
    fit: "cover",
    cornerRadius: 16,
  };
}

export function createShapeElement(
  shape: ShapeElement["shape"],
  transform: Partial<Transform> = {},
): ShapeElement {
  const isStrokeShape = shape === "line" || shape === "arrow";
  const sizeDefault: Partial<Transform> =
    shape === "line" || shape === "arrow"
      ? { width: 500, height: 120 }
      : { width: 400, height: 400 };
  return {
    id: newId("shape"),
    type: "shape",
    transform: defaultTransform({ ...sizeDefault, ...transform }),
    animations: [],
    shape,
    fill: isStrokeShape ? "transparent" : "var(--accent)",
    stroke: isStrokeShape ? { color: "var(--accent)", width: 8 } : undefined,
    cornerRadius: shape === "rect" ? 16 : 0,
  };
}

export function createBlankSlide(presetId = "blank"): Slide {
  return {
    id: newId("slide"),
    layoutPreset: presetId,
    background: { type: "solid", color: "var(--shell)" },
    transition: { preset: "crossfade", duration: 600, easing: "ease-in-out" },
    elements: [],
  };
}

export function createBlankProject(title = "未命名簡報"): Project {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: newId("proj"),
    meta: { title, language: "zh-TW", createdAt: now, updatedAt: now },
    source: { originalText: "", translatedText: "", outline: [] },
    theme: { id: "midnight-press" },
    defaults: { ...DEFAULT_MOTION },
    assets: [],
    deck: {
      canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      slides: [createBlankSlide()],
    },
  };
}

/** 收集（含巢狀 group）所有 element，扁平回傳。 */
export function flattenElements(elements: Element[]): Element[] {
  const out: Element[] = [];
  for (const el of elements) {
    out.push(el);
    if (el.type === "group") {
      out.push(...flattenElements(el.children));
    }
  }
  return out;
}

/** 在 element 樹中依 id 尋找。 */
export function findElement(elements: Element[], id: string): Element | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.type === "group") {
      const found = findElement(el.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
