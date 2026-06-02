/**
 * PNG 匯出 — 把已渲染的舞台 DOM 節點序列化為 SVG foreignObject，
 * 載入為圖片後繪到 canvas 取得點陣圖。無外部相依。
 */
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../model/types";

export async function nodeToPng(node: HTMLElement, scale = 1): Promise<Blob> {
  const clone = node.cloneNode(true) as HTMLElement;
  inlineStyles(node, clone);

  const xml = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
    <foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH * scale;
    canvas.height = CANVAS_HEIGHT * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("無法建立 canvas context");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob 失敗"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片載入失敗"));
    img.src = url;
  });
}

/** 把 computed style 內聯到 clone（foreignObject 需要內聯樣式才能正確顯示）。 */
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
