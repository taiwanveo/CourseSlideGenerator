/**
 * 文字方塊自動量測 — 針對 autoSize 的文字與條列元素，量測內容自然尺寸並回寫 transform，
 * 使選取邊框緊貼文字（類似 Word 文字方塊）。離螢幕量測，不影響畫面與匯出。
 */
import { useLayoutEffect, useRef } from "react";
import { getTheme, themeToCssVars } from "../engine/themes/themes";
import type { CSSProperties } from "react";
import type { ListElement, RichText, Slide, TextElement, TextStyle, ThemeRef } from "../model/types";
import { useEditor } from "../store/editorStore";

const PAD = 1; // 降低 Padding，讓選取框更貼齊文字邊緣
const MAX_WIDTH = 1500;

function textCss(style: TextStyle): CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    fontWeight: style.fontWeight,
  };
}

function renderRich(rt: RichText) {
  return rt.spans.map((s, i) => (
    <span
      key={i}
      style={{
        fontWeight: s.bold ? 700 : undefined,
        fontStyle: s.italic ? "italic" : undefined,
        color: s.color,
      }}
    >
      {s.text}
    </span>
  ));
}

export function TextAutoSizer({ slide, theme }: { slide: Slide; theme: ThemeRef }) {
  const fitTextSize = useEditor((s) => s.fitTextSize);
  const themeObj = getTheme(theme.id);
  const cssVars = themeToCssVars(themeObj, theme.tokenOverrides) as unknown as CSSProperties;

  const autoElements = slide.elements.filter(
    (el): el is TextElement | ListElement =>
      (el.type === "text" || el.type === "list") && el.autoSize === true,
  );

  return (
    <div
      aria-hidden
      style={{
        ...cssVars,
        position: "absolute",
        left: -999999,
        top: 0,
        visibility: "hidden",
        pointerEvents: "none",
      }}
    >
      {autoElements.map((el) => (
        <Measurer
          key={el.id}
          element={el}
          onMeasured={(w, h) => fitTextSize(el.id, w, h)}
        />
      ))}
    </div>
  );
}

function Measurer({
  element,
  onMeasured,
}: {
  element: TextElement | ListElement;
  onMeasured: (w: number, h: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const w = Math.ceil(rect.width) + PAD * 2;
    const h = Math.ceil(rect.height) + PAD * 2;
    if (w > 0 && h > 0) onMeasured(w, h);
  }); // 每次 render 後都重新量測

  return (
    <div
      ref={ref}
      style={{
        display: "inline-block",
        width: "max-content",
        maxWidth: MAX_WIDTH,
        boxSizing: "content-box",
        padding: 0,
        margin: 0,
      }}
    >
      {element.type === "text" ? (
        <div
          style={{
            ...textCss(element.style),
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {element.content.spans.length === 0 ? "\u00A0" : renderRich(element.content)}
        </div>
      ) : (
        <div style={{ ...textCss(element.style) }}>
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              counterReset: "csg-li",
            }}
          >
            {element.items.map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 18,
                  marginBottom: i === element.items.length - 1 ? 0 : element.style.itemGap ?? 16,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    color: element.style.markerColor ?? "var(--accent)",
                    fontWeight: 700,
                    flexShrink: 0,
                    minWidth: element.ordered ? "1.4em" : "0.6em",
                  }}
                >
                  {element.ordered ? `${i + 1}.` : "•"}
                </span>
                <span>{renderRich(item)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
