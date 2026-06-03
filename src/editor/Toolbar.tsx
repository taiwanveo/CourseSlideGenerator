import { useEffect, useRef, useState } from "react";
import { THEMES } from "../engine/themes/themes";
import { createListElement, createShapeElement, createTextElement } from "../model/factory";
import type { ShapeElement } from "../model/types";
import { useEditor } from "../store/editorStore";
import { useSettings } from "../store/settingsStore";
import { generateTheme } from "../engine/ai/generate";

interface Props {
  onOpenAI: () => void;
  onExport: () => void;
  onImport: () => void;
  onNewFile: () => void;
  onPlay: () => void;
  onOpenLibrary: () => void;
  onOpenImage: () => void;
  onOpenAudio: () => void;
  onOpenSettings: () => void;
  onOpenSnapshots: () => void;
}

const SHAPE_OPTIONS: Array<{ shape: ShapeElement["shape"]; label: string; glyph: string }> = [
  { shape: "rect", label: "矩形", glyph: "▭" },
  { shape: "ellipse", label: "圓形", glyph: "◯" },
  { shape: "triangle", label: "三角形", glyph: "△" },
  { shape: "line", label: "線條", glyph: "／" },
  { shape: "arrow", label: "箭頭", glyph: "→" },
];
const TITLE_INPUT_WIDTH = 220;
const LINK_PREFS_KEY = "csg-link-panel-prefs-v1";
const TITLE_INPUT_VISIBLE_CHARS = 20;
const TITLE_INPUT_WIDTH_EM = (TITLE_INPUT_VISIBLE_CHARS * 20) / 14;

const ICON_NEW_FILE = "/toolbar-icons/new-file.png";
const ICON_SNAPSHOT = "/toolbar-icons/snapshot.png?v=20260602";
const ICON_OPEN_OLD = "/toolbar-icons/open-old.png";
const ICON_TEXT = "/toolbar-icons/text.png";
const ICON_BULLET = "/toolbar-icons/bullet.png";
const ICON_PICTURE = "/toolbar-icons/picture.png";
const ICON_MUSIC = "/toolbar-icons/music.png";
const ICON_SHAPE = "/toolbar-icons/shape.png";
const ICON_LINK = "/toolbar-icons/link.png";

export function Toolbar({
  onOpenAI,
  onExport,
  onImport,
  onNewFile,
  onPlay,
  onOpenLibrary,
  onOpenImage,
  onOpenAudio,
  onOpenSettings,
  onOpenSnapshots,
}: Props) {
  const title = useEditor((s) => s.project.meta.title);
  const themeId = useEditor((s) => s.project.theme.id);
  const setTheme = useEditor((s) => s.setTheme);
  const setTitle = useEditor((s) => s.setTitle);
  const addElement = useEditor((s) => s.addElement);
  const slides = useEditor((s) => s.project.deck.slides);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  const [shapeMenu, setShapeMenu] = useState(false);
  const [compactToolbar, setCompactToolbar] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1760 : false,
  );
  const [shapeMenuPos, setShapeMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [linkMenuPos, setLinkMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [linkMenu, setLinkMenu] = useState(false);
  const [linkText, setLinkText] = useState("連結");
  const [linkKind, setLinkKind] = useState<"url" | "slide">("url");
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkTarget, setLinkTarget] = useState<"self" | "blank">("blank");
  const [linkSlideId, setLinkSlideId] = useState("");
  const shapeWrapRef = useRef<HTMLDivElement>(null);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const linkWrapRef = useRef<HTMLDivElement>(null);
  const linkMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shapeMenu && !linkMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inShapeButton = !!shapeWrapRef.current?.contains(target);
      const inShapeMenu = !!shapeMenuRef.current?.contains(target);
      const inLinkButton = !!linkWrapRef.current?.contains(target);
      const inLinkMenu = !!linkMenuRef.current?.contains(target);
      if (!inShapeButton && !inShapeMenu) setShapeMenu(false);
      if (!inLinkButton && !inLinkMenu) setLinkMenu(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [shapeMenu, linkMenu]);

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth < 1760;
      setCompactToolbar(compact);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const standardThemes = THEMES.filter((t) => !t.id.startsWith("reveal-"));
  const revealThemes = THEMES.filter((t) => t.id.startsWith("reveal-"));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LINK_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        text: string;
        kind: "url" | "slide";
        url: string;
        target: "self" | "blank";
      }>;
      if (typeof parsed.text === "string") setLinkText(parsed.text);
      if (parsed.kind === "url" || parsed.kind === "slide") setLinkKind(parsed.kind);
      if (typeof parsed.url === "string") setLinkUrl(parsed.url);
      if (parsed.target === "self" || parsed.target === "blank") setLinkTarget(parsed.target);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LINK_PREFS_KEY,
        JSON.stringify({
          text: linkText,
          kind: linkKind,
          url: linkUrl,
          target: linkTarget,
        }),
      );
    } catch {
      // ignore
    }
  }, [linkText, linkKind, linkUrl, linkTarget]);
  useEffect(() => {
    if (!linkSlideId && slides[0]) setLinkSlideId(slides[0].id);
  }, [slides, linkSlideId]);

  const createLinkElement = () => {
    const el = createTextElement(linkText || "連結", { x: 760, y: 540 }, { color: "var(--accent)" });
    if (linkKind === "slide") {
      const fallback = slides[0]?.id;
      const value = linkSlideId || fallback;
      if (!value) return;
      el.link = { kind: "slide", value };
    } else {
      const trimmed = linkUrl.trim();
      if (!trimmed) return;
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      el.link = { kind: "url", value: href, target: linkTarget };
    }
    addElement(el);
    setLinkMenu(false);
  };

  return (
    <div
      style={{
        minHeight: 96,
        flexShrink: 0,
        borderBottom: "1px solid var(--app-border)",
        background: "var(--app-panel)",
        display: "grid",
        gridTemplateRows: "auto auto",
        gap: 2,
        padding: "2px 14px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          minWidth: 0,
          flexWrap: compactToolbar ? "wrap" : "nowrap",
          paddingBottom: compactToolbar ? 2 : 0,
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="未命名簡報"
          title="簡報名稱（可直接編輯）"
          style={{
            width: `${TITLE_INPUT_WIDTH_EM}em`,
            minWidth: `${TITLE_INPUT_WIDTH_EM}em`,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--app-text)",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: 6,
            padding: "5px 8px",
            marginRight: 6,
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "var(--app-canvas-bg)";
            e.currentTarget.style.borderColor = "var(--app-border)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }}
        />

        <div className="csg-divider" />
        <button className="csg-btn" onClick={onNewFile} title="開新檔案" aria-label="開新檔案">
          <img src={ICON_NEW_FILE} alt="開新檔案" style={{ width: 18, height: 18, objectFit: "contain" }} />
        </button>
        <button className="csg-btn" onClick={onOpenSnapshots} title="快照" aria-label="快照">
          <img src={ICON_SNAPSHOT} alt="快照" style={{ width: 18, height: 18, objectFit: "contain" }} />
        </button>
        <button className="csg-btn" onClick={onOpenLibrary} title="開啟舊檔" aria-label="開啟舊檔">
          <img src={ICON_OPEN_OLD} alt="開舊檔" style={{ width: 18, height: 18, objectFit: "contain" }} />
        </button>
        <button className="csg-btn" onClick={undo} disabled={!canUndo}>↶ 復原</button>
        <button className="csg-btn" onClick={redo} disabled={!canRedo}>↷ 重做</button>

        <div style={{ flex: 1, minWidth: 20 }} />
        <button className="csg-btn" onClick={onPlay} title="播放簡報（Ctrl+Alt+P / F12 / F5）">▶ 播放</button>
        <button className="csg-btn" onClick={onExport}>匯出</button>
        <button className="csg-btn" onClick={onImport}>匯入</button>
        <button className="csg-btn" onClick={onOpenSettings}>設定</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", minWidth: 0 }}>
        {/* 讓第二排與第一排「＋開新檔案」左側對齊 */}
        {!compactToolbar && <div style={{ width: TITLE_INPUT_WIDTH, minWidth: TITLE_INPUT_WIDTH, visibility: "hidden" }} />}
        {!compactToolbar && <div className="csg-divider" style={{ visibility: "hidden" }} />}

        <button className="csg-btn csg-btn-accent" onClick={onOpenAI}>✦ AI生成</button>
        <button className="csg-btn" onClick={() => addElement(createTextElement("輸入文字", { x: 760, y: 480 }))} title="新增文字">
          <img src={ICON_TEXT} alt="文字" style={{ width: 20, height: 20, objectFit: "contain" }} />
        </button>
        <button
          className="csg-btn"
          onClick={() => addElement(createListElement(["要點一", "要點二", "要點三"], false, { x: 560, y: 360 }))}
          title="新增條列"
        >
          <img src={ICON_BULLET} alt="條列" style={{ width: 20, height: 20, objectFit: "contain" }} />
        </button>
        <button className="csg-btn" onClick={onOpenImage} title="上傳圖片或 AI 生圖">
          <img src={ICON_PICTURE} alt="圖片" style={{ width: 20, height: 20, objectFit: "contain" }} />
        </button>
        <button className="csg-btn" onClick={onOpenAudio} title="上傳音訊或設定 BGM">
          <img src={ICON_MUSIC} alt="音樂" style={{ width: 20, height: 20, objectFit: "contain" }} />
        </button>
        <div ref={shapeWrapRef} style={{ position: "relative" }}>
          <button
            className="csg-btn"
            onClick={() => {
              if (!shapeMenu) {
                const rect = shapeWrapRef.current?.getBoundingClientRect();
                if (rect) setShapeMenuPos({ top: rect.bottom + 4, left: rect.left });
              }
              setShapeMenu((v) => !v);
            }}
          >
            <img src={ICON_SHAPE} alt="圖形" style={{ width: 20, height: 20, objectFit: "contain" }} />
          </button>
          {shapeMenu && (
            <div
              ref={shapeMenuRef}
              style={{
                position: "fixed",
                top: shapeMenuPos?.top ?? 0,
                left: shapeMenuPos?.left ?? 0,
                zIndex: 1200,
                background: "var(--app-panel)",
                border: "1px solid var(--app-border)",
                borderRadius: 8,
                padding: 4,
                minWidth: 140,
                boxShadow: "0 12px 32px rgba(0,0,0,.4)",
              }}
            >
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.shape}
                  className="csg-btn-sm"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    justifyContent: "flex-start",
                    textAlign: "left",
                  }}
                  onClick={() => {
                    addElement(createShapeElement(opt.shape, { x: 760, y: 440 }));
                    setShapeMenu(false);
                  }}
                >
                  <span style={{ width: 18, textAlign: "center" }}>{opt.glyph}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={linkWrapRef} style={{ position: "relative" }}>
          <button
            className="csg-btn"
            title="新增可點擊超連結"
            onClick={() => {
              if (!linkMenu) {
                const rect = linkWrapRef.current?.getBoundingClientRect();
                if (rect) setLinkMenuPos({ top: rect.bottom + 4, left: rect.left });
              }
              setLinkMenu((v) => !v);
            }}
          >
            <img src={ICON_LINK} alt="超連結" style={{ width: 20, height: 20, objectFit: "contain" }} />
          </button>
          {linkMenu && (
            <div
              ref={linkMenuRef}
              style={{
                position: "fixed",
                top: linkMenuPos?.top ?? 0,
                left: linkMenuPos?.left ?? 0,
                zIndex: 1200,
                background: "var(--app-panel)",
                border: "1px solid var(--app-border)",
                borderRadius: 8,
                padding: 8,
                width: 260,
                boxShadow: "0 12px 32px rgba(0,0,0,.4)",
                display: "grid",
                gap: 6,
              }}
            >
              <input className="csg-input" value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="顯示文字" />
              <select className="csg-select" value={linkKind} onChange={(e) => setLinkKind(e.target.value as "url" | "slide")}>
                <option value="url">網址連結</option>
                <option value="slide">頁內跳轉</option>
              </select>
              {linkKind === "url" ? (
                <>
                  <input className="csg-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
                  <select className="csg-select" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value as "self" | "blank")}>
                    <option value="blank">新分頁開啟</option>
                    <option value="self">同分頁開啟</option>
                  </select>
                </>
              ) : (
                <select className="csg-select" value={linkSlideId} onChange={(e) => setLinkSlideId(e.target.value)}>
                  {slides.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      第 {i + 1} 頁
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
                <button className="csg-btn-sm" onClick={() => setLinkMenu(false)}>取消</button>
                <button className="csg-btn-sm" onClick={createLinkElement}>新增</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 20 }} />
        <label style={{ fontSize: 12, color: "var(--app-muted)" }}>主題</label>
        <select
          className="csg-select"
          value={themeId}
          onChange={async (e) => {
            const val = e.target.value;
            if (val === "ai-theme") {
              const promptStr = window.prompt("請輸入想要的簡報風格 (例如：科技藍色風格)：");
              if (!promptStr) return;
              const creds = useSettings.getState().credentials();
              if (!creds) {
                alert("請先在右上角設定 AI API Key");
                return;
              }
              try {
                const tokens = await generateTheme(promptStr, creds);
                useEditor.getState().setThemeOverrides(tokens as Record<string, string>);
                setTheme(themeId);
              } catch (err) {
                alert(String(err));
              }
            } else {
              useEditor.getState().setThemeOverrides({});
              setTheme(val);
            }
          }}
          style={{ width: 180 }}
        >
          <option value="ai-theme">✦ AI 生成風格</option>
          <optgroup label="原創主題">
            {standardThemes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameZh}
              </option>
            ))}
          </optgroup>
          {revealThemes.length > 0 && (
            <optgroup label="Reveal.js">
              {revealThemes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameZh}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        </div>
    </div>
  );
}
