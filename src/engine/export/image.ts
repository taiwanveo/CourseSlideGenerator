/**
 * PNG 匯出 — 以 html-to-image 將舞台 DOM 轉成點陣圖。
 * 匯出前會把所有圖片 / 背景圖轉為 data URL，避免 tainted canvas（污染畫布）。
 */
import { toBlob } from "html-to-image";
import type { AssetRef } from "../../model/types";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../model/types";

const URL_PROPS = [
  "backgroundImage",
  "background",
  "maskImage",
  "webkitMaskImage",
  "borderImageSource",
  "listStyleImage",
] as const;

/** 將資產 src 統一轉成 data URL，供離螢幕匯出舞台使用。 */
export async function assetsToDataUrls(assets: AssetRef[]): Promise<AssetRef[]> {
  const out: AssetRef[] = [];
  for (const asset of assets) {
    if (!asset.src || asset.src.startsWith("data:")) {
      out.push(asset);
      continue;
    }
    try {
      out.push({ ...asset, src: await toDataUrl(asset.src) });
    } catch {
      out.push(asset);
    }
  }
  return out;
}

export async function nodeToPng(node: HTMLElement, scale = 1): Promise<Blob> {
  const stageRoot = (node.firstElementChild as HTMLElement | null) ?? node;

  const mount = document.createElement("div");
  mount.style.cssText = [
    "position:fixed",
    "left:-20000px",
    "top:0",
    `width:${CANVAS_WIDTH}px`,
    `height:${CANVAS_HEIGHT}px`,
    "overflow:hidden",
    "pointer-events:none",
    "opacity:1",
  ].join(";");

  const clone = stageRoot.cloneNode(true) as HTMLElement;
  mount.appendChild(clone);
  document.body.appendChild(mount);

  try {
    await sanitizeExportTree(stageRoot, clone);

    const blob = await toBlob(clone, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      canvasWidth: CANVAS_WIDTH * scale,
      canvasHeight: CANVAS_HEIGHT * scale,
      pixelRatio: scale,
      cacheBust: true,
      fetchRequestInit: { mode: "cors", credentials: "omit" },
    });

    if (!blob) {
      throw new Error("PNG 匯出失敗：無法產生圖片檔。");
    }
    return blob;
  } catch (err) {
    if (err instanceof Error && /tainted|security/i.test(err.message)) {
      throw new Error(
        "PNG 匯出失敗：簡報含有無法匯出的外部圖片。請改用「上傳圖片」或 AI 生圖（會存成本機 data URL），再重新匯出。",
      );
    }
    throw err;
  } finally {
    mount.remove();
  }
}

/** 內聯樣式並將所有 url() 轉為 data URL（或移除）。 */
async function sanitizeExportTree(source: HTMLElement, target: HTMLElement): Promise<void> {
  inlineStyles(source, target);

  const sEls = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const tEls = [target, ...Array.from(target.querySelectorAll<HTMLElement>("*"))];

  for (let i = 0; i < tEls.length; i++) {
    const t = tEls[i]!;
    const s = sEls[i];

    for (const prop of URL_PROPS) {
      const raw = t.style[prop as keyof CSSStyleDeclaration] as string | undefined;
      if (raw && raw !== "none" && raw.includes("url(")) {
        (t.style as unknown as Record<string, string>)[prop] = await rewriteCssUrls(raw);
      }
    }

    if (t instanceof HTMLImageElement) {
      await sanitizeImgElement(t, s instanceof HTMLImageElement ? s : undefined);
    }
  }
}

function inlineStyles(source: HTMLElement, target: HTMLElement): void {
  const sEls = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const tEls = [target, ...Array.from(target.querySelectorAll<HTMLElement>("*"))];
  for (let i = 0; i < sEls.length; i++) {
    const cs = window.getComputedStyle(sEls[i]!);
    const decl = tEls[i]!.style;
    for (const prop of cs) {
      decl.setProperty(prop, cs.getPropertyValue(prop));
    }
  }
}

async function sanitizeImgElement(img: HTMLImageElement, source?: HTMLImageElement): Promise<void> {
  const src = img.getAttribute("src")?.trim() ?? "";
  if (!src) return;
  if (src.startsWith("data:")) {
    img.removeAttribute("crossorigin");
    return;
  }

  try {
    img.setAttribute("src", await toDataUrl(src));
    img.removeAttribute("crossorigin");
    return;
  } catch {
    // 嘗試從已載入的來源圖繪到離屏 canvas（同源 blob / 已解碼圖片）
    if (source?.complete && source.naturalWidth > 0) {
      try {
        img.setAttribute("src", drawElementToDataUrl(source));
        img.removeAttribute("crossorigin");
        return;
      } catch {
        // fall through
      }
    }
  }

  img.setAttribute("src", PLACEHOLDER_DATA_URL);
  img.removeAttribute("crossorigin");
}

function drawElementToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

async function rewriteCssUrls(value: string): Promise<string> {
  const re = /url\((['"]?)([^'")]+)\1\)/g;
  let out = value;
  const matches = [...value.matchAll(re)];
  for (const m of matches) {
    const url = m[2]!.trim();
    if (url.startsWith("data:")) continue;
    try {
      const data = await toDataUrl(url);
      out = out.replace(m[0], `url("${data}")`);
    } catch {
      out = out.replace(m[0], "none");
    }
  }
  return out;
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;

  if (src.startsWith("blob:")) {
    const res = await fetch(src);
    if (!res.ok) throw new Error("blob fetch failed");
    return await blobToDataUrl(await res.blob());
  }

  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await blobToDataUrl(await res.blob());
  } catch {
    return await loadViaImageElement(src);
  }
}

function loadViaImageElement(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        resolve(drawElementToDataUrl(img));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("FileReader 失敗"));
    reader.readAsDataURL(blob);
  });
}

const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='36'%3E%3Crect width='100%25' height='100%25' fill='%232a2a33'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='10' fill='%23bbbbc7'%3EImage%3C/text%3E%3C/svg%3E";
