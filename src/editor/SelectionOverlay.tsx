/**
 * 設計感選取控點覆蓋層 — 嚴格依 docs/01 規格：
 * 1.5px accent 選取框、8×8 白色圓角控點（accent 描邊 + 細陰影）、
 * hover 放大、邊中點 6×6、旋轉控點上方 24px、群組虛線框、控點反向旋轉不變形、
 * 拖曳時即時尺寸氣泡。禁止粗藍框 / 大實心點 / 原生 resize 控點。
 */
import type { CSSProperties } from "react";

export type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate";

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
}

interface Props {
  rect: ScreenRect;
  isGroup?: boolean;
  /** 拖曳/縮放時顯示的即時尺寸（design-px） */
  sizeLabel?: string | null;
  onHandleDown: (handle: HandleId, e: React.PointerEvent) => void;
}

const ACCENT = "var(--accent, #ff4a2b)";

const cornerHandleStyle: CSSProperties = {
  position: "absolute",
  width: 8,
  height: 8,
  background: "#ffffff",
  border: `1.5px solid ${ACCENT}`,
  borderRadius: 2,
  boxShadow: "0 1px 3px rgba(0,0,0,.18)",
  transition: "width .08s, height .08s, margin .08s",
  pointerEvents: "auto",
  boxSizing: "border-box",
};

const edgeHandleStyle: CSSProperties = {
  position: "absolute",
  width: 6,
  height: 6,
  background: "#ffffff",
  border: `1.5px solid ${ACCENT}`,
  borderRadius: 2,
  boxShadow: "0 1px 2px rgba(0,0,0,.16)",
  pointerEvents: "auto",
  boxSizing: "border-box",
};

const handleCursor: Record<HandleId, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  rotate: "grab",
};

export function SelectionOverlay({ rect, isGroup, sizeLabel, onHandleDown }: Props) {
  // 控點以 box 中心為基準擺放；反向旋轉讓控點本身不變形（容器已旋轉）。
  const corners: Array<{ id: HandleId; cx: number; cy: number }> = [
    { id: "nw", cx: 0, cy: 0 },
    { id: "ne", cx: rect.width, cy: 0 },
    { id: "se", cx: rect.width, cy: rect.height },
    { id: "sw", cx: 0, cy: rect.height },
  ];
  const edges: Array<{ id: HandleId; cx: number; cy: number }> = [
    { id: "n", cx: rect.width / 2, cy: 0 },
    { id: "e", cx: rect.width, cy: rect.height / 2 },
    { id: "s", cx: rect.width / 2, cy: rect.height },
    { id: "w", cx: 0, cy: rect.height / 2 },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transform: `rotate(${rect.rotation}deg)`,
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* 選取框 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `1.5px ${isGroup ? "dashed" : "solid"} ${ACCENT}`,
          borderRadius: 1,
          boxSizing: "border-box",
        }}
      />

      {/* 旋轉控點 */}
      <div
        onPointerDown={(e) => onHandleDown("rotate", e)}
        style={{
          position: "absolute",
          left: rect.width / 2 - 5,
          top: -24 - 5,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ffffff",
          border: `1.5px solid ${ACCENT}`,
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
          cursor: handleCursor.rotate,
          pointerEvents: "auto",
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: rect.width / 2,
          top: -24,
          width: 1,
          height: 24,
          background: ACCENT,
          opacity: 0.6,
        }}
      />

      {/* 邊中點控點 */}
      {edges.map((h) => (
        <div
          key={h.id}
          onPointerDown={(e) => onHandleDown(h.id, e)}
          style={{
            ...edgeHandleStyle,
            left: h.cx - 3,
            top: h.cy - 3,
            cursor: handleCursor[h.id],
          }}
        />
      ))}

      {/* 角落控點 */}
      {corners.map((h) => (
        <div
          key={h.id}
          onPointerDown={(e) => onHandleDown(h.id, e)}
          onPointerEnter={(e) => {
            const t = e.currentTarget;
            t.style.width = "10px";
            t.style.height = "10px";
            t.style.left = `${h.cx - 5}px`;
            t.style.top = `${h.cy - 5}px`;
          }}
          onPointerLeave={(e) => {
            const t = e.currentTarget;
            t.style.width = "8px";
            t.style.height = "8px";
            t.style.left = `${h.cx - 4}px`;
            t.style.top = `${h.cy - 4}px`;
          }}
          style={{
            ...cornerHandleStyle,
            left: h.cx - 4,
            top: h.cy - 4,
            cursor: handleCursor[h.id],
          }}
        />
      ))}

      {/* 即時尺寸氣泡 */}
      {sizeLabel && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: rect.height + 12,
            transform: "translateX(-50%)",
            background: "rgba(20,20,22,.9)",
            color: "#fff",
            fontSize: 12,
            lineHeight: 1,
            padding: "5px 8px",
            borderRadius: 5,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {sizeLabel}
        </div>
      )}
    </div>
  );
}
