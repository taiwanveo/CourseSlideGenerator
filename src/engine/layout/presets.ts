/**
 * Preset 目錄 — ≥22 種具名版型。座標基於 1920×1080，邊距約 120px。
 * 對應 docs/04 §4.2。
 */
import type { LayoutPreset } from "./preset-types";

const M = 120; // 邊距
const W = 1920;
const H = 1080;
const contentW = W - M * 2; // 1680

export const PRESETS: LayoutPreset[] = [
  /* ── 標題型 ── */
  {
    id: "title-only-center",
    nameZh: "單行大字置中",
    category: "title",
    hintZh: "只有一句核心標題、想製造震撼或章節開場時用",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 430, width: contentW, height: 220 },
      },
    ],
  },
  {
    id: "title-subtitle",
    nameZh: "主標加副標",
    category: "title",
    hintZh: "一個主題加上一行補充說明",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 380, width: contentW, height: 200 },
      },
      {
        name: "subtitle",
        role: "subtitle",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: M, y: 600, width: contentW, height: 100 },
      },
    ],
  },
  {
    id: "section-divider",
    nameZh: "章節分隔頁",
    category: "title",
    hintZh: "進入新主題的過場頁，編號加標題",
    slots: [
      {
        name: "label",
        role: "label",
        accepts: ["text"],
        required: false,
        align: "left",
        frame: { x: M, y: 360, width: 600, height: 80 },
      },
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 450, width: contentW, height: 220 },
      },
    ],
  },

  /* ── 大圖型 ── */
  {
    id: "big-image-center",
    nameZh: "置中標題加大圖",
    category: "bigImage",
    hintZh: "一張示意圖搭配上方標題",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 90, width: contentW, height: 220 },
      },
      {
        name: "image",
        role: "image",
        accepts: ["image", "chart"],
        required: true,
        frame: { x: 360, y: 280, width: 1200, height: 700 },
      },
    ],
  },
  {
    id: "full-bleed-image",
    nameZh: "滿版圖疊字",
    category: "bigImage",
    hintZh: "情境照片鋪滿，標題疊在上面",
    slots: [
      {
        name: "image",
        role: "image",
        accepts: ["image"],
        required: true,
        frame: { x: 0, y: 0, width: W, height: H },
      },
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 720, width: 1200, height: 220 },
      },
    ],
  },
  {
    id: "image-quote",
    nameZh: "大圖加引言",
    category: "bigImage",
    hintZh: "一張圖配一句話",
    slots: [
      {
        name: "image",
        role: "image",
        accepts: ["image"],
        required: true,
        frame: { x: 0, y: 0, width: 960, height: H },
      },
      {
        name: "quote",
        role: "quote",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: 1040, y: 360, width: 760, height: 360 },
      },
    ],
  },

  /* ── 圖文左右 ── */
  {
    id: "text-left-image-right",
    nameZh: "左文右圖",
    category: "textImage",
    hintZh: "說明文字在左、示意圖在右",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 150, width: 820, height: 150 },
      },
      {
        name: "bullets",
        role: "bullets",
        accepts: ["list", "text"],
        required: true,
        align: "left",
        frame: { x: M, y: 340, width: 820, height: 560 },
      },
      {
        name: "image",
        role: "image",
        accepts: ["image", "chart"],
        required: true,
        frame: { x: 1020, y: 150, width: 780, height: 780 },
      },
    ],
  },
  {
    id: "image-left-text-right",
    nameZh: "左圖右文",
    category: "textImage",
    hintZh: "示意圖在左、說明文字在右",
    slots: [
      {
        name: "image",
        role: "image",
        accepts: ["image", "chart"],
        required: true,
        frame: { x: M, y: 150, width: 780, height: 780 },
      },
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: 1020, y: 150, width: 800, height: 150 },
      },
      {
        name: "bullets",
        role: "bullets",
        accepts: ["list", "text"],
        required: true,
        align: "left",
        frame: { x: 1020, y: 340, width: 800, height: 560 },
      },
    ],
  },

  /* ── 條列型 ── */
  {
    id: "bullet-list",
    nameZh: "無序條列",
    category: "list",
    hintZh: "並列的數個要點",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 130, width: contentW, height: 220 },
      },
      {
        name: "bullets",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: M, y: 330, width: contentW, height: 620 },
      },
    ],
  },
  {
    id: "numbered-steps",
    nameZh: "有序步驟",
    category: "list",
    hintZh: "有先後順序的步驟流程",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 130, width: contentW, height: 220 },
      },
      {
        name: "bullets",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: M, y: 330, width: contentW, height: 620 },
      },
    ],
  },
  {
    id: "two-column-bullets",
    nameZh: "雙欄條列",
    category: "list",
    hintZh: "要點較多時分兩欄呈現",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 130, width: contentW, height: 220 },
      },
      {
        name: "left",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: M, y: 330, width: 800, height: 620 },
      },
      {
        name: "right",
        role: "bullets",
        accepts: ["list"],
        required: false,
        align: "left",
        frame: { x: 980, y: 330, width: 800, height: 620 },
      },
    ],
  },

  /* ── 對比型 ── */
  {
    id: "compare-2col",
    nameZh: "兩欄對比",
    category: "compare",
    hintZh: "兩個概念並排比較",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: M, y: 110, width: contentW, height: 130 },
      },
      {
        name: "leftTitle",
        role: "subtitle",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 300, width: 800, height: 90 },
      },
      {
        name: "left",
        role: "bullets",
        accepts: ["list", "text"],
        required: true,
        align: "left",
        frame: { x: M, y: 410, width: 800, height: 540 },
      },
      {
        name: "rightTitle",
        role: "subtitle",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: 980, y: 300, width: 800, height: 90 },
      },
      {
        name: "right",
        role: "bullets",
        accepts: ["list", "text"],
        required: true,
        align: "left",
        frame: { x: 980, y: 410, width: 800, height: 540 },
      },
    ],
  },
  {
    id: "before-after",
    nameZh: "前後對照",
    category: "compare",
    hintZh: "改變前 vs 改變後",
    slots: [
      {
        name: "leftTitle",
        role: "subtitle",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 200, width: 800, height: 90 },
      },
      {
        name: "left",
        role: "body",
        accepts: ["text", "list"],
        required: true,
        align: "left",
        frame: { x: M, y: 320, width: 800, height: 600 },
      },
      {
        name: "rightTitle",
        role: "subtitle",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: 980, y: 200, width: 800, height: 90 },
      },
      {
        name: "right",
        role: "body",
        accepts: ["text", "list"],
        required: true,
        align: "left",
        frame: { x: 980, y: 320, width: 800, height: 600 },
      },
    ],
  },
  {
    id: "pros-cons",
    nameZh: "優缺點",
    category: "compare",
    hintZh: "優點與缺點兩欄",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: M, y: 110, width: contentW, height: 130 },
      },
      {
        name: "left",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: M, y: 320, width: 800, height: 620 },
      },
      {
        name: "right",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: 980, y: 320, width: 800, height: 620 },
      },
    ],
  },

  /* ── 數據型 ── */
  {
    id: "big-number-callout",
    nameZh: "單一震撼數字",
    category: "data",
    hintZh: "用一個關鍵數字震撼觀眾",
    slots: [
      {
        name: "number",
        role: "bignumber",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 320, width: contentW, height: 320 },
      },
      {
        name: "caption",
        role: "caption",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: M, y: 680, width: contentW, height: 100 },
      },
    ],
  },
  {
    id: "kpi-row",
    nameZh: "多指標並排",
    category: "data",
    hintZh: "三到四個指標數字並排",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: M, y: 150, width: contentW, height: 130 },
      },
      {
        name: "kpi1",
        role: "bignumber",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: M, y: 420, width: 520, height: 240 },
      },
      {
        name: "kpi2",
        role: "bignumber",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: 700, y: 420, width: 520, height: 240 },
      },
      {
        name: "kpi3",
        role: "bignumber",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: 1280, y: 420, width: 520, height: 240 },
      },
    ],
  },
  {
    id: "chart-focus",
    nameZh: "圖表為主",
    category: "data",
    hintZh: "用圖表呈現數據趨勢，右側放要點",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 120, width: contentW, height: 140 },
      },
      {
        name: "chart",
        role: "image",
        accepts: ["chart", "image"],
        required: true,
        frame: { x: M, y: 300, width: 1040, height: 640 },
      },
      {
        name: "points",
        role: "bullets",
        accepts: ["list", "text"],
        required: false,
        align: "left",
        frame: { x: 1220, y: 300, width: 580, height: 640 },
      },
    ],
  },
  {
    id: "table-focus",
    nameZh: "表格為主",
    category: "data",
    hintZh: "用表格整理多項資料",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 120, width: contentW, height: 140 },
      },
      {
        name: "table",
        role: "image",
        accepts: ["table"],
        required: true,
        frame: { x: M, y: 300, width: contentW, height: 660 },
      },
    ],
  },

  /* ── 流程型 ── */
  {
    id: "flow-horizontal",
    nameZh: "水平流程",
    category: "flow",
    hintZh: "由左到右的流程或因果",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 130, width: contentW, height: 220 },
      },
      {
        name: "steps",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: M, y: 420, width: contentW, height: 320 },
      },
    ],
  },
  {
    id: "timeline",
    nameZh: "時間軸",
    category: "flow",
    hintZh: "依時間順序的事件",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: true,
        align: "left",
        frame: { x: M, y: 130, width: contentW, height: 220 },
      },
      {
        name: "events",
        role: "bullets",
        accepts: ["list"],
        required: true,
        align: "left",
        frame: { x: M, y: 340, width: contentW, height: 600 },
      },
    ],
  },

  /* ── 引言型 ── */
  {
    id: "quote-hero",
    nameZh: "全幅引言",
    category: "quote",
    hintZh: "一句重要的話佔滿整頁",
    slots: [
      {
        name: "quote",
        role: "quote",
        accepts: ["text"],
        required: true,
        align: "center",
        frame: { x: 200, y: 340, width: W - 400, height: 360 },
      },
      {
        name: "caption",
        role: "caption",
        accepts: ["text"],
        required: false,
        align: "center",
        frame: { x: M, y: 740, width: contentW, height: 80 },
      },
    ],
  },

  /* ── 圖庫型 ── */
  {
    id: "image-grid-2x2",
    nameZh: "2×2 圖庫",
    category: "gallery",
    hintZh: "四張圖並列",
    slots: [
      {
        name: "i1",
        role: "image",
        accepts: ["image"],
        required: true,
        frame: { x: M, y: 130, width: 800, height: 400 },
      },
      {
        name: "i2",
        role: "image",
        accepts: ["image"],
        required: true,
        frame: { x: 980, y: 130, width: 800, height: 400 },
      },
      {
        name: "i3",
        role: "image",
        accepts: ["image"],
        required: false,
        frame: { x: M, y: 560, width: 800, height: 400 },
      },
      {
        name: "i4",
        role: "image",
        accepts: ["image"],
        required: false,
        frame: { x: 980, y: 560, width: 800, height: 400 },
      },
    ],
  },
  {
    id: "gallery-strip",
    nameZh: "橫向圖帶",
    category: "gallery",
    hintZh: "三張圖橫向排列加標題",
    slots: [
      {
        name: "title",
        role: "title",
        accepts: ["text"],
        required: false,
        align: "left",
        frame: { x: M, y: 120, width: contentW, height: 130 },
      },
      {
        name: "i1",
        role: "image",
        accepts: ["image"],
        required: true,
        frame: { x: M, y: 320, width: 520, height: 560 },
      },
      {
        name: "i2",
        role: "image",
        accepts: ["image"],
        required: true,
        frame: { x: 700, y: 320, width: 520, height: 560 },
      },
      {
        name: "i3",
        role: "image",
        accepts: ["image"],
        required: false,
        frame: { x: 1280, y: 320, width: 520, height: 560 },
      },
    ],
  },
];

const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string): LayoutPreset | undefined {
  return PRESET_MAP.get(id);
}

export const FALLBACK_PRESET_ID = "bullet-list";

/** 給 AI 的 preset 清單摘要（id + 提示）。 */
export function presetCatalogForPrompt(): string {
  return PRESETS.map((p) => `- ${p.id}（${p.nameZh}）：${p.hintZh}`).join("\n");
}
