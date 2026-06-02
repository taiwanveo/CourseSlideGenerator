import { useMemo, useState } from "react";
import { TRANSITION_PRESETS } from "../engine/motion/catalog";
import { THEMES } from "../engine/themes/themes";
import type { OutlineNode } from "../model/types";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../model/types";
import { buildAssetMap } from "../renderer/assets";
import { SlideStage } from "../renderer/SlideStage";
import { useEditor } from "../store/editorStore";

const THUMB_W = 196;
const THUMB_H = (THUMB_W * CANVAS_HEIGHT) / CANVAS_WIDTH;

export function SlidePanel() {
  const project = useEditor((s) => s.project);
  const currentId = useEditor((s) => s.currentSlideId);
  const selectSlide = useEditor((s) => s.selectSlide);
  const addSlide = useEditor((s) => s.addSlide);
  const deleteSlide = useEditor((s) => s.deleteSlide);
  const moveSlide = useEditor((s) => s.moveSlide);
  const applyThemeToSlides = useEditor((s) => s.applyThemeToSlides);
  const applyTransitionToSlides = useEditor((s) => s.applyTransitionToSlides);
  const assets = buildAssetMap(project.assets);
  const scale = THUMB_W / CANVAS_WIDTH;
  const [selectedSlides, setSelectedSlides] = useState<string[]>([]);
  const [batchThemeId, setBatchThemeId] = useState(project.theme.id);
  const [batchTransition, setBatchTransition] = useState("crossfade");
  const revealThemes = useMemo(() => THEMES.filter((t) => t.id.startsWith("reveal-")), []);
  const customThemes = useMemo(() => THEMES.filter((t) => !t.id.startsWith("reveal-")), []);
  const outline = project.source.outline;
  const slideTextIndex = project.deck.slides.map((slide) => {
    const texts: string[] = [];
    for (const el of slide.elements) {
      if (el.type === "text") texts.push(el.content.spans.map((s) => s.text).join(""));
      if (el.type === "list") {
        texts.push(...el.items.map((it) => it.spans.map((s) => s.text).join("")));
      }
    }
    return texts.join(" ").toLowerCase();
  });

  const findOutlineTargetSlide = (text: string): string | null => {
    const needle = text.trim().toLowerCase();
    if (!needle) return null;
    const hit = slideTextIndex.findIndex((t) => t.includes(needle));
    return hit >= 0 ? project.deck.slides[hit]!.id : null;
  };

  const toggleSlideSelection = (slideId: string, additive: boolean) => {
    setSelectedSlides((prev) => {
      if (!additive) return [slideId];
      return prev.includes(slideId) ? prev.filter((x) => x !== slideId) : [...prev, slideId];
    });
  };

  return (
    <div
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: "1px solid var(--app-border)",
        background: "var(--app-panel)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--app-border)",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--app-muted)" }}>頁面 {project.deck.slides.length}</span>
        <button className="csg-btn" onClick={addSlide}>＋ 新頁</button>
      </div>
      {outline.length > 0 && (
        <div style={{ borderBottom: "1px solid var(--app-border)", padding: "10px 12px", maxHeight: 240, overflowY: "auto" }}>
          <div style={{ fontSize: 11, color: "var(--app-muted)", textTransform: "uppercase", marginBottom: 8 }}>大綱對位</div>
          <OutlineTree
            nodes={outline}
            depth={0}
            onClickNode={(text) => {
              const slideId = findOutlineTargetSlide(text);
              if (slideId) {
                selectSlide(slideId);
                document.getElementById("editor-canvas")?.focus();
              }
            }}
            isCovered={(text) => !!findOutlineTargetSlide(text)}
          />
        </div>
      )}
      <div style={{ borderBottom: "1px solid var(--app-border)", padding: "10px 12px", display: "grid", gap: 6 }}>
        <div style={{ fontSize: 11, color: "var(--app-muted)", textTransform: "uppercase" }}>
          批次頁面操作（已選 {selectedSlides.length}）
        </div>
        <select className="csg-select" value={batchThemeId} onChange={(e) => setBatchThemeId(e.target.value)}>
          <optgroup label="原創主題">
            {customThemes.map((t) => <option key={t.id} value={t.id}>{t.nameZh}</option>)}
          </optgroup>
          <optgroup label="Reveal.js">
            {revealThemes.map((t) => <option key={t.id} value={t.id}>{t.nameZh}</option>)}
          </optgroup>
        </select>
        <button
          className="csg-btn-sm"
          disabled={selectedSlides.length === 0}
          onClick={() => applyThemeToSlides(selectedSlides, batchThemeId)}
        >
          套用主題到已選頁
        </button>
        <select className="csg-select" value={batchTransition} onChange={(e) => setBatchTransition(e.target.value)}>
          {TRANSITION_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.nameZh}</option>)}
        </select>
        <button
          className="csg-btn-sm"
          disabled={selectedSlides.length === 0}
          onClick={() => applyTransitionToSlides(selectedSlides, batchTransition)}
        >
          套用轉場到已選頁
        </button>
      </div>
      <div style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {project.deck.slides.map((slide, i) => {
          const active = slide.id === currentId;
          return (
            <div key={slide.id} style={{ position: "relative" }}>
              <div
                onClick={() => {
                  selectSlide(slide.id);
                  toggleSlideSelection(slide.id, false);
                  document.getElementById("editor-canvas")?.focus();
                }}
                onMouseDown={(e) => {
                  if (e.ctrlKey || e.metaKey) toggleSlideSelection(slide.id, true);
                }}
                style={{
                  width: THUMB_W,
                  height: THUMB_H,
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  outline: selectedSlides.includes(slide.id)
                    ? "2px solid var(--app-accent)"
                    : active
                      ? "2px solid var(--accent, #ff4a2b)"
                      : "1px solid var(--app-border)",
                  position: "relative",
                  background: "#000",
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
                  <SlideStage slide={slide} theme={project.theme} assets={assets} />
                </div>
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    bottom: 6,
                    fontSize: 11,
                    color: "#fff",
                    background: "rgba(0,0,0,.55)",
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              {active && (
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button className="csg-btn-sm" onClick={() => moveSlide(slide.id, -1)}>↑</button>
                  <button className="csg-btn-sm" onClick={() => moveSlide(slide.id, 1)}>↓</button>
                  <button
                    className="csg-btn-sm"
                    onClick={() => deleteSlide(slide.id)}
                    disabled={project.deck.slides.length <= 1}
                  >
                    刪
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutlineTree({
  nodes,
  depth,
  onClickNode,
  isCovered,
}: {
  nodes: OutlineNode[];
  depth: number;
  onClickNode: (text: string) => void;
  isCovered: (text: string) => boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {nodes.map((node, idx) => {
        const covered = isCovered(node.text);
        return (
          <div key={`${depth}-${idx}-${node.text.slice(0, 20)}`}>
            <button
              className="csg-btn-sm"
              onClick={() => onClickNode(node.text)}
              style={{
                width: "100%",
                justifyContent: "flex-start",
                textAlign: "left",
                paddingLeft: 8 + depth * 12,
                borderColor: covered ? "var(--app-border)" : "#b45a5a",
                color: covered ? "var(--app-text)" : "#ff9b9b",
                background: covered ? "var(--app-panel-2)" : "rgba(180,90,90,.12)",
              }}
              title={covered ? "已對位到投影片" : "尚未找到對位投影片"}
            >
              {covered ? "✓ " : "• "}
              {node.text}
            </button>
            {node.children.length > 0 && (
              <OutlineTree nodes={node.children} depth={depth + 1} onClickNode={onClickNode} isCovered={isCovered} />
            )}
          </div>
        );
      })}
    </div>
  );
}
