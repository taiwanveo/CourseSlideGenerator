/**
 * 編輯畫布 — 縮放舞台 + 互動層（選取 / 移動 / 縮放 / 旋轉 / 對齊輔助線）。
 * 渲染交給共用 SlideStage；本層只負責互動與設計感控點。
 */
import { useCallback, useRef, useState, useEffect } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../model/types";
import type { Element, Slide } from "../model/types";
import { buildAssetMap } from "../renderer/assets";
import { SlideStage } from "../renderer/SlideStage";
import { useStageScale } from "../renderer/useStageScale";
import { useEditor } from "../store/editorStore";
import { resizeTransform, rotationFromPointer, type Vec } from "./geometry";
import { SelectionOverlay, type HandleId, type ScreenRect } from "./SelectionOverlay";
import { TextAutoSizer } from "./TextAutoSizer";

interface Guide {
  axis: "x" | "y";
  pos: number; // design coord
}

interface DragState {
  mode: "move" | "resize" | "rotate";
  handle?: Exclude<HandleId, "rotate">;
  startPointer: Vec;
  startTransforms: Record<string, Element["transform"]>;
  ids: string[];
}

const SNAP = 8; // design-px 吸附閾值

export function EditorCanvas() {
  const project = useEditor((s) => s.project);
  const slide = useEditor((s) => s.project.deck.slides.find((x) => x.id === s.currentSlideId));
  const selection = useEditor((s) => s.selection);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const clearSelection = useEditor((s) => s.clearSelection);
  const updateTransform = useEditor((s) => s.updateTransform);
  const commit = useEditor((s) => s.commit);
  const reorderElement = useEditor((s) => s.reorderElement);
  const deleteSelected = useEditor((s) => s.deleteSelected);

  const { ref, scale, offsetX, offsetY } = useStageScale(CANVAS_WIDTH, CANVAS_HEIGHT);
  const dragRef = useRef<DragState | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (contextMenu) {
      window.addEventListener("pointerdown", closeMenu);
      return () => window.removeEventListener("pointerdown", closeMenu);
    }
  }, [contextMenu, closeMenu]);

  const assets = buildAssetMap(project.assets);

  const toDesign = useCallback(
    (clientX: number, clientY: number): Vec => {
      const host = ref.current;
      if (!host) return { x: 0, y: 0 };
      const r = host.getBoundingClientRect();
      return {
        x: (clientX - r.left - offsetX) / scale,
        y: (clientY - r.top - offsetY) / scale,
      };
    },
    [ref, offsetX, offsetY, scale],
  );

  const onElementDown = (el: Element, e: React.PointerEvent) => {
    e.stopPropagation();
    const additive = e.shiftKey;
    if (!selection.includes(el.id)) toggleSelect(el.id, additive);
    if (el.locked) return;
    commit();
    const ids = selection.includes(el.id) && selection.length > 0 ? selection : [el.id];
    startDrag("move", undefined, e, ids);
  };

  const onHandleDown = (handle: HandleId, e: React.PointerEvent) => {
    e.stopPropagation();
    commit();
    if (handle === "rotate") startDrag("rotate", undefined, e, selection);
    else startDrag("resize", handle, e, selection);
  };

  const startDrag = (
    mode: DragState["mode"],
    handle: Exclude<HandleId, "rotate"> | undefined,
    e: React.PointerEvent,
    ids: string[],
  ) => {
    if (!slide) return;
    const startTransforms: Record<string, Element["transform"]> = {};
    for (const id of ids) {
      const el = slide.elements.find((x) => x.id === id);
      if (el) startTransforms[id] = { ...el.transform };
    }
    dragRef.current = {
      mode,
      handle,
      startPointer: toDesign(e.clientX, e.clientY),
      startTransforms,
      ids,
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const computeSnap = (slide: Slide, movingIds: string[], x: number, y: number, w: number, h: number) => {
    const targets: number[] = [0, CANVAS_WIDTH / 2, CANVAS_WIDTH];
    const targetsY: number[] = [0, CANVAS_HEIGHT / 2, CANVAS_HEIGHT];
    for (const el of slide.elements) {
      if (movingIds.includes(el.id)) continue;
      const t = el.transform;
      targets.push(t.x, t.x + t.width / 2, t.x + t.width);
      targetsY.push(t.y, t.y + t.height / 2, t.y + t.height);
    }
    const found: Guide[] = [];
    let dx = 0;
    let dy = 0;
    const xs = [x, x + w / 2, x + w];
    for (const cand of targets) {
      for (const xc of xs) {
        if (Math.abs(xc - cand) <= SNAP) {
          dx = cand - xc;
          found.push({ axis: "x", pos: cand });
          break;
        }
      }
    }
    const ys = [y, y + h / 2, y + h];
    for (const cand of targetsY) {
      for (const yc of ys) {
        if (Math.abs(yc - cand) <= SNAP) {
          dy = cand - yc;
          found.push({ axis: "y", pos: cand });
          break;
        }
      }
    }
    return { dx, dy, found };
  };

  const onMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const cur = useEditor.getState();
      const s = cur.project.deck.slides.find((x) => x.id === cur.currentSlideId);
      if (!drag || !s) return;
      const p = toDesign(e.clientX, e.clientY);

      if (drag.mode === "move") {
        let ddx = p.x - drag.startPointer.x;
        let ddy = p.y - drag.startPointer.y;
        // 以第一個被選元素做吸附
        const firstId = drag.ids[0];
        const start0 = firstId ? drag.startTransforms[firstId] : undefined;
        if (start0) {
          const nx = start0.x + ddx;
          const ny = start0.y + ddy;
          const snap = computeSnap(s, drag.ids, nx, ny, start0.width, start0.height);
          ddx += snap.dx;
          ddy += snap.dy;
          setGuides(snap.found);
          setSizeLabel(`${Math.round(nx + snap.dx)}, ${Math.round(ny + snap.dy)}`);
        }
        for (const id of drag.ids) {
          const st = drag.startTransforms[id];
          if (st) updateTransform(id, { x: st.x + ddx, y: st.y + ddy }, false);
        }
      } else if (drag.mode === "resize" && drag.handle) {
        const id = drag.ids[0];
        const st = id ? drag.startTransforms[id] : undefined;
        if (id && st) {
          const next = resizeTransform({ ...st }, drag.handle, p);
          updateTransform(id, next, false);
          setSizeLabel(`${Math.round(next.width)} × ${Math.round(next.height)}`);
        }
      } else if (drag.mode === "rotate") {
        const id = drag.ids[0];
        const st = id ? drag.startTransforms[id] : undefined;
        if (id && st) {
          const deg = rotationFromPointer({ ...st }, p, e.shiftKey);
          updateTransform(id, { rotation: deg }, false);
          setSizeLabel(`${Math.round(deg)}°`);
        }
      }
    },
    [toDesign, updateTransform],
  );

  const onUp = useCallback(() => {
    dragRef.current = null;
    setSizeLabel(null);
    setGuides([]);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);

  if (!slide) {
    return <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--app-muted)" }}>無頁面</div>;
  }

  const screenRectFor = (el: Element): ScreenRect => {
    const t = el.transform;
    return {
      left: offsetX + t.x * scale,
      top: offsetY + t.y * scale,
      width: t.width * scale,
      height: t.height * scale,
      rotation: t.rotation,
    };
  };

  return (
    <div
      ref={ref}
      id="editor-canvas"
      tabIndex={-1}
      onPointerDown={(e) => {
        clearSelection();
        e.currentTarget.focus();
      }}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "var(--app-canvas-bg, #15140f)",
        outline: "none",
      }}
    >
      {/* 文字方塊自動量測（離螢幕） */}
      <TextAutoSizer slide={slide} theme={project.theme} />
      {/* 縮放後的舞台 */}
      <div
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: CANVAS_WIDTH * scale,
          height: CANVAS_HEIGHT * scale,
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
        }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <SlideStage slide={slide} theme={project.theme} assets={assets} />
        </div>

        {/* 互動命中層（同尺度，design-px 座標） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
          }}
        >
          {slide.elements
            .slice()
            .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
            .map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => onElementDown(el, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selection.includes(el.id)) toggleSelect(el.id, false);
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }}
                style={{
                  position: "absolute",
                  left: el.transform.x,
                  top: el.transform.y,
                  width: el.transform.width,
                  height: el.transform.height,
                  transform: el.transform.rotation ? `rotate(${el.transform.rotation}deg)` : undefined,
                  cursor: "move",
                  zIndex: el.transform.zIndex,
                }}
              />
            ))}
        </div>
      </div>

      {/* 對齊輔助線（螢幕座標） */}
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div
            key={`gx${i}`}
            style={{
              position: "absolute",
              left: offsetX + g.pos * scale,
              top: offsetY,
              width: 1,
              height: CANVAS_HEIGHT * scale,
              background: "var(--accent, #ff4a2b)",
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            key={`gy${i}`}
            style={{
              position: "absolute",
              left: offsetX,
              top: offsetY + g.pos * scale,
              width: CANVAS_WIDTH * scale,
              height: 1,
              background: "var(--accent, #ff4a2b)",
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
        ),
      )}

      {/* 選取控點 */}
      {selection.map((id) => {
        const el = slide.elements.find((x) => x.id === id);
        if (!el) return null;
        return (
          <SelectionOverlay
            key={id}
            rect={screenRectFor(el)}
            isGroup={el.type === "group"}
            sizeLabel={selection.length === 1 ? sizeLabel : null}
            onHandleDown={onHandleDown}
          />
        );
      })}

      {/* 右鍵選單 */}
      {contextMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
            background: "var(--app-panel)",
            border: "1px solid var(--app-border)",
            borderRadius: 8,
            padding: "4px",
            boxShadow: "0 12px 32px rgba(0,0,0,.4)",
            display: "flex",
            flexDirection: "column",
            minWidth: 140,
          }}
        >
          {selection.length === 1 && (
            <>
              <button className="csg-btn-sm" onClick={() => { reorderElement(selection[0]!, "front"); closeMenu(); }}>移到最上</button>
              <button className="csg-btn-sm" onClick={() => { reorderElement(selection[0]!, "forward"); closeMenu(); }}>上移一層</button>
              <button className="csg-btn-sm" onClick={() => { reorderElement(selection[0]!, "backward"); closeMenu(); }}>下移一層</button>
              <button className="csg-btn-sm" onClick={() => { reorderElement(selection[0]!, "back"); closeMenu(); }}>移到最下</button>
              <div style={{ height: 1, background: "var(--app-border)", margin: "4px 0" }} />
            </>
          )}
          <button className="csg-btn-sm" style={{ color: "#ff6b6b" }} onClick={() => { deleteSelected(); closeMenu(); }}>刪除物件</button>
        </div>
      )}
    </div>
  );
}
