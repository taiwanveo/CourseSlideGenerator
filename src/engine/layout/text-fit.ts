/**
 * 文字換行估算與標題單行自適應字級。
 */
import type { Element, TextElement } from "../../model/types";

export const DEFAULT_TITLE_FONT_SIZE = 84;
export const MIN_TITLE_FONT_SIZE = 28;

export function charsPerLine(width: number, fontSize: number): number {
  return Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.92)));
}

export function estimateWrappedLines(text: string, width: number, fontSize: number): number {
  const parts = text.split(/\n/);
  let lines = 0;
  for (const part of parts) {
    const len = part.trim().length;
    lines += len === 0 ? 0 : Math.ceil(len / charsPerLine(width, fontSize));
  }
  return Math.max(1, lines);
}

export function isTitleLikeText(el: TextElement): boolean {
  const size = el.style.fontSize;
  const weight = el.style.fontWeight ?? 400;
  if (size >= 200) return false;
  return size >= DEFAULT_TITLE_FONT_SIZE || (weight >= 700 && size >= 52 && size < 120);
}

export function titleNeedsRephrase(title: string, slotWidth = 820): boolean {
  return (
    title.length > 28 ||
    estimateWrappedLines(title, slotWidth, DEFAULT_TITLE_FONT_SIZE) > 1
  );
}

/** 縮小字級直到標題在槽寬內單行放得下。 */
export function fitTitleElementToSingleLine(el: TextElement): void {
  const text = el.content.spans.map((s) => s.text).join("");
  const width = el.transform.width;
  let size = el.style.fontSize;
  const lineHeight = el.style.lineHeight ?? 1.22;

  while (size > MIN_TITLE_FONT_SIZE && estimateWrappedLines(text, width, size) > 1) {
    size -= 2;
    el.style.fontSize = size;
  }

  const lineH = Math.ceil(size * lineHeight + 6);
  el.transform.height = Math.max(lineH, Math.min(el.transform.height, lineH));
}

export function fitAllTitleElementsToSingleLine(elements: Element[]): void {
  for (const el of elements) {
    if (el.type === "text" && isTitleLikeText(el)) {
      fitTitleElementToSingleLine(el);
    }
  }
}
