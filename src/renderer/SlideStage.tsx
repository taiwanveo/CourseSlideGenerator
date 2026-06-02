import type { CSSProperties } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../model/types";
import type { Background, Slide, ThemeRef } from "../model/types";
import { getTheme, themeToCssVars } from "../engine/themes/themes";
import type { AssetMap } from "./assets";
import { resolveAssetSrc } from "./assets";
import { ElementView } from "./ElementView";

interface Props {
  slide: Slide;
  theme: ThemeRef;
  assets: AssetMap;
  /** 額外覆蓋於舞台外層 div 的樣式 */
  style?: CSSProperties;
}

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
export function SlideStage({ slide, theme, assets, style }: Props) {
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
      {slide.elements
        .slice()
        .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
        .map((el) => (
          <ElementView key={el.id} element={el} assets={assets} />
        ))}
    </div>
  );
}
