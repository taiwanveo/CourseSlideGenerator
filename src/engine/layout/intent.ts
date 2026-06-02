/**
 * AI 版型中間表示（Layout Intent）— AI 只輸出語意層，不算像素、不寫程式碼。
 */
import { z } from "zod";

export const slotFillSchema = z.object({
  slotName: z.string(),
  contentType: z.enum(["text", "richtext", "list", "image", "chart", "table"]),
  text: z.string().optional(),
  listItems: z.array(z.string()).optional(),
  ordered: z.boolean().optional(),
  imageAssetId: z.string().optional(),
});

export const layoutIntentSchema = z.object({
  slideTitle: z.string(),
  presetId: z.string(),
  reason: z.string().optional().default(""),
  slots: z.array(slotFillSchema),
  emphasisPoints: z.array(z.string()).optional().default([]),
  suggestedImagePrompt: z.string().optional(),
});

export const deckIntentSchema = z.object({
  slides: z.array(layoutIntentSchema),
});

export type SlotFill = z.infer<typeof slotFillSchema>;
export type LayoutIntent = z.infer<typeof layoutIntentSchema>;
export type DeckIntent = z.infer<typeof deckIntentSchema>;
