/**
 * 全螢幕播放簡報 — 以共用 SlideStage 等比置中顯示，支援方向鍵 / 空白鍵、
 * 左側 40% 點擊上一頁、右側 40% 點擊下一頁、ESC 離開、滑鼠靜止自動隱藏控制列。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../model/types";
import { buildAssetMap } from "../renderer/assets";
import { SlideStage } from "../renderer/SlideStage";
import { useEditor } from "../store/editorStore";

export function PresentationPlayer({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const startId = useEditor((s) => s.currentSlideId);
  const slides = project.deck.slides;
  const assets = buildAssetMap(project.assets);

  const startIndex = Math.max(0, slides.findIndex((x) => x.id === startId));
  const [idx, setIdx] = useState(startIndex < 0 ? 0 : startIndex);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  /** 每次換頁遞增，強制轉場層 remount 以重播 CSS animation */
  const [transitionSeq, setTransitionSeq] = useState(0);
  /** 每次索引變更都遞增，確保元件進場動畫可重播。 */
  const [elementAnimSeq, setElementAnimSeq] = useState(0);
  const [scale, setScale] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const clearPrevTimer = useRef<number | null>(null);

  const navigateToIndex = useCallback((next: number) => {
    setIdx((i) => {
      if (next === i) return i;
      setPrevIdx(i);
      setTransitionSeq((s) => s + 1);
      return next;
    });
  }, []);

  const go = useCallback(
    (dir: -1 | 1) => {
      setIdx((i) => {
        const next = Math.max(0, Math.min(slides.length - 1, i + dir));
        if (next !== i) {
          setPrevIdx(i);
          setTransitionSeq((s) => s + 1);
        }
        return next;
      });
    },
    [slides.length],
  );
  const goToSlideId = useCallback(
    (slideId: string) => {
      const target = slides.findIndex((s) => s.id === slideId);
      if (target < 0) return;
      navigateToIndex(target);
    },
    [navigateToIndex, slides],
  );
  const goFirst = useCallback(() => navigateToIndex(0), [navigateToIndex]);
  const goLast = useCallback(() => navigateToIndex(slides.length - 1), [navigateToIndex, slides.length]);

  // 進入時要求全螢幕
  useEffect(() => {
    const el = rootRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        /* 使用者拒絕或環境不支援 — 仍以覆蓋層方式呈現 */
      });
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // 等比縮放
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
      setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // 鍵盤控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        navigateToIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        navigateToIndex(slides.length - 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, navigateToIndex, onClose, slides.length]);

  // 滑鼠靜止自動隱藏控制列
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2200);
  }, []);
  useEffect(() => {
    pokeControls();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [pokeControls]);

  // 全域背景音樂：整份簡報持續播放（直到播放結束或離開）
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const bgmSlide = slides.find((s) => s.audio?.mode === "bgm");
    if (!bgmSlide?.audio) return;
    const asset = project.assets.find((a) => a.id === bgmSlide.audio?.assetId);
    if (!asset) return;

    const el = new Audio(asset.src);
    el.volume = bgmSlide.audio.volume ?? 0.7;
    el.loop = bgmSlide.audio.loop ?? true;
    el.play().catch(() => {/* 瀏覽器自動播放策略 — 靜默失敗 */});
    bgmRef.current = el;
    return () => {
      el.pause();
      bgmRef.current = null;
    };
  }, [slides, project.assets]);

  // 單頁音訊：只在當前頁播放
  const slideAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const slide = slides[idx];
    const audio = slide?.audio;
    // 停掉前一頁單頁音訊
    if (slideAudioRef.current) {
      slideAudioRef.current.pause();
      slideAudioRef.current = null;
    }
    if (!audio || audio.mode !== "slide") return;
    const asset = project.assets.find((a) => a.id === audio.assetId);
    if (!asset) return;
    const el = new Audio(asset.src);
    el.volume = audio.volume ?? 0.7;
    el.loop = audio.loop ?? true;
    el.play().catch(() => {/* 瀏覽器自動播放策略 — 靜默失敗 */});
    slideAudioRef.current = el;
    return () => {
      el.pause();
    };
  }, [idx, slides, project.assets]);

  const slide = slides[idx];
  const prevSlide = prevIdx !== null ? slides[prevIdx] : undefined;
  const activeTransition = slide?.transition ?? { preset: "crossfade", duration: 600, easing: "ease-in-out" };

  useEffect(() => {
    if (prevIdx === null) return;
    if (clearPrevTimer.current) window.clearTimeout(clearPrevTimer.current);
    clearPrevTimer.current = window.setTimeout(() => setPrevIdx(null), Math.max(120, activeTransition.duration));
    return () => {
      if (clearPrevTimer.current) window.clearTimeout(clearPrevTimer.current);
    };
  }, [prevIdx, activeTransition.duration]);

  useEffect(() => {
    setElementAnimSeq((s) => s + 1);
  }, [idx]);

  const handleRootClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-csg-player-controls]")) return;

      const linkEl = target.closest("[data-csg-link='1']") as HTMLElement | null;
      if (linkEl) {
        const kind = linkEl.dataset.csgLinkKind;
        const value = linkEl.dataset.csgLinkValue;
        if (kind === "slide" && value) goToSlideId(value);
        return;
      }

      const ratio = e.clientX / window.innerWidth;
      if (ratio <= 0.4) go(-1);
      else if (ratio >= 0.6) go(1);
    },
    [go, goToSlideId],
  );

  return (
    <div
      ref={rootRef}
      onMouseMove={pokeControls}
      onClick={handleRootClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#000",
        display: "grid",
        placeItems: "center",
        cursor: controlsVisible ? "default" : "none",
        overflow: "hidden",
      }}
    >
      {slide && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center center",
            overflow: "hidden",
          }}
        >
          {prevSlide && (
            <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
              <SlideStage slide={prevSlide} theme={project.theme} assets={assets} animateElements={false} />
            </div>
          )}
          <div
            key={`transition-${transitionSeq}-${slide.id}`}
            style={{ position: "absolute", inset: 0, zIndex: 2, ...enterTransitionStyle(activeTransition) }}
          >
            <SlideStage
              slide={slide}
              theme={project.theme}
              assets={assets}
              animateElements={true}
              animationNonce={elementAnimSeq}
            />
          </div>
        </div>
      )}

      {/* 控制列 */}
      <div
        data-csg-player-controls="1"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "8px 16px",
          borderRadius: 999,
          background: "rgba(20,20,20,.66)",
          backdropFilter: "blur(10px)",
          color: "#fff",
          fontSize: 14,
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity .3s ease",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <PlayerBtn label="<<" onClick={goFirst} disabled={idx === 0} title="第一頁 (Home)" />
        <PlayerBtn label="‹" onClick={() => go(-1)} disabled={idx === 0} />
        <span style={{ minWidth: 64, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {idx + 1} / {slides.length}
        </span>
        <PlayerBtn label="›" onClick={() => go(1)} disabled={idx === slides.length - 1} />
        <PlayerBtn label=">>" onClick={goLast} disabled={idx === slides.length - 1} title="最後頁 (End)" />
        <span style={{ width: 1, height: 20, background: "rgba(255,255,255,.25)" }} />
        <PlayerBtn label="✕" onClick={onClose} title="離開播放 (Esc)" />
      </div>

      {controlsVisible && slide?.notes?.trim() && (
        <div
          data-csg-player-controls="1"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: "50%",
            top: 20,
            transform: "translateX(-50%)",
            maxWidth: "min(720px, 90vw)",
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(20,20,20,.72)",
            backdropFilter: "blur(8px)",
            color: "rgba(255,255,255,.92)",
            fontSize: 13,
            lineHeight: 1.5,
            opacity: 0.95,
            pointerEvents: "none",
          }}
        >
          {slide.notes}
        </div>
      )}
      <style>{`
        @keyframes csg-player-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes csg-player-wipe {
          from { clip-path: inset(0 100% 0 0); opacity: 1; }
          to { clip-path: inset(0 0 0 0); opacity: 1; }
        }
        @keyframes csg-player-push {
          from { transform: translateX(100%); opacity: 1; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes csg-player-cover {
          from { transform: translateY(100%); opacity: 1; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function enterTransitionStyle(transition: { preset: string; duration: number; easing: string }) {
  const timing = `${transition.duration}ms ${transition.easing}`;
  const base = {
    animationFillMode: "both" as const,
    willChange: "opacity, transform, clip-path",
  };
  if (transition.preset === "wipe-right") {
    return { ...base, animation: `csg-player-wipe ${timing}` };
  }
  if (transition.preset === "push-left") {
    return { ...base, animation: `csg-player-push ${timing}` };
  }
  if (transition.preset === "cover") {
    return { ...base, animation: `csg-player-cover ${timing}` };
  }
  // crossfade 與未知 preset 一律走淡化
  return { ...base, animation: `csg-player-fade ${timing}` };
}

function PlayerBtn({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: 20,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        padding: "2px 6px",
      }}
    >
      {label}
    </button>
  );
}
