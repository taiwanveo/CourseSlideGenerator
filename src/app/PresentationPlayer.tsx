/**
 * 全螢幕播放簡報 — 以共用 SlideStage 等比置中顯示，支援方向鍵 / 空白鍵 / 點擊切頁、
 * ESC 離開、滑鼠靜止自動隱藏控制列。盡量呼叫瀏覽器全螢幕 API（Tauri 視窗亦適用）。
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
  const [scale, setScale] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (dir: -1 | 1) => {
      setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + dir)));
    },
    [slides.length],
  );

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
        setIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIdx(slides.length - 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, onClose, slides.length]);

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

  return (
    <div
      ref={rootRef}
      onMouseMove={pokeControls}
      onClick={() => go(1)}
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
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "center",
            flexShrink: 0,
          }}
        >
          <SlideStage slide={slide} theme={project.theme} assets={assets} />
        </div>
      )}

      {/* 控制列 */}
      <div
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
        <PlayerBtn label="‹" onClick={() => go(-1)} disabled={idx === 0} />
        <span style={{ minWidth: 64, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {idx + 1} / {slides.length}
        </span>
        <PlayerBtn label="›" onClick={() => go(1)} disabled={idx === slides.length - 1} />
        <span style={{ width: 1, height: 20, background: "rgba(255,255,255,.25)" }} />
        <PlayerBtn label="✕" onClick={onClose} title="離開播放 (Esc)" />
      </div>
    </div>
  );
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
