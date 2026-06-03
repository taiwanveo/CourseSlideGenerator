/**
 * Skill 1 suggestedVisual → 版型 presetId 映射。
 */
import type { SlideVisualType } from "./presentation-structure-types";

const VISUAL_TO_PRESET: Record<SlideVisualType, string> = {
  title: "title-subtitle",
  agenda: "bullet-list",
  "section-divider": "section-divider",
  "executive-summary": "bullet-list",
  "bullet-list": "bullet-list",
  comparison: "compare-2col",
  timeline: "timeline",
  process: "flow-horizontal",
  framework: "two-column-bullets",
  chart: "chart-focus",
  case: "text-left-image-right",
  quote: "quote-hero",
  problem: "bullet-list",
  recommendation: "bullet-list",
  closing: "title-subtitle",
  "image-focus": "big-image-center",
};

export function presetIdForVisual(visual: SlideVisualType, hasImage: boolean): string {
  if (hasImage && visual !== "section-divider" && visual !== "title") {
    return "text-left-image-right";
  }
  return VISUAL_TO_PRESET[visual] ?? "bullet-list";
}

export function presetHintForVisual(visual: SlideVisualType): string {
  return presetIdForVisual(visual, false);
}
