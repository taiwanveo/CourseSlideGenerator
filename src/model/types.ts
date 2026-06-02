/**
 * 物件樹資料模型 — 編輯器、渲染器、匯出器共用的唯一真相。
 * 全部以 TypeScript strict 撰寫。對應 docs/04-物件樹Schema與AI版型映射.md。
 */

export const CANVAS_WIDTH = 1920 as const;
export const CANVAS_HEIGHT = 1080 as const;

/* ─────────────── 頂層 ─────────────── */

export interface Project {
  schemaVersion: 1;
  id: string;
  meta: ProjectMeta;
  source: ProjectSource;
  theme: ThemeRef;
  defaults: MotionDefaults;
  assets: AssetRef[];
  deck: Deck;
}

export interface ProjectMeta {
  title: string;
  language: "zh-TW";
  createdAt: number;
  updatedAt: number;
}

/** AI 生成後的大綱覆蓋率報告（可量化「不漏字」）。 */
export interface OutlineCoverageReport {
  requiredNodes: number;
  coveredBeforePatch: number;
  coveredAfterPatch: number;
  coveragePercentBefore: number;
  coveragePercentAfter: number;
  patchedSlides: number;
  missingBeforePatch: string[];
  missingAfterPatch: string[];
}

/** AI 生成品質報告（事實一致性 / 過密頁面）。 */
export interface GenerationQualityReport {
  factualConsistencyPercent: number;
  unsupportedClaims: string[];
  denseSlidesBeforePatch: number;
  denseSlidesAfterPatch: number;
  splitSlidesAdded: number;
}

export interface ProjectSource {
  originalText: string;
  translatedText: string;
  outline: OutlineNode[];
  /** 最近一次 AI 生成的大綱覆蓋率（補頁後應接近 100%） */
  coverage?: OutlineCoverageReport;
  quality?: GenerationQualityReport;
}

export interface OutlineNode {
  level: 1 | 2 | 3;
  text: string;
  keyPoint: boolean;
  children: OutlineNode[];
}

export interface ThemeRef {
  id: string;
  tokenOverrides?: Record<string, string>;
}

export interface AssetRef {
  id: string;
  kind: "image" | "audio";
  /** 可為 blob URL / data URL / 本機相對路徑（Tauri） */
  src: string;
  name: string;
  width?: number;
  height?: number;
}

/* ─────────────── 簡報 / 頁面 ─────────────── */

export interface Deck {
  canvas: { width: typeof CANVAS_WIDTH; height: typeof CANVAS_HEIGHT };
  slides: Slide[];
}

export interface Slide {
  id: string;
  layoutPreset: string;
  /** 可選：覆寫全域主題，供單頁/批次套用主題。 */
  themeId?: string;
  background: Background;
  transition: TransitionRef;
  elements: Element[];
  notes?: string;
  audio?: SlideAudio;
}

export type Background =
  | { type: "solid"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "image"; assetId: string; fit: "cover" | "contain" }
  | { type: "none" };

export interface SlideAudio {
  assetId: string;
  /** bgm: 全簡報持續播放；slide: 僅此頁播放 */
  mode: "bgm" | "slide";
  loop: boolean;
  volume: number;
}

/* ─────────────── 物件 ─────────────── */

export type ElementType =
  | "text"
  | "list"
  | "image"
  | "shape"
  | "icon"
  | "chart"
  | "table"
  | "audio"
  | "group";

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
}

export interface ElementBase {
  id: string;
  name?: string;
  transform: Transform;
  animations: ElementAnimation[];
  locked?: boolean;
  hidden?: boolean;
}

export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface RichText {
  spans: TextSpan[];
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing?: number;
  fontWeight?: number;
  valign?: "top" | "middle" | "bottom";
}

export interface ShadowStyle {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface TextElement extends ElementBase {
  type: "text";
  content: RichText;
  style: TextStyle;
  /** 自動依內容調整邊框尺寸（如 Word 文字方塊）。僅手動新增的文字方塊啟用。 */
  autoSize?: boolean;
}

export interface ListElement extends ElementBase {
  type: "list";
  ordered: boolean;
  items: RichText[];
  style: TextStyle & { markerColor?: string; itemGap?: number };
  autoSize?: boolean;
}

export interface ImageElement extends ElementBase {
  type: "image";
  assetId: string;
  fit: "cover" | "contain" | "fill";
  cornerRadius?: number;
  shadow?: ShadowStyle;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: "rect" | "ellipse" | "line" | "arrow" | "triangle";
  fill?: string;
  stroke?: { color: string; width: number };
  cornerRadius?: number;
}

export interface IconElement extends ElementBase {
  type: "icon";
  iconId: string;
  color: string;
}

export interface ChartElement extends ElementBase {
  type: "chart";
  config: ChartConfig;
}

export interface TableElement extends ElementBase {
  type: "table";
  config: TableConfig;
}

export interface AudioElement extends ElementBase {
  type: "audio";
  assetId: string;
  mode: "bgm" | "slide";
  loop: boolean;
  volume: number;
}

export interface GroupElement extends ElementBase {
  type: "group";
  children: Element[];
}

export type Element =
  | TextElement
  | ListElement
  | ImageElement
  | ShapeElement
  | IconElement
  | ChartElement
  | TableElement
  | AudioElement
  | GroupElement;

/* ─────────────── 視覺：圖表 / 表格 ─────────────── */

export interface ChartSeriesPoint {
  label: string;
  value: number;
}

export interface ChartConfig {
  chartType: "bar" | "line" | "area" | "pie" | "kpi";
  title?: string;
  data: ChartSeriesPoint[];
  colorRole: "sequential" | "categorical" | "highlight";
  highlightIndex?: number;
  unit?: string;
}

export interface TableConfig {
  columns: Array<{ key: string; label: string; format?: "text" | "number" | "percent" }>;
  rows: Array<Record<string, string | number>>;
  highlightRowIndex?: number;
  density?: "compact" | "comfortable";
}

/* ─────────────── 動效 ─────────────── */

export type AnimationKind = "enter" | "exit" | "emphasis";

export interface ElementAnimation {
  kind: AnimationKind;
  preset: string;
  delay: number;
  duration: number;
  easing: string;
}

export interface MotionDefaults {
  enter: string;
  exit: string;
  emphasis: string;
  transition: string;
}

export interface TransitionRef {
  preset: string;
  duration: number;
  easing: string;
}

export interface NamedSnapshot {
  id: string;
  name: string;
  createdAt: number;
  project: Project;
}
