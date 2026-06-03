/**
 * 動效目錄 — 四類：進場 enter / 出場 exit / 強調 emphasis / 轉場 transition。
 * 沿用並擴充自 CourseFlow wvp-bridge/catalog。每個動效對應一段 CSS keyframes，
 * 由 renderer 注入，並可被 HTML 匯出 runtime 共用。
 */

export interface MotionPreset {
  id: string;
  nameZh: string;
  kind: "enter" | "exit" | "emphasis" | "transition";
  /** keyframes body（不含 @keyframes 名稱包裹） */
  keyframes: string;
  defaultDuration: number;
  defaultEasing: string;
}

export const ENTER_PRESETS: MotionPreset[] = [
  {
    id: "fade-up",
    nameZh: "淡入上移",
    kind: "enter",
    keyframes: `from { opacity: 0; transform: translateY(64px); } to { opacity: 1; transform: translateY(0); }`,
    defaultDuration: 600,
    defaultEasing: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  {
    id: "fade-in",
    nameZh: "純淡入",
    kind: "enter",
    keyframes: `from { opacity: 0; } to { opacity: 1; }`,
    defaultDuration: 500,
    defaultEasing: "ease-out",
  },
  {
    id: "scale-in",
    nameZh: "縮放進入",
    kind: "enter",
    keyframes: `from { opacity: 0; transform: scale(0.72); } to { opacity: 1; transform: scale(1); }`,
    defaultDuration: 520,
    defaultEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  {
    id: "slide-left",
    nameZh: "左滑進入",
    kind: "enter",
    keyframes: `from { opacity: 0; transform: translateX(96px); } to { opacity: 1; transform: translateX(0); }`,
    defaultDuration: 560,
    defaultEasing: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  {
    id: "blur-in",
    nameZh: "模糊轉清晰",
    kind: "enter",
    keyframes: `from { opacity: 0; filter: blur(14px); } to { opacity: 1; filter: blur(0); }`,
    defaultDuration: 640,
    defaultEasing: "ease-out",
  },
];

export const EXIT_PRESETS: MotionPreset[] = [
  {
    id: "fade-out",
    nameZh: "淡出",
    kind: "exit",
    keyframes: `from { opacity: 1; } to { opacity: 0; }`,
    defaultDuration: 400,
    defaultEasing: "ease-in",
  },
  {
    id: "scale-out",
    nameZh: "縮小淡出",
    kind: "exit",
    keyframes: `from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.9); }`,
    defaultDuration: 420,
    defaultEasing: "ease-in",
  },
  {
    id: "slide-out-right",
    nameZh: "右滑離開",
    kind: "exit",
    keyframes: `from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(48px); }`,
    defaultDuration: 440,
    defaultEasing: "ease-in",
  },
  {
    id: "blur-out",
    nameZh: "模糊離開",
    kind: "exit",
    keyframes: `from { opacity: 1; filter: blur(0); } to { opacity: 0; filter: blur(12px); }`,
    defaultDuration: 460,
    defaultEasing: "ease-in",
  },
];

export const EMPHASIS_PRESETS: MotionPreset[] = [
  {
    id: "pulse",
    nameZh: "脈動",
    kind: "emphasis",
    keyframes: `0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); }`,
    defaultDuration: 700,
    defaultEasing: "ease-in-out",
  },
  {
    id: "shake",
    nameZh: "搖晃",
    kind: "emphasis",
    keyframes: `0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); }`,
    defaultDuration: 500,
    defaultEasing: "ease-in-out",
  },
  {
    id: "bounce",
    nameZh: "彈跳",
    kind: "emphasis",
    keyframes: `0%,100% { transform: translateY(0); } 40% { transform: translateY(-16px); } 60% { transform: translateY(-8px); }`,
    defaultDuration: 760,
    defaultEasing: "cubic-bezier(0.28, 0.84, 0.42, 1)",
  },
  {
    id: "glow",
    nameZh: "發光",
    kind: "emphasis",
    keyframes: `0%,100% { filter: drop-shadow(0 0 0 var(--accent)); } 50% { filter: drop-shadow(0 0 18px var(--accent)); }`,
    defaultDuration: 900,
    defaultEasing: "ease-in-out",
  },
];

export const TRANSITION_PRESETS: MotionPreset[] = [
  {
    id: "crossfade",
    nameZh: "交叉淡化",
    kind: "transition",
    keyframes: `from { opacity: 0; } to { opacity: 1; }`,
    defaultDuration: 600,
    defaultEasing: "ease-in-out",
  },
  {
    id: "wipe-right",
    nameZh: "向右擦除",
    kind: "transition",
    keyframes: `from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); }`,
    defaultDuration: 650,
    defaultEasing: "cubic-bezier(0.77, 0, 0.18, 1)",
  },
  {
    id: "push-left",
    nameZh: "向左推移",
    kind: "transition",
    keyframes: `from { transform: translateX(100%); } to { transform: translateX(0); }`,
    defaultDuration: 620,
    defaultEasing: "cubic-bezier(0.77, 0, 0.18, 1)",
  },
  {
    id: "cover",
    nameZh: "色塊覆蓋",
    kind: "transition",
    keyframes: `from { transform: translateY(100%); } to { transform: translateY(0); }`,
    defaultDuration: 600,
    defaultEasing: "cubic-bezier(0.77, 0, 0.18, 1)",
  },
];

export const ALL_MOTION_PRESETS: MotionPreset[] = [
  ...ENTER_PRESETS,
  ...EXIT_PRESETS,
  ...EMPHASIS_PRESETS,
  ...TRANSITION_PRESETS,
];

const MOTION_MAP = new Map(ALL_MOTION_PRESETS.map((p) => [p.id, p]));

export function getMotionPreset(id: string): MotionPreset | undefined {
  return MOTION_MAP.get(id);
}

/** 產生全部 @keyframes 的 CSS 字串（供 renderer / 匯出注入一次）。 */
export function buildKeyframesCss(): string {
  return ALL_MOTION_PRESETS.map(
    (p) => `@keyframes csg-${p.id} { ${p.keyframes} }`,
  ).join("\n");
}
