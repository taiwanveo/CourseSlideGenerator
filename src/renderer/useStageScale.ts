import { useEffect, useRef, useState } from "react";

/** 量測容器尺寸，回傳把 1920×1080 舞台縮放到容器內所需的 scale 與置中位移。 */
export function useStageScale(stageW: number, stageH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: stageW, height: stageH });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setBox({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(box.width / stageW, box.height / stageH) || 1;
  const offsetX = (box.width - stageW * scale) / 2;
  const offsetY = (box.height - stageH * scale) / 2;

  return { ref, scale, offsetX, offsetY, box };
}
