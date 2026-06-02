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
  onNewFile: () => void;
  onPlay: () => void;
  onOpenLibrary: () => void;
  onOpenImage: () => void;
  onOpenAudio: () => void;
  onOpenSettings: () => void;
  onRelayout: () => void;
  onOpenSnapshots: () => void;
}

const SHAPE_OPTIONS: Array<{ shape: ShapeElement["shape"]; label: string; glyph: string }> = [
  { shape: "rect", label: "矩形", glyph: "▭" },
  { shape: "ellipse", label: "圓形", glyph: "◯" },
  { shape: "triangle", label: "三角形", glyph: "△" },
  { shape: "line", label: "線條", glyph: "／" },
  { shape: "arrow", label: "箭頭", glyph: "→" },
];

export function Toolbar({
  onOpenAI,
  onExport,
  onNewFile,
  onPlay,
  onOpenLibrary,
  onOpenImage,
  onOpenAudio,
  onOpenSettings,
  onRelayout,
  onOpenSnapshots,
}: Props) {
  const title = useEditor((s) => s.project.meta.title);
  const themeId = useEditor((s) => s.project.theme.id);
  const setTheme = useEditor((s) => s.setTheme);
  const setTitle = useEditor((s) => s.setTitle);
  const addElement = useEditor((s) => s.addElement);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  const [shapeMenu, setShapeMenu] = useState(false);
  const shapeWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shapeMenu) return;
    const onDown = (e: MouseEvent) => {
      if (shapeWrapRef.current && !shapeWrapRef.current.contains(e.target as Node)) setShapeMenu(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [shapeMenu]);

  const standardThemes = THEMES.filter((t) => !t.id.startsWith("reveal-"));
  const revealThemes = THEMES.filter((t) => t.id.startsWith("reveal-"));

  return (
    <div
      style={{
        height: 52,
        flexShrink: 0,
        borderBottom: "1px solid var(--app-border)",
        background: "var(--app-panel)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 14px",
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="未命名簡報"
        title="簡報名稱（可直接編輯）"
        style={{
          minWidth: 240,
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
      <button className="csg-btn" onClick={onNewFile}>＋ 開新檔案</button>
      <button className="csg-btn" onClick={onOpenLibrary} title="開啟已存檔的簡報">我的簡報</button>

      <div className="csg-divider" />
      <button className="csg-btn" onClick={undo} disabled={!canUndo}>↶ 復原</button>
      <button className="csg-btn" onClick={redo} disabled={!canRedo}>↷ 重做</button>

      <div className="csg-divider" />
      <button className="csg-btn" onClick={() => addElement(createTextElement("輸入文字", { x: 760, y: 480 }))}>
        ＋文字
      </button>
      <button
        className="csg-btn"
        onClick={() => addElement(createListElement(["要點一", "要點二", "要點三"], false, { x: 560, y: 360 }))}
      >
        ＋條列
      </button>
      <button className="csg-btn" onClick={onOpenImage} title="上傳圖片或 AI 生圖">＋圖片</button>
      <button className="csg-btn" onClick={onOpenAudio} title="上傳音訊或設定 BGM">♪ 音樂</button>
      <button className="csg-btn" onClick={onRelayout} title="自動重新排版，不改內容">重新排版</button>

      {/* ＋圖形 下拉選單 */}
      <div ref={shapeWrapRef} style={{ position: "relative" }}>
        <button className="csg-btn" onClick={() => setShapeMenu((v) => !v)}>＋圖形 ▾</button>
        {shapeMenu && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 50,
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

      <div className="csg-divider" />
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
              setTheme(themeId); // 觸發重繪但保持基底 id
            } catch (err) {
              alert(String(err));
            }
          } else {
            useEditor.getState().setThemeOverrides({});
            setTheme(val);
          }
        }}
        style={{ width: 160 }}
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

      <div style={{ flex: 1 }} />
      <button className="csg-btn" onClick={onPlay} title="播放簡報（Ctrl+Alt+P / F12 / F5）">
        ▶ 播放簡報
      </button>
      <button className="csg-btn csg-btn-accent" onClick={onOpenAI}>✦ AI 生成</button>
      <button className="csg-btn" onClick={onOpenSnapshots}>快照</button>
      <button className="csg-btn" onClick={onOpenSettings}>設定</button>
      <button className="csg-btn" onClick={onExport}>匯出</button>
    </div>
  );
}
