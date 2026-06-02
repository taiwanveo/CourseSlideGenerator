import type { HandleId } from "./SelectionOverlay";
import type { Transform } from "../model/types";

export interface Vec {
  x: number;
  y: number;
}

export function rotate(v: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

const MIN = 20;

/** 旋轉感知的縮放：保持對側錨點固定，回傳新的 x/y/width/height。 */
export function resizeTransform(
  t: Transform,
  handle: Exclude<HandleId, "rotate">,
  pointer: Vec,
): Pick<Transform, "x" | "y" | "width" | "height"> {
  const hw = t.width / 2;
  const hh = t.height / 2;
  const center: Vec = { x: t.x + hw, y: t.y + hh };

  // 對側錨點（local，原點為中心）
  const anchorLocal: Vec = (() => {
    switch (handle) {
      case "nw":
        return { x: hw, y: hh };
      case "ne":
        return { x: -hw, y: hh };
      case "se":
        return { x: -hw, y: -hh };
      case "sw":
        return { x: hw, y: -hh };
      case "n":
        return { x: 0, y: hh };
      case "s":
        return { x: 0, y: -hh };
      case "e":
        return { x: -hw, y: 0 };
      case "w":
        return { x: hw, y: 0 };
    }
  })();

  const anchorWorld: Vec = {
    x: center.x + rotate(anchorLocal, t.rotation).x,
    y: center.y + rotate(anchorLocal, t.rotation).y,
  };

  // pointer 轉回 local（相對錨點）
  const pl = rotate({ x: pointer.x - anchorWorld.x, y: pointer.y - anchorWorld.y }, -t.rotation);

  const horiz = handle !== "n" && handle !== "s";
  const vert = handle !== "e" && handle !== "w";

  const newW = horiz ? Math.max(MIN, Math.abs(pl.x)) : t.width;
  const newH = vert ? Math.max(MIN, Math.abs(pl.y)) : t.height;

  const ux = anchorLocal.x === 0 ? 0 : -Math.sign(anchorLocal.x);
  const uy = anchorLocal.y === 0 ? 0 : -Math.sign(anchorLocal.y);

  const offsetLocal: Vec = { x: ux * (newW / 2), y: uy * (newH / 2) };
  const offsetWorld = rotate(offsetLocal, t.rotation);
  const newCenter: Vec = {
    x: anchorWorld.x + offsetWorld.x,
    y: anchorWorld.y + offsetWorld.y,
  };

  return {
    x: newCenter.x - newW / 2,
    y: newCenter.y - newH / 2,
    width: newW,
    height: newH,
  };
}

export function rotationFromPointer(t: Transform, pointer: Vec, snap: boolean): number {
  const center: Vec = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  const angle = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;
  let deg = ((angle % 360) + 360) % 360;
  if (snap) deg = Math.round(deg / 15) * 15;
  return deg;
}
