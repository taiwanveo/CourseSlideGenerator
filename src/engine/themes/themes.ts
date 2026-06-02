/**
 * 主題目錄 — 沿用 web-video-presentation 的設計語彙，以 TS token 物件呈現，
 * 渲染時注入為 CSS 變數（--shell / --surface / --text / --accent / 字型 / 圓角）。
 * 易於擴充：新增一個 Theme 物件即可。
 */

export interface ThemeTokens {
  shell: string;
  surface: string;
  surface2: string;
  text: string;
  textMute: string;
  accent: string;
  accentSoft: string;
  rule: string;
  fontDisplay: string;
  fontBody: string;
  radiusCard: number;
}

export interface Theme {
  id: string;
  name: string;
  nameZh: string;
  mood: string[];
  tokens: ThemeTokens;
  /** 主題專屬舞台樣式（用於背景紋理、字體比例、版面氛圍）。 */
  stageStyle?: Record<string, string>;
  revealCss?: Record<string, string>;
}

const SERIF = '"Noto Serif TC", "Source Han Serif TC", Georgia, serif';
const SANS = '"Manrope", "Inter", "Noto Sans TC", -apple-system, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

export const THEMES: Theme[] = [
  {
    id: "midnight-press",
    name: "Midnight Press",
    nameZh: "暗色印刷",
    mood: ["dark", "cinematic", "developer"],
    tokens: {
      shell: "#0d0b09",
      surface: "#1a1714",
      surface2: "#231f1a",
      text: "#f5f0e5",
      textMute: "#7a7972",
      accent: "#ff4a2b",
      accentSoft: "rgba(255,74,43,0.14)",
      rule: "#2f2a25",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 6,
    },
  },
  {
    id: "paper-press",
    name: "Paper Press",
    nameZh: "紙感印刷",
    mood: ["light", "editorial", "print"],
    tokens: {
      shell: "#f4f1ea",
      surface: "#ffffff",
      surface2: "#efeae0",
      text: "#1c1a17",
      textMute: "#6f6a60",
      accent: "#c8492f",
      accentSoft: "rgba(200,73,47,0.12)",
      rule: "#ddd6c8",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "radial-gradient(circle at 50% 20%, rgba(255,255,255,.06), rgba(0,0,0,0) 55%)",
      letterSpacing: "0.01em",
    },
  },
  {
    id: "warm-keynote",
    name: "Warm Keynote",
    nameZh: "暖調主題",
    mood: ["light", "friendly", "keynote"],
    tokens: {
      shell: "#fbf6ef",
      surface: "#ffffff",
      surface2: "#f3e9da",
      text: "#2a211a",
      textMute: "#897b6c",
      accent: "#e07a3f",
      accentSoft: "rgba(224,122,63,0.14)",
      rule: "#e8dcc9",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 14,
    },
  },
  {
    id: "newsroom",
    name: "Newsroom",
    nameZh: "新聞編輯室",
    mood: ["light", "editorial", "serious"],
    tokens: {
      shell: "#ffffff",
      surface: "#f7f7f5",
      surface2: "#ececea",
      text: "#16161a",
      textMute: "#6b6b73",
      accent: "#1a52d6",
      accentSoft: "rgba(26,82,214,0.1)",
      rule: "#dcdcdc",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 2,
    },
  },
  {
    id: "bauhaus-bold",
    name: "Bauhaus Bold",
    nameZh: "包浩斯",
    mood: ["light", "bold", "geometric"],
    tokens: {
      shell: "#f0ede6",
      surface: "#ffffff",
      surface2: "#ffd84d",
      text: "#111111",
      textMute: "#5c5c5c",
      accent: "#e63329",
      accentSoft: "rgba(230,51,41,0.12)",
      rule: "#111111",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 0,
    },
  },
  {
    id: "terminal-green",
    name: "Terminal Green",
    nameZh: "終端綠",
    mood: ["dark", "developer", "mono"],
    tokens: {
      shell: "#05140c",
      surface: "#0a1f12",
      surface2: "#0f2a18",
      text: "#c8ffd9",
      textMute: "#5f9a73",
      accent: "#27f08a",
      accentSoft: "rgba(39,240,138,0.12)",
      rule: "#1c3a26",
      fontDisplay: MONO,
      fontBody: MONO,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,0) 28%)",
      letterSpacing: "0",
    },
  },
  {
    id: "blueprint",
    name: "Blueprint",
    nameZh: "藍圖",
    mood: ["dark", "technical", "blue"],
    tokens: {
      shell: "#0a1530",
      surface: "#11214a",
      surface2: "#16295c",
      text: "#dce8ff",
      textMute: "#7e91bf",
      accent: "#4f9bff",
      accentSoft: "rgba(79,155,255,0.14)",
      rule: "#243869",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 8,
    },
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    nameZh: "霓虹賽博",
    mood: ["dark", "neon", "futuristic"],
    tokens: {
      shell: "#0a0612",
      surface: "#160d28",
      surface2: "#1f1238",
      text: "#f1e6ff",
      textMute: "#9a7fc4",
      accent: "#ff2bd0",
      accentSoft: "rgba(255,43,208,0.16)",
      rule: "#2c1a4a",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 12,
    },
  },
  {
    id: "indigo-porcelain",
    name: "Indigo Porcelain",
    nameZh: "靛青瓷",
    mood: ["light", "elegant", "calm"],
    tokens: {
      shell: "#f3f4f8",
      surface: "#ffffff",
      surface2: "#e7eaf3",
      text: "#1d2235",
      textMute: "#717892",
      accent: "#3b4ea8",
      accentSoft: "rgba(59,78,168,0.1)",
      rule: "#d8dce8",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 16,
    },
  },
  {
    id: "forest-ink",
    name: "Forest Ink",
    nameZh: "森墨",
    mood: ["dark", "natural", "calm"],
    tokens: {
      shell: "#0c1410",
      surface: "#14201a",
      surface2: "#1b2a22",
      text: "#e4efe6",
      textMute: "#7d9484",
      accent: "#5fbf7d",
      accentSoft: "rgba(95,191,125,0.13)",
      rule: "#243429",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 10,
    },
  },
  {
    id: "kraft-paper",
    name: "Kraft Paper",
    nameZh: "牛皮紙",
    mood: ["light", "warm", "handmade"],
    tokens: {
      shell: "#e9ddc7",
      surface: "#f3ead8",
      surface2: "#ddccae",
      text: "#3a2f20",
      textMute: "#8a7958",
      accent: "#bd5a2a",
      accentSoft: "rgba(189,90,42,0.14)",
      rule: "#cdb892",
      fontDisplay: SERIF,
      fontBody: SANS,
      radiusCard: 6,
    },
  },
  {
    id: "swiss-ikb",
    name: "Swiss IKB",
    nameZh: "瑞士國際藍",
    mood: ["light", "minimal", "swiss"],
    tokens: {
      shell: "#ffffff",
      surface: "#f4f4f4",
      surface2: "#002fa7",
      text: "#0a0a0a",
      textMute: "#6a6a6a",
      accent: "#002fa7",
      accentSoft: "rgba(0,47,167,0.1)",
      rule: "#e0e0e0",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 0,
    },
  },
  {
    id: "reveal-black",
    name: "Reveal Black",
    nameZh: "Reveal 黑",
    mood: ["dark", "reveal"],
    tokens: {
      shell: "#222222",
      surface: "#2a2a2a",
      surface2: "#333333",
      text: "#ffffff",
      textMute: "#bbbbbb",
      accent: "#42affa",
      accentSoft: "rgba(66,175,250,0.15)",
      rule: "#444444",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "radial-gradient(circle at 15% 10%, rgba(19,218,236,.08), rgba(0,0,0,0) 42%)",
      letterSpacing: "0.01em",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.02em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-white",
    name: "Reveal White",
    nameZh: "Reveal 白",
    mood: ["light", "reveal"],
    tokens: {
      shell: "#ffffff",
      surface: "#f5f5f5",
      surface2: "#ebebeb",
      text: "#222222",
      textMute: "#666666",
      accent: "#2a76dd",
      accentSoft: "rgba(42,118,221,0.15)",
      rule: "#cccccc",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "linear-gradient(160deg, rgba(139,116,61,.06), rgba(0,0,0,0) 45%)",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.01em",
      "--reveal-heading-weight": "600",
    },
  },
  {
    id: "reveal-league",
    name: "Reveal League",
    nameZh: "Reveal 聯盟",
    mood: ["dark", "reveal"],
    tokens: {
      shell: "#2b2b2b",
      surface: "#333333",
      surface2: "#3a3a3a",
      text: "#eeeeee",
      textMute: "#aaaaaa",
      accent: "#13DAEC",
      accentSoft: "rgba(19,218,236,0.15)",
      rule: "#555555",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "linear-gradient(180deg, rgba(59,117,158,.08), rgba(0,0,0,0) 40%)",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.015em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-beige",
    name: "Reveal Beige",
    nameZh: "Reveal 米色",
    mood: ["light", "reveal"],
    tokens: {
      shell: "#f7f3de",
      surface: "#ffffff",
      surface2: "#e8e1c3",
      text: "#333333",
      textMute: "#777777",
      accent: "#8b743d",
      accentSoft: "rgba(139,116,61,0.15)",
      rule: "#dcd2af",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "radial-gradient(circle at 80% 10%, rgba(231,173,82,.07), rgba(0,0,0,0) 45%)",
      letterSpacing: "0.01em",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.01em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-sky",
    name: "Reveal Sky",
    nameZh: "Reveal 天空",
    mood: ["light", "reveal"],
    tokens: {
      shell: "#f7fbfc",
      surface: "#ffffff",
      surface2: "#e4edf5",
      text: "#333333",
      textMute: "#777777",
      accent: "#3b759e",
      accentSoft: "rgba(59,117,158,0.15)",
      rule: "#d0dee9",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "linear-gradient(180deg, rgba(81,72,61,.07), rgba(0,0,0,0) 42%)",
    },
  },
  {
    id: "reveal-night",
    name: "Reveal Night",
    nameZh: "Reveal 夜晚",
    mood: ["dark", "reveal"],
    tokens: {
      shell: "#111111",
      surface: "#1a1a1a",
      surface2: "#222222",
      text: "#eeeeee",
      textMute: "#aaaaaa",
      accent: "#e7ad52",
      accentSoft: "rgba(231,173,82,0.15)",
      rule: "#444444",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    revealCss: {
      "--reveal-heading-transform": "uppercase",
      "--reveal-heading-letter-spacing": "0.02em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-serif",
    name: "Reveal Serif",
    nameZh: "Reveal 襯線",
    mood: ["light", "reveal"],
    tokens: {
      shell: "#F0F1EB",
      surface: "#ffffff",
      surface2: "#e1e3d8",
      text: "#000000",
      textMute: "#666666",
      accent: "#51483D",
      accentSoft: "rgba(81,72,61,0.15)",
      rule: "#d0d2c5",
      fontDisplay: SERIF,
      fontBody: SERIF,
      radiusCard: 4,
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.005em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-simple",
    name: "Reveal Simple",
    nameZh: "Reveal 簡約",
    mood: ["light", "reveal"],
    tokens: {
      shell: "#ffffff",
      surface: "#fafafa",
      surface2: "#f0f0f0",
      text: "#000000",
      textMute: "#666666",
      accent: "#00008B",
      accentSoft: "rgba(0,0,139,0.15)",
      rule: "#dddddd",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 0,
    },
    stageStyle: {
      backgroundImage: "none",
      letterSpacing: "0",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0",
      "--reveal-heading-weight": "600",
    },
  },
  {
    id: "reveal-solarized",
    name: "Reveal Solarized",
    nameZh: "Reveal 日光",
    mood: ["light", "reveal"],
    tokens: {
      shell: "#fdf6e3",
      surface: "#ffffff",
      surface2: "#eee8d5",
      text: "#657b83",
      textMute: "#93a1a1",
      accent: "#268bd2",
      accentSoft: "rgba(38,139,210,0.15)",
      rule: "#d0c8b6",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "linear-gradient(180deg, rgba(38,139,210,.08), rgba(0,0,0,0) 40%)",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.01em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-blood",
    name: "Reveal Blood",
    nameZh: "Reveal 血色",
    mood: ["dark", "reveal"],
    tokens: {
      shell: "#222222",
      surface: "#2a2a2a",
      surface2: "#333333",
      text: "#eeeeee",
      textMute: "#aaaaaa",
      accent: "#a23",
      accentSoft: "rgba(170,34,51,0.15)",
      rule: "#555555",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "radial-gradient(circle at 50% 0%, rgba(170,34,51,.13), rgba(0,0,0,0) 43%)",
    },
    revealCss: {
      "--reveal-heading-transform": "uppercase",
      "--reveal-heading-letter-spacing": "0.03em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-moon",
    name: "Reveal Moon",
    nameZh: "Reveal 月光",
    mood: ["dark", "reveal"],
    tokens: {
      shell: "#002b36",
      surface: "#003643",
      surface2: "#004050",
      text: "#93a1a1",
      textMute: "#586e75",
      accent: "#268bd2",
      accentSoft: "rgba(38,139,210,0.15)",
      rule: "#00556a",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 4,
    },
    stageStyle: {
      backgroundImage: "linear-gradient(180deg, rgba(38,139,210,.09), rgba(0,0,0,0) 40%)",
      letterSpacing: "0.005em",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.01em",
      "--reveal-heading-weight": "700",
    },
  },
  {
    id: "reveal-dracula",
    name: "Reveal Dracula",
    nameZh: "Reveal 德古拉",
    mood: ["dark", "reveal", "modern"],
    tokens: {
      shell: "#282a36",
      surface: "#323544",
      surface2: "#3a3d4f",
      text: "#f8f8f2",
      textMute: "#b8bfd8",
      accent: "#bd93f9",
      accentSoft: "rgba(189,147,249,0.16)",
      rule: "#4b5070",
      fontDisplay: SANS,
      fontBody: SANS,
      radiusCard: 6,
    },
    stageStyle: {
      backgroundImage: "radial-gradient(circle at 20% 8%, rgba(189,147,249,.16), rgba(0,0,0,0) 44%)",
      letterSpacing: "0.01em",
    },
    revealCss: {
      "--reveal-heading-transform": "none",
      "--reveal-heading-letter-spacing": "0.012em",
      "--reveal-heading-weight": "700",
    },
  },
];

export const DEFAULT_THEME_ID = "midnight-press";

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

/** 把主題 token 轉成 CSS 變數物件（可直接放進 style）。 */
export function themeToCssVars(
  theme: Theme,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const t = theme.tokens;
  const vars: Record<string, string> = {
    "--shell": t.shell,
    "--surface": t.surface,
    "--surface-2": t.surface2,
    "--text": t.text,
    "--text-mute": t.textMute,
    "--accent": t.accent,
    "--accent-soft": t.accentSoft,
    "--rule": t.rule,
    "--font-display": t.fontDisplay,
    "--font-body": t.fontBody,
    "--r-card": `${t.radiusCard}px`,
  };
  if (theme.revealCss) Object.assign(vars, theme.revealCss);
  return { ...vars, ...overrides };
}
