/**
 * ＋圖片 — 上傳本機圖片，或以 AI 生圖（依目前簡報內容自動生成 / 自訂提示詞）。
 * 產生的圖片會存成 AssetRef（data URL）並插入目前頁面置中。
 */
import { useRef, useState } from "react";
import { generateImage } from "../engine/ai/image";
import { newId } from "../model/factory";
import type { AssetRef, Element } from "../model/types";
import { useEditor } from "../store/editorStore";
import { useSettings } from "../store/settingsStore";
import { Modal } from "./GeneratePanel";

type Tab = "upload" | "ai";

export function ImagePanel({ onClose }: { onClose: () => void }) {
  const addImage = useEditor((s) => s.addImage);
  const project = useEditor((s) => s.project);
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const settings = useSettings();

  const [tab, setTab] = useState<Tab>("upload");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = async (file: File) => {
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const dim = await imageSize(dataUrl);
      const asset: AssetRef = {
        id: newId("asset"),
        kind: "image",
        src: dataUrl,
        name: file.name,
        width: dim.w,
        height: dim.h,
      };
      addImage(asset);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "圖片讀取失敗");
    }
  };

  const slideTextSummary = (): string => {
    const slide = project.deck.slides.find((x) => x.id === currentSlideId);
    if (!slide) return project.meta.title;
    const parts: string[] = [project.meta.title];
    for (const el of slide.elements) parts.push(elementText(el));
    return parts.filter(Boolean).join("；").slice(0, 600);
  };

  const runGenerate = async (finalPrompt: string) => {
    const creds = settings.credentials();
    if (!creds) {
      setError("請先在「AI 生成」面板填入 API Key。");
      return;
    }
    if (!finalPrompt.trim()) {
      setError("請輸入提示詞。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const img = await generateImage(creds, finalPrompt.trim());
      const asset: AssetRef = {
        id: newId("asset"),
        kind: "image",
        src: img.dataUrl,
        name: "AI 生圖",
        width: img.width,
        height: img.height,
      };
      addImage(asset);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生圖失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="新增圖片" onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <TabBtn active={tab === "upload"} onClick={() => setTab("upload")}>
          上傳圖片
        </TabBtn>
        <TabBtn active={tab === "ai"} onClick={() => setTab("ai")}>
          AI 生圖
        </TabBtn>
      </div>

      {tab === "upload" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="csg-btn csg-btn-accent" onClick={() => fileRef.current?.click()}>
            ⬆ 選擇圖片檔
          </button>
          <span style={{ fontSize: 12, color: "var(--app-muted)" }}>支援 PNG / JPG / GIF / WEBP / SVG</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
            }}
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            className="csg-btn"
            disabled={busy}
            onClick={() => void runGenerate(`為以下教學簡報內容繪製一張清晰、專業的配圖（無文字）：${slideTextSummary()}`)}
          >
            ✦ 依照目前簡報內容自動生圖
          </button>
          <div style={{ fontSize: 12, color: "var(--app-muted)", textAlign: "center" }}>— 或自訂提示詞 —</div>
          <textarea
            className="csg-input"
            style={{ minHeight: 120, resize: "vertical" }}
            placeholder="輸入想生成的圖片描述，例如：扁平風格的雲端運算示意圖，藍色調…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button className="csg-btn csg-btn-accent" disabled={busy} onClick={() => void runGenerate(prompt)}>
            {busy ? "生成中…" : "輸入提示詞生圖"}
          </button>
        </div>
      )}

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 0",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 8,
        border: "1px solid var(--app-border)",
        background: active ? "var(--app-accent)" : "transparent",
        color: active ? "#fff" : "var(--app-text)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function elementText(el: Element): string {
  if (el.type === "text") return el.content.spans.map((s) => s.text).join("");
  if (el.type === "list") return el.items.map((it) => it.spans.map((s) => s.text).join("")).join("、");
  return "";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("圖片讀取失敗"));
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1024, h: img.naturalHeight || 768 });
    img.onerror = () => resolve({ w: 1024, h: 768 });
    img.src = src;
  });
}
