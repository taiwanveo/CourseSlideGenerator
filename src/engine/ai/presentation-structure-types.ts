/**
 * 簡報架構中間表示 — Stage 1（article_to_presentation_structure）輸出契約。
 */
export type SlideVisualType =
  | "title"
  | "agenda"
  | "section-divider"
  | "executive-summary"
  | "bullet-list"
  | "comparison"
  | "timeline"
  | "process"
  | "framework"
  | "chart"
  | "case"
  | "quote"
  | "problem"
  | "recommendation"
  | "closing"
  | "image-focus";

export interface StructureOmittedItem {
  sourceIndex: number;
  reason: string;
}

export interface SlideStructureItem {
  slideNo: number;
  title: string;
  mainMessage: string;
  keyPoints: string[];
  suggestedVisual: SlideVisualType;
  speakerNote?: string;
  /** 對應原文段落 index（0-based），full 模式必須覆蓋全部段落 */
  sourceRefs: number[];
  imageAssetIds?: string[];
  kind?: "title" | "section" | "chapter" | "image";
}

export interface PresentationStructure {
  objective: string;
  audience: string;
  coreMessage: string;
  narrativeFlow: string;
  slides: SlideStructureItem[];
  omitted: StructureOmittedItem[];
}

export interface StructureCoverageReport {
  totalParagraphs: number;
  coveredParagraphs: number;
  coveragePercent: number;
  patchedSlides: number;
  missingParagraphIndices: number[];
}
