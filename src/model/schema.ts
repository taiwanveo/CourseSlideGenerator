/**
 * 物件樹 Zod schema — 用於存檔/載入/匯出/AI 回傳前的校驗，確保跨版本相容。
 */
import { z } from "zod";

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  zIndex: z.number(),
  opacity: z.number().min(0).max(1),
});

const animationSchema = z.object({
  kind: z.enum(["enter", "exit", "emphasis"]),
  preset: z.string(),
  delay: z.number(),
  duration: z.number(),
  easing: z.string(),
});

const elementBase = {
  id: z.string(),
  name: z.string().optional(),
  transform: transformSchema,
  animations: z.array(animationSchema),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

const textSpanSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: z.string().optional(),
});

const richTextSchema = z.object({
  spans: z.array(textSpanSchema),
});

const textStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
  color: z.string(),
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number(),
  letterSpacing: z.number().optional(),
  fontWeight: z.number().optional(),
  valign: z.enum(["top", "middle", "bottom"]).optional(),
});

const shadowSchema = z.object({
  x: z.number(),
  y: z.number(),
  blur: z.number(),
  color: z.string(),
});

const chartConfigSchema = z.object({
  chartType: z.enum(["bar", "line", "area", "pie", "kpi"]),
  title: z.string().optional(),
  data: z.array(z.object({ label: z.string(), value: z.number() })),
  colorRole: z.enum(["sequential", "categorical", "highlight"]),
  highlightIndex: z.number().optional(),
  unit: z.string().optional(),
});

const tableConfigSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      format: z.enum(["text", "number", "percent"]).optional(),
    }),
  ),
  rows: z.array(z.record(z.union([z.string(), z.number()]))),
  highlightRowIndex: z.number().optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
});

// 因 group 為遞迴結構，使用 z.lazy
type ElementInput = z.input<typeof baseTextSchema> | Record<string, unknown>;

const baseTextSchema = z.object({
  ...elementBase,
  type: z.literal("text"),
  content: richTextSchema,
  style: textStyleSchema,
  autoSize: z.boolean().optional(),
});

export const elementSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    baseTextSchema,
    z.object({
      ...elementBase,
      type: z.literal("list"),
      ordered: z.boolean(),
      items: z.array(richTextSchema),
      style: textStyleSchema.extend({
        markerColor: z.string().optional(),
        itemGap: z.number().optional(),
      }),
    }),
    z.object({
      ...elementBase,
      type: z.literal("image"),
      assetId: z.string(),
      fit: z.enum(["cover", "contain", "fill"]),
      cornerRadius: z.number().optional(),
      shadow: shadowSchema.optional(),
    }),
    z.object({
      ...elementBase,
      type: z.literal("shape"),
      shape: z.enum(["rect", "ellipse", "line", "arrow", "triangle"]),
      fill: z.string().optional(),
      stroke: z.object({ color: z.string(), width: z.number() }).optional(),
      cornerRadius: z.number().optional(),
    }),
    z.object({
      ...elementBase,
      type: z.literal("icon"),
      iconId: z.string(),
      color: z.string(),
    }),
    z.object({
      ...elementBase,
      type: z.literal("chart"),
      config: chartConfigSchema,
    }),
    z.object({
      ...elementBase,
      type: z.literal("table"),
      config: tableConfigSchema,
    }),
    z.object({
      ...elementBase,
      type: z.literal("audio"),
      assetId: z.string(),
      mode: z.enum(["bgm", "slide"]),
      loop: z.boolean(),
      volume: z.number(),
    }),
    z.object({
      ...elementBase,
      type: z.literal("group"),
      children: z.array(elementSchema),
    }),
  ]) as unknown as z.ZodType<ElementInput>,
);

const backgroundSchema = z.union([
  z.object({ type: z.literal("solid"), color: z.string() }),
  z.object({
    type: z.literal("gradient"),
    from: z.string(),
    to: z.string(),
    angle: z.number(),
  }),
  z.object({
    type: z.literal("image"),
    assetId: z.string(),
    fit: z.enum(["cover", "contain"]),
  }),
  z.object({ type: z.literal("none") }),
]);

const transitionSchema = z.object({
  preset: z.string(),
  duration: z.number(),
  easing: z.string(),
});

const slideSchema = z.object({
  id: z.string(),
  layoutPreset: z.string(),
  themeId: z.string().optional(),
  background: backgroundSchema,
  transition: transitionSchema,
  elements: z.array(elementSchema),
  notes: z.string().optional(),
  audio: z
    .object({
      assetId: z.string(),
      mode: z.enum(["bgm", "slide"]),
      loop: z.boolean(),
      volume: z.number(),
    })
    .optional(),
});

const outlineNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
    keyPoint: z.boolean(),
    children: z.array(outlineNodeSchema),
  }),
);

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  meta: z.object({
    title: z.string(),
    language: z.literal("zh-TW"),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  source: z.object({
    originalText: z.string(),
    translatedText: z.string(),
    outline: z.array(outlineNodeSchema),
    coverage: z
      .object({
        requiredNodes: z.number(),
        coveredBeforePatch: z.number(),
        coveredAfterPatch: z.number(),
        coveragePercentBefore: z.number(),
        coveragePercentAfter: z.number(),
        patchedSlides: z.number(),
        missingBeforePatch: z.array(z.string()),
        missingAfterPatch: z.array(z.string()),
      })
      .optional(),
    quality: z
      .object({
        factualConsistencyPercent: z.number(),
        unsupportedClaims: z.array(z.string()),
        denseSlidesBeforePatch: z.number(),
        denseSlidesAfterPatch: z.number(),
        splitSlidesAdded: z.number(),
      })
      .optional(),
  }),
  theme: z.object({
    id: z.string(),
    tokenOverrides: z.record(z.string()).optional(),
  }),
  defaults: z.object({
    enter: z.string(),
    exit: z.string(),
    emphasis: z.string(),
    transition: z.string(),
  }),
  assets: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["image", "audio"]),
      src: z.string(),
      name: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  ),
  deck: z.object({
    canvas: z.object({ width: z.literal(1920), height: z.literal(1080) }),
    slides: z.array(slideSchema),
  }),
});
