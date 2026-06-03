/**
 * 文件解析 — 將 TXT / Markdown / HTML / DOCX / PDF / 網址 / 貼上文字 轉成純文字。
 * DOCX 使用 mammoth（瀏覽器版）；PDF 使用 pdfjs-dist；網址以平台 fetch 抓取後抽取內文。
 *
 * 【鐵律】原始素材若含圖片（網址 / PDF / Word / HTML），不得捨棄；一併抽取為 ParsedImage，
 * 後續由生成流程放入簡報。
 */
import { platformRequest } from "../llm/client";

export interface ParsedImage {
  /** data URL（base64），確保離線可用、不依賴外部連結 */
  dataUrl: string;
  name: string;
  width?: number;
  height?: number;
}

export interface ParsedDoc {
  text: string;
  sourceName: string;
  images: ParsedImage[];
}

const MAX_IMAGES = 40;
const BLOCK_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre", "table", "tr", "section", "article",
]);
const SKIP_TAGS = new Set(["script", "style", "noscript", "nav", "footer", "header", "aside", "iframe", "svg"]);

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("圖檔讀取失敗"));
    reader.readAsDataURL(blob);
  });
}

/** 將圖片來源（http / 相對路徑 / data URL）轉為 data URL；失敗回傳 null（不阻斷文字匯入）。 */
async function srcToDataUrl(src: string): Promise<string | null> {
  try {
    if (src.startsWith("data:")) return src.startsWith("data:image/") ? src : null;
    const res = await platformRequest(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (blob.size < 1024) return null; // 過濾追蹤像素 / 極小圖示
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** 從 HTML 依閱讀順序抽取內文，並在圖片位置插入 [IMG:n] 占位符。 */
async function extractTextAndImagesFromHtml(
  doc: Document,
  baseUrl?: string,
): Promise<{ text: string; images: ParsedImage[] }> {
  const images: ParsedImage[] = [];
  const seen = new Set<string>();

  async function walk(node: Node): Promise<string> {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").replace(/\s+/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return "";

    if (tag === "img") {
      let src = el.getAttribute("src") ?? el.getAttribute("data-src") ?? "";
      if (!src) return "";
      if (baseUrl && !/^(https?:|data:)/i.test(src)) {
        try {
          src = new URL(src, baseUrl).href;
        } catch {
          return "";
        }
      }
      const dataUrl = await srcToDataUrl(src);
      if (!dataUrl || seen.has(dataUrl)) return "";
      seen.add(dataUrl);
      const idx = images.length;
      images.push({
        dataUrl,
        name: el.getAttribute("alt")?.trim() || `圖片 ${idx + 1}`,
      });
      return `\n[IMG:${idx}]\n`;
    }

    if (tag === "br") return "\n";

    const parts = await Promise.all(Array.from(el.childNodes).map((child) => walk(child)));
    const inner = parts.join("");
    if (BLOCK_TAGS.has(tag)) {
      const trimmed = inner.trim();
      return trimmed ? `${trimmed}\n\n` : "";
    }
    return inner;
  }

  doc.querySelectorAll("script,style,noscript,nav,footer,header,aside,iframe,svg").forEach((n) => n.remove());
  const main = doc.querySelector("article, main, [role=main]") ?? doc.body;
  const text = (await walk(main)).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text, images };
}

/** 解析 HTML：同時抽取主要內文與圖片（圖片占位符嵌入正文）。 */
async function parseHtmlContent(
  html: string,
  baseUrl?: string,
): Promise<{ text: string; images: ParsedImage[] }> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return extractTextAndImagesFromHtml(doc, baseUrl);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#-]/g, "")
    .trim();
}

/** 從 Markdown 抽取圖片並在正文保留 [IMG:n] 占位符。 */
async function parseMarkdownContent(md: string): Promise<{ text: string; images: ParsedImage[] }> {
  const images: ParsedImage[] = [];
  const seen = new Set<string>();
  let out = md;
  const matches = [...md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/g)];

  for (const m of matches) {
    if (images.length >= MAX_IMAGES) break;
    const dataUrl = await srcToDataUrl(m[2]!);
    if (!dataUrl || seen.has(dataUrl)) continue;
    seen.add(dataUrl);
    const idx = images.length;
    images.push({ dataUrl, name: m[1]?.trim() || `圖片 ${idx + 1}` });
    const alt = m[1]?.trim();
    const replacement = alt ? `${alt}\n[IMG:${idx}]\n` : `[IMG:${idx}]\n`;
    out = out.replace(m[0], replacement);
  }

  return { text: stripMarkdown(out), images };
}

async function parsePdf(file: File): Promise<{ text: string; images: ParsedImage[] }> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  const images: ParsedImage[] = [];
  const seen = new Set<string>();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const pageMarkers: string[] = [];

    // 盡力抽取頁面內嵌圖片（失敗不影響文字）
    if (images.length < MAX_IMAGES) {
      try {
        const ops = await page.getOperatorList();
        const { OPS } = pdfjs;
        for (let j = 0; j < ops.fnArray.length; j++) {
          if (images.length >= MAX_IMAGES) break;
          const fn = ops.fnArray[j];
          if (fn === OPS.paintImageXObject) {
            const args = ops.argsArray[j] as unknown[];
            const objName = typeof args[0] === "string" ? (args[0] as string) : null;
            if (!objName) continue;
            const img = await pdfImageToDataUrl(page, objName);
            if (img && !seen.has(img.dataUrl)) {
              seen.add(img.dataUrl);
              const idx = images.length;
              img.name = `PDF 圖片 ${idx + 1}`;
              images.push(img);
              pageMarkers.push(`[IMG:${idx}]`);
            }
          }
        }
      } catch {
        /* 此頁圖片抽取失敗 — 略過 */
      }
    }

    let pagePart = text;
    if (pageMarkers.length > 0) {
      pagePart = pagePart ? `${pagePart}\n\n${pageMarkers.join("\n")}` : pageMarkers.join("\n");
    }
    if (pagePart) pages.push(pagePart);
  }
  return { text: pages.join("\n\n").trim(), images };
}

/** 把 pdfjs 影像物件轉成 data URL（支援 bitmap / RGBA / RGB / 灰階）。 */
async function pdfImageToDataUrl(
  page: { objs: { get(name: string, cb: (obj: unknown) => void): void } },
  name: string,
): Promise<ParsedImage | null> {
  const obj = await new Promise<unknown>((resolve) => {
    try {
      page.objs.get(name, resolve);
    } catch {
      resolve(null);
    }
  });
  if (!obj || typeof obj !== "object") return null;
  const o = obj as { width?: number; height?: number; data?: Uint8ClampedArray | Uint8Array; bitmap?: CanvasImageSource };
  const width = o.width ?? 0;
  const height = o.height ?? 0;
  if (width < 16 || height < 16) return null; // 過濾極小裝飾圖

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (o.bitmap) {
    ctx.drawImage(o.bitmap, 0, 0);
  } else if (o.data) {
    const data = o.data;
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (data.length === width * height * 4) {
      rgba.set(data);
    } else if (data.length === width * height * 3) {
      for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
        rgba[q] = data[p]!;
        rgba[q + 1] = data[p + 1]!;
        rgba[q + 2] = data[p + 2]!;
        rgba[q + 3] = 255;
      }
    } else if (data.length === width * height) {
      for (let p = 0, q = 0; p < data.length; p++, q += 4) {
        const v = data[p]!;
        rgba[q] = v;
        rgba[q + 1] = v;
        rgba[q + 2] = v;
        rgba[q + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else {
    return null;
  }

  try {
    return { dataUrl: canvas.toDataURL("image/png"), name: "PDF 圖片", width, height };
  } catch {
    return null;
  }
}

export async function parseFile(file: File): Promise<ParsedDoc> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const { text, images } = await parsePdf(file);
    return { text, sourceName: name, images };
  }

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const buffer = await file.arrayBuffer();
    let text = "";
    let images: ParsedImage[] = [];
    try {
      const convertToHtml = (mammoth as unknown as {
        convertToHtml(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
      }).convertToHtml;
      const htmlResult = await convertToHtml({ arrayBuffer: buffer });
      const doc = new DOMParser().parseFromString(htmlResult.value, "text/html");
      const extracted = await extractTextAndImagesFromHtml(doc);
      text = extracted.text;
      images = extracted.images;
    } catch {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = result.value.trim();
    }
    if (!text) {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = result.value.trim();
    }
    return { text, sourceName: name, images };
  }

  const raw = await file.text();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    const { text, images } = await parseHtmlContent(raw);
    return { text, sourceName: name, images };
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    const { text, images } = await parseMarkdownContent(raw);
    return { text, sourceName: name, images };
  }
  return { text: raw.trim(), sourceName: name, images: [] };
}

/** 從網址抓取網頁並抽取主要內文與圖片（桌面版繞過 CORS；瀏覽器開發可能受 CORS 限制）。 */
export async function parseUrl(url: string): Promise<ParsedDoc> {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let res: Response;
  try {
    res = await platformRequest(normalized, { headers: { Accept: "text/html,*/*" } });
  } catch (e) {
    throw new Error(
      `無法連線到這個網址。這通常是因為網站不允許直接擷取內容，或目前網路連線不穩定。你可以改用桌面模式、貼上文章內文，或上傳檔案匯入。系統訊息：${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  if (!res.ok) throw new Error(`抓取失敗：HTTP ${res.status}`);
  const html = await res.text();
  const { text, images } = await parseHtmlContent(html, normalized);
  if (text.length < 20) throw new Error("此網址未抽取到足夠內文");
  let host = normalized;
  try {
    host = new URL(normalized).hostname;
  } catch {
    /* keep */
  }
  return { text, sourceName: host, images };
}

export function parsePastedText(text: string): ParsedDoc {
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(text) && /<(p|div|h[1-6]|ul|ol|table)/i.test(text);
  return {
    text: looksHtml ? new DOMParser().parseFromString(text, "text/html").body.textContent?.trim() ?? text.trim() : text.trim(),
    sourceName: "貼上的文字",
    images: [],
  };
}

