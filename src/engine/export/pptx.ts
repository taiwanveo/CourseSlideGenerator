/**
 * PPTX 匯出 — 以 pptxgenjs 把物件樹映射為簡報。
 * design-px(1920×1080) → 英吋(13.333×7.5)。CSS 變數色彩以主題 token 解析為實際色。
 */
import PptxGenJS from "pptxgenjs";
import { getTheme } from "../themes/themes";
import type {
  Element,
  ListElement,
  Project,
  ShapeElement,
  Slide,
  TextElement,
} from "../../model/types";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../model/types";
import type { AssetMap } from "../../renderer/assets";
import { buildAssetMap, resolveAssetSrc } from "../../renderer/assets";

const EMU_W = 13.333;
const EMU_H = 7.5;
const SX = EMU_W / CANVAS_WIDTH;
const SY = EMU_H / CANVAS_HEIGHT;
/** design-px 字級 → PowerPoint 點（pt） */
const DESIGN_PX_TO_PT = SX * 72;

function toInX(px: number): number {
  return px * SX;
}

function toInY(px: number): number {
  return px * SY;
}

function toFontPt(designPx: number): number {
  return Math.max(6, Math.round(designPx * DESIGN_PX_TO_PT));
}

/** 對應編輯器繁中字型，避免 PPT 預設字型過寬導致提早換行。 */
function mapFontFace(fontFamily: string): string {
  const f = fontFamily.toLowerCase();
  if (f.includes("serif") || f.includes("noto serif")) return "Noto Serif TC";
  if (f.includes("mono")) return "Consolas";
  return "Microsoft JhengHei";
}

function baseTextBoxOptions(
  el: TextElement | ListElement,
  vars: Record<string, string>,
  textForWrapCheck: string,
): PptxGenJS.TextPropsOptions {
  return {
    x: toInX(el.transform.x),
    y: toInY(el.transform.y),
    w: toInX(el.transform.width),
    h: toInY(el.transform.height),
    fontSize: toFontPt(el.style.fontSize),
    fontFace: mapFontFace(el.style.fontFamily),
    color: resolveColor(el.style.color, vars),
    align: el.style.align,
    margin: 0,
    fit: "none",
    wrap: textForWrapCheck.includes("\n"),
    lineSpacing: Math.max(6, Math.round(el.style.fontSize * el.style.lineHeight * DESIGN_PX_TO_PT)),
    rotate: el.transform.rotation || undefined,
  };
}

function resolveColor(value: string, vars: Record<string, string>): string {
  let v = value.trim();
  const m = v.match(/var\((--[a-z0-9-]+)(?:\s*,\s*([^)]+))?\)/i);
  if (m) v = vars[m[1]!] ?? m[2]?.trim() ?? "#ffffff";
  if (v.startsWith("#")) return v.replace("#", "").slice(0, 6).padEnd(6, "0");
  const rgb = v.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1]!.split(",").map((n) => parseFloat(n));
    const hex = parts
      .slice(0, 3)
      .map((n) => Math.round(n).toString(16).padStart(2, "0"))
      .join("");
    return hex;
  }
  return "ffffff";
}

function themeVars(themeId: string): Record<string, string> {
  const t = getTheme(themeId).tokens;
  return {
    "--shell": t.shell,
    "--surface": t.surface,
    "--surface-2": t.surface2,
    "--text": t.text,
    "--text-mute": t.textMute,
    "--accent": t.accent,
    "--accent-soft": t.accentSoft,
    "--rule": t.rule,
  };
}

function addText(pSlide: PptxGenJS.Slide, el: TextElement, vars: Record<string, string>) {
  const text = el.content.spans.map((s) => s.text).join("");
  pSlide.addText(text, {
    ...baseTextBoxOptions(el, vars, text),
    bold: (el.style.fontWeight ?? 400) >= 600,
    valign: el.style.valign === "middle" ? "middle" : el.style.valign === "bottom" ? "bottom" : "top",
  });
}

function addList(pSlide: PptxGenJS.Slide, el: ListElement, vars: Record<string, string>) {
  const items = el.items.map((it) => ({
    text: it.spans.map((s) => s.text).join(""),
    options: { bullet: el.ordered ? { type: "number" as const } : true, breakLine: true },
  }));
  const joined = items.map((it) => it.text).join("\n");
  pSlide.addText(items, {
    ...baseTextBoxOptions(el, vars, joined),
    valign: "top",
  });
}

function addShape(pSlide: PptxGenJS.Slide, el: ShapeElement, vars: Record<string, string>) {
  const type =
    el.shape === "ellipse"
      ? "ellipse"
      : el.shape === "triangle"
        ? "triangle"
        : el.shape === "line"
          ? "line"
          : "rect";
  pSlide.addShape(type as PptxGenJS.ShapeType, {
    x: el.transform.x * SX,
    y: el.transform.y * SY,
    w: el.transform.width * SX,
    h: el.transform.height * SY,
    fill: el.fill ? { color: resolveColor(el.fill, vars) } : undefined,
    line: el.stroke ? { color: resolveColor(el.stroke.color, vars), width: el.stroke.width } : undefined,
    rotate: el.transform.rotation || undefined,
  });
}

function addImage(
  pSlide: PptxGenJS.Slide,
  el: Extract<Element, { type: "image" }>,
  assetSrc: (id: string) => string | null,
) {
  const src = assetSrc(el.assetId);
  if (!src) return;

  const box = {
    x: toInX(el.transform.x),
    y: toInY(el.transform.y),
    w: toInX(el.transform.width),
    h: toInY(el.transform.height),
  };

  const opts: PptxGenJS.ImageProps = src.startsWith("data:")
    ? { data: src, ...box }
    : { path: src, ...box };

  if (el.fit === "contain" || el.fit === "cover") {
    opts.sizing = { type: el.fit, w: box.w, h: box.h };
  }

  pSlide.addImage(opts);
}

function addElement(
  pSlide: PptxGenJS.Slide,
  el: Element,
  vars: Record<string, string>,
  assets: AssetMap,
  assetSrc: (id: string) => string | null,
) {
  switch (el.type) {
    case "text":
      addText(pSlide, el, vars);
      break;
    case "list":
      addList(pSlide, el, vars);
      break;
    case "shape":
      addShape(pSlide, el, vars);
      break;
    case "image": {
      addImage(pSlide, el, assetSrc);
      break;
    }
    case "group":
      el.children.forEach((c) => addElement(pSlide, c, vars, assets, assetSrc));
      break;
    default:
      break;
  }
}

export async function exportPptx(project: Project): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "CSG16x9", width: EMU_W, height: EMU_H });
  pptx.layout = "CSG16x9";
  const assets = buildAssetMap(project.assets);

  for (const slide of project.deck.slides) {
    const pSlide = pptx.addSlide();
    const vars = themeVars(slide.themeId ?? project.theme.id);
    applyBackground(pSlide, slide, vars);
    slide.elements
      .slice()
      .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
      .forEach((el) => addElement(pSlide, el, vars, assets, (id) => resolveAssetSrc(id, assets)));
  }

  const out = (await pptx.write({ outputType: "blob" })) as unknown as Blob;
  return out;
}

function applyBackground(pSlide: PptxGenJS.Slide, slide: Slide, vars: Record<string, string>) {
  const bg = slide.background;
  if (bg.type === "solid") pSlide.background = { color: resolveColor(bg.color, vars) };
  else if (bg.type === "gradient") pSlide.background = { color: resolveColor(bg.from, vars) };
  else pSlide.background = { color: resolveColor("var(--shell)", vars) };
}
