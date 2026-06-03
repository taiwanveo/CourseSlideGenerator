import type { CSSProperties } from "react";
import type {
  Element,
  ElementAnimation,
  ListElement,
  RichText,
  ShapeElement,
  TextElement,
  TextStyle,
} from "../model/types";
import { getMotionPreset } from "../engine/motion/catalog";
import type { AssetMap } from "./assets";
import { resolveAssetSrc } from "./assets";
import { ChartView } from "./ChartView";
import { TableView } from "./TableView";

interface Props {
  element: Element;
  assets: AssetMap;
  playAnimations?: boolean;
}

function transformStyle(el: Element): CSSProperties {
  const t = el.transform;
  return {
    position: "absolute",
    left: t.x,
    top: t.y,
    width: t.width,
    height: t.height,
    transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
    opacity: el.hidden ? 0 : t.opacity,
    zIndex: t.zIndex,
  };
}

function animationStyle(el: Element, playAnimations: boolean): CSSProperties {
  if (!playAnimations) return {};
  const enter = el.animations.find((a) => a.kind === "enter");
  const emphasis = el.animations.find((a) => a.kind === "emphasis");
  if (!enter && !emphasis) return {};

  const names: string[] = [];
  const durations: string[] = [];
  const easings: string[] = [];
  const delays: string[] = [];

  const pushTrack = (a: ElementAnimation, delayOverride?: number) => {
    const preset = getMotionPreset(a.preset);
    const duration = Math.max(80, a.duration || preset?.defaultDuration || 600);
    const easing = a.easing || preset?.defaultEasing || "ease";
    const delay = Math.min(4000, Math.max(0, (delayOverride ?? a.delay) || 0));
    names.push(`csg-${a.preset}`);
    durations.push(`${duration}ms`);
    easings.push(easing);
    delays.push(`${delay}ms`);
  };

  if (enter) pushTrack(enter);
  if (emphasis) {
    const enterDuration = enter
      ? Math.max(80, enter.duration || getMotionPreset(enter.preset)?.defaultDuration || 600)
      : 0;
    const enterDelay = enter ? Math.max(0, enter.delay || 0) : 0;
    const chainedDelay = enterDelay + enterDuration + Math.max(0, emphasis.delay || 0);
    pushTrack(emphasis, chainedDelay);
  }

  const usesTransform =
    (enter && ["fade-up", "scale-in", "slide-left"].includes(enter.preset)) ||
    (emphasis && ["pulse", "shake", "bounce"].includes(emphasis.preset));

  return {
    width: "100%",
    height: "100%",
    animationName: names.join(", "),
    animationDuration: durations.join(", "),
    animationTimingFunction: easings.join(", "),
    animationDelay: delays.join(", "),
    animationIterationCount: names.map(() => "1").join(", "),
    animationFillMode: names.map(() => "both").join(", "),
    transformOrigin: usesTransform ? "center center" : undefined,
    willChange: "transform, opacity, filter, clip-path",
  };
}

function textCss(style: TextStyle): CSSProperties {
  const isHeading = style.fontSize >= 52 || (style.fontWeight ?? 400) >= 700;
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing ?? (isHeading ? "var(--reveal-heading-letter-spacing, 0)" : undefined),
    fontWeight: style.fontWeight,
    textTransform: isHeading ? ("var(--reveal-heading-transform, none)" as CSSProperties["textTransform"]) : undefined,
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

function isTitleLikeElement(el: TextElement): boolean {
  const size = el.style.fontSize;
  const weight = el.style.fontWeight ?? 400;
  if (size >= 200) return false;
  return size >= 84 || (weight >= 700 && size >= 52 && size < 120);
}

function TextInner({ el }: { el: TextElement }) {
  const valign = el.style.valign ?? "top";
  const titleLike = isTitleLikeElement(el);
  const content = <div>{renderRich(el.content)}</div>;
  const legacyHref = (el as unknown as { href?: string }).href;
  const link = el.link ?? (legacyHref ? { kind: "url" as const, value: legacyHref, target: "blank" as const } : undefined);
  return (
    <div
      style={{
        ...textCss(el.style),
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent:
          valign === "middle" ? "center" : valign === "bottom" ? "flex-end" : "flex-start",
        whiteSpace: titleLike ? "nowrap" : "pre-wrap",
        wordBreak: titleLike ? "normal" : "break-word",
        overflow: "hidden",
        textOverflow: titleLike ? "clip" : undefined,
      }}
    >
      {link ? (
        <a
          href={link.kind === "url" ? link.value : "#"}
          target={link.kind === "url" ? (link.target === "self" ? "_self" : "_blank") : undefined}
          rel="noreferrer"
          data-csg-link="1"
          data-csg-link-kind={link.kind}
          data-csg-link-value={link.value}
          onClick={(e) => {
            if (link.kind === "slide") e.preventDefault();
            e.stopPropagation();
          }}
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

function ListInner({ el }: { el: ListElement }) {
  const gap = el.style.itemGap ?? 16;
  const marker = el.style.markerColor ?? "var(--accent)";
  return (
    <div style={{ ...textCss(el.style), width: "100%", height: "100%", overflow: "hidden" }}>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          counterReset: "csg-li",
        }}
      >
        {el.items.map((item, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 18,
              marginBottom: i === el.items.length - 1 ? 0 : gap,
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                color: marker,
                fontWeight: 700,
                flexShrink: 0,
                minWidth: el.ordered ? "1.4em" : "0.6em",
              }}
            >
              {el.ordered ? `${i + 1}.` : "•"}
            </span>
            <span style={{ flex: 1 }}>{renderRich(item)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ShapeInner({ el }: { el: ShapeElement }) {
  const fill = el.fill ?? "var(--accent)";
  const stroke = el.stroke;
  if (el.shape === "rect") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          borderRadius: el.cornerRadius ?? 0,
          border: stroke ? `${stroke.width}px solid ${stroke.color}` : undefined,
        }}
      />
    );
  }
  if (el.shape === "ellipse") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          borderRadius: "50%",
          border: stroke ? `${stroke.width}px solid ${stroke.color}` : undefined,
        }}
      />
    );
  }
  const w = Math.max(1, el.transform.width);
  const h = Math.max(1, el.transform.height);
  const sw = stroke?.width ?? 0;
  const swLine = stroke?.width ?? 4;
  const sc = stroke?.color ?? fill;

  // line / arrow / triangle via SVG
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      {el.shape === "line" && (
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={sc} strokeWidth={swLine} />
      )}
      {el.shape === "arrow" && (
        <g stroke={sc} strokeWidth={swLine} fill="none" strokeLinejoin="round" strokeLinecap="round">
          <line x1="0" y1={h / 2} x2={w - 2} y2={h / 2} />
          <polyline points={`${Math.max(0, w - Math.max(16, swLine * 2.5))},${h / 2 - Math.max(10, swLine * 1.5)} ${w - 2},${h / 2} ${Math.max(0, w - Math.max(16, swLine * 2.5))},${h / 2 + Math.max(10, swLine * 1.5)}`} />
        </g>
      )}
      {el.shape === "triangle" && (
        <polygon 
          points={`${w / 2},${sw / 2} ${w - sw / 2},${h - sw / 2} ${sw / 2},${h - sw / 2}`} 
          fill={fill} 
          stroke={stroke?.color ?? "transparent"} 
          strokeWidth={sw} 
        />
      )}
    </svg>
  );
}

export function ElementView({ element, assets, playAnimations = false }: Props) {
  if (element.type === "audio") return null;

  let inner: React.ReactNode = null;
  switch (element.type) {
    case "text":
      inner = <TextInner el={element} />;
      break;
    case "list":
      inner = <ListInner el={element} />;
      break;
    case "shape":
      inner = <ShapeInner el={element} />;
      break;
    case "image": {
      const src = resolveAssetSrc(element.assetId, assets);
      inner = src ? (
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: element.fit,
            borderRadius: element.cornerRadius ?? 0,
            boxShadow: element.shadow
              ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${element.shadow.color}`
              : undefined,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: element.cornerRadius ?? 0,
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-mute)",
            fontSize: 28,
            border: "2px dashed var(--rule)",
          }}
        >
          圖片
        </div>
      );
      break;
    }
    case "icon":
      inner = (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: element.color,
            fontSize: Math.min(element.transform.width, element.transform.height) * 0.8,
          }}
        >
          ◆
        </div>
      );
      break;
    case "chart":
      inner = <ChartView config={element.config} />;
      break;
    case "table":
      inner = <TableView config={element.config} />;
      break;
    case "group":
      inner = (
        <div style={{ position: "absolute", inset: 0 }}>
          {element.children.map((child) => (
            <ElementView key={child.id} element={child} assets={assets} playAnimations={playAnimations} />
          ))}
        </div>
      );
      break;
  }

  const animStyle = animationStyle(element, playAnimations);
  const hasAnim = Object.keys(animStyle).length > 0;

  return (
    <div style={transformStyle(element)}>
      {hasAnim ? <div style={animStyle}>{inner}</div> : inner}
    </div>
  );
}
