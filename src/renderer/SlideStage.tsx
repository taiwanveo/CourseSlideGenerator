import type { CSSProperties } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../model/types";
import type { Background, Slide, ThemeRef } from "../model/types";
import { getTheme, themeToCssVars } from "../engine/themes/themes";
import { buildKeyframesCss } from "../engine/motion/catalog";
import type { AssetMap } from "./assets";
import { resolveAssetSrc } from "./assets";
import { ElementView } from "./ElementView";

interface Props {
  slide: Slide;
  theme: ThemeRef;
  assets: AssetMap;
  /** 額外覆蓋於舞台外層 div 的樣式 */
  style?: CSSProperties;
  /** 僅播放模式啟用元件動畫。 */
  animateElements?: boolean;
  /** 每次換頁遞增，用於強制元件 remount 重播動畫。 */
  animationNonce?: number;
  /** 編輯模式：僅預覽指定物件動畫。 */
  previewElementId?: string;
}

const MOTION_KEYFRAMES_CSS = buildKeyframesCss();

function backgroundCss(bg: Background, assets: AssetMap): CSSProperties {
  switch (bg.type) {
    case "solid":
      return { background: bg.color };
    case "gradient":
      return { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
    case "image": {
      const src = resolveAssetSrc(bg.assetId, assets);
      return src
        ? { backgroundImage: `url(${src})`, backgroundSize: bg.fit, backgroundPosition: "center" }
        : { background: "var(--shell)" };
    }
    case "none":
      return {};
  }
}

/** 固定 1920×1080 的舞台，輸出與匯出共用。呼叫端負責縮放（scale transform）。 */
export function SlideStage({
  slide,
  theme,
  assets,
  style,
  animateElements = false,
  animationNonce = 0,
  previewElementId,
}: Props) {
  const activeThemeId = slide.themeId ?? theme.id;
  const themeObj = getTheme(activeThemeId);
  const cssVars = themeToCssVars(themeObj, theme.tokenOverrides) as unknown as CSSProperties;
  const stageThemeStyle = (themeObj.stageStyle ?? {}) as unknown as CSSProperties;

  return (
    <div
      style={{
        ...cssVars,
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        overflow: "hidden",
        ...backgroundCss(slide.background, assets),
        ...stageThemeStyle,
        ...style,
      }}
    >
      <style>{MOTION_KEYFRAMES_CSS}</style>
      {slide.elements
        .slice()
        .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
        .map((el) => {
          const playThis = animateElements || previewElementId === el.id;
          return (
            <ElementView
              key={playThis ? `${el.id}-${animationNonce}` : el.id}
              element={el}
              assets={assets}
              playAnimations={playThis}
            />
          );
        })}
    </div>
  );
}
