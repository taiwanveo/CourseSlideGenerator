/**
 * 專案 JSON 匯入 — 解析、校驗、ID 重映射、取代 / 附加合併。
 */
import { projectSchema } from "../../model/schema";
import { newId } from "../../model/factory";
import type { Background, Element, Project, Slide } from "../../model/types";

export type ImportMode = "replace" | "append";

export function parseProjectJson(raw: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("JSON 格式不正確，請確認檔案內容。");
  }
  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("專案 JSON 結構不符合此版本格式，無法匯入。");
  }
  return parsed.data as Project;
}

/** 取代模式：忠實還原匯入專案，僅換新 project id 避免覆寫其他存檔。 */
export function projectForReplace(incoming: Project): Project {
  const p = structuredClone(incoming);
  p.id = newId("proj");
  p.meta.updatedAt = Date.now();
  return p;
}

/** 附加模式：把匯入專案併入目前專案（頁面接在後方、資產合併）。 */
export function mergeAppendProject(
  base: Project,
  incoming: Project,
): { project: Project; firstNewSlideId: string | null } {
  const out = structuredClone(base);
  const incomingRemapped = remapProjectIds(structuredClone(incoming));

  const existingAssetIds = new Set(out.assets.map((a) => a.id));
  for (const asset of incomingRemapped.assets) {
    if (!existingAssetIds.has(asset.id)) {
      out.assets.push(asset);
      existingAssetIds.add(asset.id);
    }
  }

  const appendStartIndex = out.deck.slides.length;
  out.deck.slides.push(...incomingRemapped.deck.slides);

  if (incomingRemapped.source.originalText.trim()) {
    const sep = out.source.originalText.trim() ? "\n\n---\n\n" : "";
    out.source.originalText += sep + incomingRemapped.source.originalText;
  }
  if (incomingRemapped.source.translatedText.trim()) {
    const sep = out.source.translatedText.trim() ? "\n\n---\n\n" : "";
    out.source.translatedText += sep + incomingRemapped.source.translatedText;
  }
  if (incomingRemapped.source.outline.length > 0) {
    out.source.outline = [...out.source.outline, ...incomingRemapped.source.outline];
  }

  out.meta.updatedAt = Date.now();
  const firstNewSlide = out.deck.slides[appendStartIndex];
  return { project: out, firstNewSlideId: firstNewSlide?.id ?? null };
}

export function remapProjectIds(project: Project): Project {
  const slideMap = new Map<string, string>();
  const assetMap = new Map<string, string>();

  for (const asset of project.assets) {
    assetMap.set(asset.id, newId("asset"));
  }
  for (const slide of project.deck.slides) {
    slideMap.set(slide.id, newId("slide"));
  }

  project.assets = project.assets.map((a) => ({
    ...a,
    id: assetMap.get(a.id) ?? newId("asset"),
  }));

  project.deck.slides = project.deck.slides.map((slide) => remapSlide(slide, slideMap, assetMap));
  return project;
}

function remapSlide(slide: Slide, slideMap: Map<string, string>, assetMap: Map<string, string>): Slide {
  slide.id = slideMap.get(slide.id) ?? newId("slide");
  slide.background = remapBackground(slide.background, assetMap);
  if (slide.audio?.assetId) {
    slide.audio = {
      ...slide.audio,
      assetId: assetMap.get(slide.audio.assetId) ?? slide.audio.assetId,
    };
  }
  slide.elements = slide.elements.map((el) => remapElement(el, slideMap, assetMap));
  return slide;
}

function remapBackground(bg: Background, assetMap: Map<string, string>): Background {
  if (bg.type === "image") {
    return { ...bg, assetId: assetMap.get(bg.assetId) ?? bg.assetId };
  }
  return bg;
}

function remapElement(el: Element, slideMap: Map<string, string>, assetMap: Map<string, string>): Element {
  const next = structuredClone(el);
  next.id = newId(next.type === "group" ? "group" : next.type);

  switch (next.type) {
    case "text":
      if (next.link?.kind === "slide") {
        next.link = {
          ...next.link,
          value: slideMap.get(next.link.value) ?? next.link.value,
        };
      }
      break;
    case "image":
      next.assetId = assetMap.get(next.assetId) ?? next.assetId;
      break;
    case "audio":
      next.assetId = assetMap.get(next.assetId) ?? next.assetId;
      break;
    case "group":
      next.children = next.children.map((c) => remapElement(c, slideMap, assetMap));
      break;
    default:
      break;
  }
  return next;
}
