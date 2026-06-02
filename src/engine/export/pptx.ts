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
import { buildAssetMap, resolveAssetSrc } from "../../renderer/assets";

const EMU_W = 13.333;
const EMU_H = 7.5;
const SX = EMU_W / CANVAS_WIDTH;
const SY = EMU_H / CANVAS_HEIGHT;

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
    x: el.transform.x * SX,
    y: el.transform.y * SY,
    w: el.transform.width * SX,
    h: el.transform.height * SY,
    fontSize: Math.round(el.style.fontSize * 0.5),
    color: resolveColor(el.style.color, vars),
    align: el.style.align,
    bold: (el.style.fontWeight ?? 400) >= 600,
    valign: el.style.valign === "middle" ? "middle" : el.style.valign === "bottom" ? "bottom" : "top",
    rotate: el.transform.rotation || undefined,
  });
}

function addList(pSlide: PptxGenJS.Slide, el: ListElement, vars: Record<string, string>) {
  const items = el.items.map((it) => ({
    text: it.spans.map((s) => s.text).join(""),
    options: { bullet: el.ordered ? { type: "number" as const } : true, breakLine: true },
  }));
  pSlide.addText(items, {
    x: el.transform.x * SX,
    y: el.transform.y * SY,
    w: el.transform.width * SX,
    h: el.transform.height * SY,
    fontSize: Math.round(el.style.fontSize * 0.5),
    color: resolveColor(el.style.color, vars),
    align: el.style.align,
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

function addElement(
  pSlide: PptxGenJS.Slide,
  el: Element,
  vars: Record<string, string>,
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
      const src = assetSrc(el.assetId);
      if (src) {
        const pos = {
          x: el.transform.x * SX,
          y: el.transform.y * SY,
          w: el.transform.width * SX,
          h: el.transform.height * SY,
        };
        pSlide.addImage(
          src.startsWith("data:") ? { data: src, ...pos } : { path: src, ...pos },
        );
      }
      break;
    }
    case "group":
      el.children.forEach((c) => addElement(pSlide, c, vars, assetSrc));
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
      .forEach((el) => addElement(pSlide, el, vars, (id) => resolveAssetSrc(id, assets)));
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
