/**
 * ＋音樂 — 上傳本機音訊檔，設定為目前投影片的背景音樂（bgm）或旁白（narration）。
 * 產生的 AssetRef（data URL）存入 project.assets，並設定 slide.audio。
 */
import { useRef, useState } from "react";
import { newId } from "../model/factory";
import type { AssetRef } from "../model/types";
import { useEditor } from "../store/editorStore";
import { Modal } from "./GeneratePanel";

type AudioMode = "bgm" | "slide";

export function AudioPanel({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const updateSlideAudio = useEditor((s) => s.updateSlideAudio);

  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AudioMode>("bgm");
  const [loop, setLoop] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [error, setError] = useState<string | null>(null);

  const currentSlide = project.deck.slides.find((s) => s.id === currentSlideId);
  const currentAudio = currentSlide?.audio
    ? project.assets.find((a) => a.id === currentSlide.audio?.assetId)
    : null;

  // 所有音訊 assets
  const audioAssets = project.assets.filter((a) => a.kind === "audio");

  const onPickFile = async (file: File) => {
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const asset: AssetRef = {
        id: newId("asset"),
        kind: "audio",
        src: dataUrl,
        name: file.name,
      };
      updateSlideAudio(currentSlideId, asset, { mode, loop, volume });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "音訊讀取失敗");
    }
  };

  const applyExistingAsset = (assetId: string) => {
    updateSlideAudio(currentSlideId, assetId, { mode, loop, volume });
    onClose();
  };

  const clearAudio = () => {
    updateSlideAudio(currentSlideId, null, { mode, loop, volume });
    onClose();
  };

  return (
    <Modal title="設定音樂 / 旁白" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 目前設定 */}
        {currentAudio && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--app-canvas-bg)",
              border: "1px solid var(--app-border)",
              fontSize: 13,
            }}
          >
            <div style={{ color: "var(--app-muted)", fontSize: 11, marginBottom: 4 }}>目前音訊</div>
            <div style={{ color: "var(--app-text)", fontWeight: 600 }}>{currentAudio.name}</div>
            <button
              className="csg-btn"
              style={{ marginTop: 8, fontSize: 12 }}
              onClick={clearAudio}
            >
              移除音訊
            </button>
          </div>
        )}

        {/* 模式設定 */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["bgm", "slide"] as AudioMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--app-border)",
                background: mode === m ? "var(--app-accent)" : "transparent",
                color: mode === m ? "#fff" : "var(--app-text)",
                cursor: "pointer",
              }}
            >
              {m === "bgm" ? "🎵 背景音樂（持續播放）" : "🎤 僅此頁播放"}
            </button>
          ))}
        </div>

        {/* 循環播放 & 音量 */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            循環播放
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flex: 1 }}>
            音量
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 36, textAlign: "right", color: "var(--app-muted)" }}>
              {Math.round(volume * 100)}%
            </span>
          </label>
        </div>

        {/* 上傳新音訊 */}
        <button className="csg-btn csg-btn-accent" onClick={() => fileRef.current?.click()}>
          ⬆ 上傳音訊檔
        </button>
        <span style={{ fontSize: 11, color: "var(--app-muted)", marginTop: -8 }}>
          支援 MP3 / WAV / OGG / AAC / M4A
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickFile(f);
          }}
        />

        {/* 已上傳的音訊清單 */}
        {audioAssets.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 6 }}>
              專案內的音訊
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {audioAssets.map((a) => (
                <button
                  key={a.id}
                  className="csg-btn"
                  style={{ textAlign: "left", fontSize: 12 }}
                  onClick={() => applyExistingAsset(a.id)}
                >
                  🎵 {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</div>
        )}
      </div>
    </Modal>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("音訊讀取失敗"));
    reader.readAsDataURL(file);
  });
}
