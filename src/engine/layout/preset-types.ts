/**
 * Preset 型別與角色樣式 — 每個 preset 是宣告式槽位定義 + 角色。
 * 通用 buildFromSlots 依角色套用 asian-slide-design 字級階層，產生物件樹。
 */
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../model/types";

export type ContentType = "text" | "richtext" | "list" | "image" | "chart" | "table";

export type SlotRole =
  | "title"
  | "subtitle"
  | "body"
  | "bullets"
  | "image"
  | "bignumber"
  | "quote"
  | "caption"
  | "label";

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlotDef {
  name: string;
  role: SlotRole;
  accepts: ContentType[];
  required: boolean;
  frame: Frame;
  align?: "left" | "center" | "right";
}

export type PresetCategory =
  | "title"
  | "bigImage"
  | "textImage"
  | "list"
  | "compare"
  | "data"
  | "flow"
  | "quote"
  | "gallery";

export interface LayoutPreset {
  id: string;
  nameZh: string;
  category: PresetCategory;
  /** 一句話描述，給 AI 選版型時參考 */
  hintZh: string;
  slots: SlotDef[];
}

export const STAGE = { w: CANVAS_WIDTH, h: CANVAS_HEIGHT };

/** asian-slide-design 字級下限（design-px）對應角色。 */
export function fontSizeForRole(role: SlotRole): number {
  switch (role) {
    case "title":
      return 84;
    case "subtitle":
      return 44;
    case "bignumber":
      return 240;
    case "quote":
      return 56;
    case "bullets":
      return 38;
    case "body":
      return 32;
    case "caption":
      return 24;
    case "label":
      return 26;
    default:
      return 32;
  }
}

export function isHeavyRole(role: SlotRole): boolean {
  return role === "title" || role === "bignumber";
}
