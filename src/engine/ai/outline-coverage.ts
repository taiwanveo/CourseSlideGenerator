/**
 * 大綱覆蓋率檢查器 — 生成後比對大綱節點是否出現在投影片內容中，
 * 缺漏則自動補頁，並輸出可量化的覆蓋率報告。
 */
import type { LayoutIntent } from "../layout/intent";
import type { OutlineCoverageReport, OutlineNode } from "../../model/types";

export interface OutlineRequirement {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  path: string;
  keyPoint: boolean;
  node: OutlineNode;
  parentId?: string;
}

const PUNCT_RE = /[\s，。、；：！？""''（）\[\]【】《》\-—·…,.;:!?'"()]/g;

/** 正規化比對用文字（去空白與標點）。 */
export function normalizeForMatch(text: string): string {
  return text.replace(PUNCT_RE, "").toLowerCase();
}

/** 將大綱樹攤平成必須覆蓋的節點清單（章 / 節 / 重點皆計入）。 */
export function flattenOutlineRequirements(
  outline: OutlineNode[],
  parentPath = "",
  parentId?: string,
): OutlineRequirement[] {
  const out: OutlineRequirement[] = [];
  for (let i = 0; i < outline.length; i++) {
    const node = outline[i]!;
    const text = node.text.trim();
    const path = parentPath ? `${parentPath} › ${text}` : text;
    const id = `req_${out.length}_L${node.level}_${i}`;

    const req: OutlineRequirement = {
      id,
      level: node.level,
      text,
      path,
      keyPoint: node.keyPoint,
      node,
      parentId,
    };
    if (text.length >= 2) out.push(req);

    if (node.children.length > 0) {
      out.push(...flattenOutlineRequirements(node.children, path, id));
    }
  }
  return out;
}

/** 從 AI 版面意圖萃取全部可搜尋文字。 */
export function buildIntentCorpus(intents: LayoutIntent[]): string {
  const parts: string[] = [];
  for (const slide of intents) {
    if (slide.slideTitle) parts.push(slide.slideTitle);
    if (slide.reason) parts.push(slide.reason);
    for (const slot of slide.slots) {
      if (slot.text) parts.push(slot.text);
      if (slot.listItems?.length) parts.push(...slot.listItems);
    }
    if (slide.emphasisPoints?.length) parts.push(...slide.emphasisPoints);
  }
  return parts.join("\n");
}

/**
 * 判斷大綱節點文案是否已被投影片內容涵蓋。
 * 先完整子字串比對，長文再降級為前綴／雙字組覆蓋率。
 */
export function isOutlineTextCovered(nodeText: string, corpusNormalized: string): boolean {
  const n = normalizeForMatch(nodeText);
  if (!n) return true;
  if (corpusNormalized.includes(n)) return true;

  if (n.length >= 6) {
    const minLen = Math.max(6, Math.floor(n.length * 0.55));
    for (let len = n.length; len >= minLen; len -= Math.max(2, Math.floor(n.length * 0.12))) {
      if (corpusNormalized.includes(n.slice(0, len))) return true;
    }
  }

  if (n.length >= 8) {
    const grams = new Set<string>();
    for (let i = 0; i < n.length - 1; i++) grams.add(n.slice(i, i + 2));
    if (grams.size > 0) {
      let hit = 0;
      for (const g of grams) {
        if (corpusNormalized.includes(g)) hit++;
      }
      if (hit / grams.size >= 0.82) return true;
    }
  }

  return false;
}

function percent(covered: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((covered / total) * 1000) / 10;
}

function buildReport(
  requirements: OutlineRequirement[],
  missingBefore: OutlineRequirement[],
  missingAfter: OutlineRequirement[],
  patchedSlides: number,
): OutlineCoverageReport {
  const total = requirements.length;
  const coveredBefore = total - missingBefore.length;
  const coveredAfter = total - missingAfter.length;
  return {
    requiredNodes: total,
    coveredBeforePatch: coveredBefore,
    coveredAfterPatch: coveredAfter,
    coveragePercentBefore: percent(coveredBefore, total),
    coveragePercentAfter: percent(coveredAfter, total),
    patchedSlides,
    missingBeforePatch: missingBefore.map((m) => m.text),
    missingAfterPatch: missingAfter.map((m) => m.text),
  };
}

function sectionTitleFromPath(path: string): string {
  const parts = path.split(" › ");
  if (parts.length >= 2) return parts[parts.length - 2]!;
  return parts[0] ?? "補充內容";
}

/** 為單一缺漏節點建立保底版面意圖。 */
export function buildPatchIntentForRequirement(req: OutlineRequirement): LayoutIntent {
  if (req.level === 1) {
    return {
      slideTitle: req.text,
      presetId: "section-divider",
      reason: "coverage-patcher:chapter",
      slots: [
        { slotName: "label", contentType: "text", text: "章節（自動補頁）" },
        { slotName: "title", contentType: "text", text: req.text },
      ],
      emphasisPoints: [],
    };
  }

  if (req.level === 2) {
    const bullets =
      req.node.children.length > 0 ? req.node.children.map((c) => c.text.trim()).filter(Boolean) : [req.text];
    return {
      slideTitle: req.text,
      presetId: "bullet-list",
      reason: "coverage-patcher:section",
      slots: [
        { slotName: "title", contentType: "text", text: req.text },
        { slotName: "bullets", contentType: "list", listItems: bullets, ordered: false },
      ],
      emphasisPoints: [],
    };
  }

  const sectionTitle = sectionTitleFromPath(req.path);
  return {
    slideTitle: req.text.length > 48 ? `${req.text.slice(0, 48)}…` : req.text,
    presetId: "bullet-list",
    reason: "coverage-patcher:keypoint",
    slots: [
      { slotName: "title", contentType: "text", text: `${sectionTitle}（補充）` },
      { slotName: "bullets", contentType: "list", listItems: [req.text], ordered: false },
    ],
    emphasisPoints: req.keyPoint ? [req.text] : [],
  };
}

/**
 * 將缺漏節點分組後建立補頁意圖（同節下多個 L3 重點合併成一頁條列）。
 */
export function buildPatchIntents(missing: OutlineRequirement[]): LayoutIntent[] {
  if (missing.length === 0) return [];

  const byParent = new Map<string, OutlineRequirement[]>();
  for (const m of missing) {
    const key = m.parentId ?? `orphan_L${m.level}`;
    const group = byParent.get(key) ?? [];
    group.push(m);
    byParent.set(key, group);
  }

  const intents: LayoutIntent[] = [];
  for (const group of byParent.values()) {
    const allL3 = group.every((g) => g.level === 3);
    if (allL3 && group.length > 1) {
      const sectionTitle = sectionTitleFromPath(group[0]!.path);
      intents.push({
        slideTitle: `${sectionTitle}（補充重點）`,
        presetId: "bullet-list",
        reason: "coverage-patcher:batch-keypoints",
        slots: [
          { slotName: "title", contentType: "text", text: `${sectionTitle}（補充）` },
          {
            slotName: "bullets",
            contentType: "list",
            listItems: group.map((g) => g.text),
            ordered: false,
          },
        ],
        emphasisPoints: group.filter((g) => g.keyPoint).map((g) => g.text),
      });
      continue;
    }

    for (const req of group) {
      intents.push(buildPatchIntentForRequirement(req));
    }
  }
  return intents;
}

/** 稽核大綱覆蓋率（不修改資料）。 */
export function auditOutlineCoverage(
  outline: OutlineNode[],
  intents: LayoutIntent[],
): { requirements: OutlineRequirement[]; missing: OutlineRequirement[]; corpus: string } {
  const requirements = flattenOutlineRequirements(outline);
  const corpus = normalizeForMatch(buildIntentCorpus(intents));
  const missing = requirements.filter((r) => !isOutlineTextCovered(r.text, corpus));
  return { requirements, missing, corpus };
}

/**
 * 確保大綱 100% 覆蓋：缺漏則附加自動補頁意圖，並回傳量化報告。
 */
export function ensureOutlineCoverage(
  outline: OutlineNode[],
  intents: LayoutIntent[],
): { intents: LayoutIntent[]; report: OutlineCoverageReport } {
  const requirements = flattenOutlineRequirements(outline);
  if (requirements.length === 0) {
    return {
      intents,
      report: {
        requiredNodes: 0,
        coveredBeforePatch: 0,
        coveredAfterPatch: 0,
        coveragePercentBefore: 100,
        coveragePercentAfter: 100,
        patchedSlides: 0,
        missingBeforePatch: [],
        missingAfterPatch: [],
      },
    };
  }

  const corpusBefore = normalizeForMatch(buildIntentCorpus(intents));
  const missingBefore = requirements.filter((r) => !isOutlineTextCovered(r.text, corpusBefore));
  const patchIntents = buildPatchIntents(missingBefore);
  const merged = patchIntents.length > 0 ? [...intents, ...patchIntents] : intents;

  const corpusAfter = normalizeForMatch(buildIntentCorpus(merged));
  const missingAfter = requirements.filter((r) => !isOutlineTextCovered(r.text, corpusAfter));

  return {
    intents: merged,
    report: buildReport(requirements, missingBefore, missingAfter, patchIntents.length),
  };
}
