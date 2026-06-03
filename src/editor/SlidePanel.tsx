import { useEffect, useRef, useState } from "react";
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
  const setSlideSelection = useEditor((s) => s.setSlideSelection);
  const toggleSlideSelection = useEditor((s) => s.toggleSlideSelection);
  const selectSlideRangeTo = useEditor((s) => s.selectSlideRangeTo);
  const selectAllSlides = useEditor((s) => s.selectAllSlides);
  const selectedSlideIds = useEditor((s) => s.selectedSlideIds);
  const addSlide = useEditor((s) => s.addSlide);
  const deleteSlide = useEditor((s) => s.deleteSlide);
  const deleteSlides = useEditor((s) => s.deleteSlides);
  const moveSlideToIndex = useEditor((s) => s.moveSlideToIndex);
  const assets = buildAssetMap(project.assets);
  const scale = THUMB_W / CANVAS_WIDTH;
  const panelRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<{
    slideId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [hoveredSlideId, setHoveredSlideId] = useState<string | null>(null);
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null);
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isInput) return;
      const panelActive = !!(active && panelRef.current?.contains(active));
      const panelHot = panelActive || hoveredSlideId !== null;
      if (!panelHot) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllSlides();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedSlideIds.length === 0) return;
        const total = project.deck.slides.length;
        if (total - selectedSlideIds.length < 1) return;
        e.preventDefault();
        deleteSlides(selectedSlideIds);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSlides, hoveredSlideId, project.deck.slides.length, selectAllSlides, selectedSlideIds]);

  useEffect(() => {
    const updateDragTarget = (clientY: number) => {
      const entries = project.deck.slides
        .map((s) => ({ id: s.id, el: thumbRefs.current[s.id] }))
        .filter((x): x is { id: string; el: HTMLDivElement } => !!x.el);
      for (const item of entries) {
        const rect = item.el.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          setDragOverSlideId(item.id);
          setDragInsertSide(clientY < rect.top + rect.height / 2 ? "before" : "after");
          return;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (!drag.moved && (dx > 3 || dy > 3)) {
        drag.moved = true;
        suppressClickRef.current = true;
      }
      if (!drag.moved) return;
      setDraggingSlideId(drag.slideId);
      updateDragTarget(e.clientY);
    };

    const onPointerUp = () => {
      const drag = dragStateRef.current;
      if (!drag) return;
      if (drag.moved && dragOverSlideId) {
        const fromIndex = project.deck.slides.findIndex((x) => x.id === drag.slideId);
        const targetIndex = project.deck.slides.findIndex((x) => x.id === dragOverSlideId);
        if (fromIndex >= 0 && targetIndex >= 0) {
          let desired = dragInsertSide === "after" ? targetIndex + 1 : targetIndex;
          if (fromIndex < desired) desired -= 1;
          moveSlideToIndex(drag.slideId, desired);
        }
      }
      dragStateRef.current = null;
      setDraggingSlideId(null);
      setDragOverSlideId(null);
      setDragInsertSide("before");
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragInsertSide, dragOverSlideId, moveSlideToIndex, project.deck.slides]);

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
      <div ref={panelRef} tabIndex={0} style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {project.deck.slides.map((slide, i) => {
          const active = slide.id === currentId;
          const selected = selectedSlideIds.includes(slide.id);
          return (
            <div key={slide.id} style={{ position: "relative" }}>
              <div
                ref={(el) => {
                  thumbRefs.current[slide.id] = el;
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  dragStateRef.current = {
                    slideId: slide.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    moved: false,
                  };
                  setDragOverSlideId(slide.id);
                  setDragInsertSide("before");
                }}
                onMouseEnter={() => setHoveredSlideId(slide.id)}
                onMouseLeave={() => setHoveredSlideId((prev) => (prev === slide.id ? null : prev))}
                onClick={(e) => {
                  if (suppressClickRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  panelRef.current?.focus();
                  if (e.shiftKey) {
                    selectSlideRangeTo(slide.id);
                  } else if (e.ctrlKey || e.metaKey) {
                    toggleSlideSelection(slide.id);
                  } else {
                    selectSlide(slide.id);
                    setSlideSelection([slide.id], slide.id);
                  }
                  document.getElementById("editor-canvas")?.focus();
                }}
                style={{
                  width: THUMB_W,
                  height: THUMB_H,
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  outline: selected
                    ? "2px solid var(--app-accent)"
                    : active
                      ? "2px solid var(--accent, #ff4a2b)"
                      : "1px solid var(--app-border)",
                  boxShadow: dragOverSlideId === slide.id ? "0 0 0 2px rgba(120,170,255,.65) inset" : undefined,
                  position: "relative",
                  background: "#000",
                  opacity: draggingSlideId === slide.id ? 0.65 : 1,
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
                  <SlideStage slide={slide} theme={project.theme} assets={assets} />
                </div>
                {dragOverSlideId === slide.id && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: 0,
                      borderTop: "2px solid #6fb0ff",
                      top: dragInsertSide === "before" ? 0 : undefined,
                      bottom: dragInsertSide === "after" ? 0 : undefined,
                      boxShadow: "0 0 0 1px rgba(111,176,255,.25)",
                      pointerEvents: "none",
                    }}
                  />
                )}
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
                {hoveredSlideId === slide.id && (
                  <>
                    <button
                      className="csg-btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSlide(slide.id);
                      }}
                      disabled={project.deck.slides.length <= 1}
                      title="刪除這一頁"
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        minWidth: 22,
                        width: 22,
                        height: 22,
                        padding: 0,
                        borderRadius: 999,
                        border: "1px solid rgba(255,100,100,.85)",
                        background: "rgba(220,40,40,.95)",
                        color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
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
