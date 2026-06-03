import { useState } from "react";
import { downloadBlob, downloadText } from "../engine/export/download";
import { exportHtml } from "../engine/export/html";
import { nodeToPng } from "../engine/export/image";
import { exportPptx } from "../engine/export/pptx";
import { chat } from "../engine/llm/client";
import type { Element, Project } from "../model/types";
import type { ProviderCredentials } from "../engine/llm/types";
import { useEditor } from "../store/editorStore";
import { useSettings } from "../store/settingsStore";
import { Modal } from "./GeneratePanel";

interface Props {
  onClose: () => void;
  /** 取得目前舞台 DOM 節點（給 PNG 匯出） */
  getStageNode: () => HTMLElement | null;
}

export function ExportPanel({ onClose, getStageNode }: Props) {
  const project = useEditor((s) => s.project);
  const settings = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const safeName = project.meta.title.replace(/[\\/:*?"<>|]/g, "_") || "presentation";

  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "匯出失敗");
    } finally {
      setBusy(null);
    }
  };

  const projectJsonExport = (
    <ExportRow
      compact
      label="專案 JSON"
      desc="備份完整物件樹，可日後重新載入"
      busy={busy === "json"}
      onClick={() =>
        run("json", async () => {
          await downloadText(JSON.stringify(project, null, 2), `${safeName}.json`, "application/json");
        })
      }
    />
  );

  return (
    <Modal title="匯出簡報" headerExtra={projectJsonExport} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ExportRow
          label="互動式 HTML"
          desc="單一檔案，可離線播放、方向鍵切頁"
          busy={busy === "html"}
          onClick={() =>
            run("html", async () => {
              await downloadText(exportHtml(project), `${safeName}.html`, "text/html");
            })
          }
        />
        <ExportRow
          label="PowerPoint（.pptx）"
          desc="可在 PowerPoint / Keynote 繼續編輯"
          busy={busy === "pptx"}
          onClick={() =>
            run("pptx", async () => {
              const blob = await exportPptx(project);
              await downloadBlob(blob, `${safeName}.pptx`);
            })
          }
        />
        <ExportRow
          label="目前頁 PNG"
          desc="匯出目前頁面為 1920×1080 圖片"
          busy={busy === "png"}
          onClick={() =>
            run("png", async () => {
              const node = getStageNode();
              if (!node) throw new Error("匯出舞台尚未就緒，請稍候再試");
              await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
              const blob = await nodeToPng(node, 1);
              await downloadBlob(blob, `${safeName}.png`);
            })
          }
        />
        <ExportRow
          label="講者備忘稿（Markdown）"
          desc="自動生成每頁講稿，適合口播或簡報排練"
          busy={busy === "notes"}
          onClick={() =>
            run("notes", async () => {
              const notesMd = await buildSpeakerNotes(project, settings.credentials());
              await downloadText(notesMd, `${safeName}-speaker-notes.md`, "text/markdown");
            })
          }
        />
        <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
          <div style={{ width: "75%", minWidth: 0 }}>
            <ExportRow
              label="品質報告"
              desc="匯出覆蓋率與品質檢查摘要"
              busy={busy === "quality"}
              onClick={() =>
                run("quality", async () => {
                  const payload = {
                    generatedAt: new Date().toISOString(),
                    coverage: project.source.coverage ?? null,
                    quality: project.source.quality ?? null,
                  };
                  await downloadText(
                    JSON.stringify(payload, null, 2),
                    `${safeName}-quality-report.json`,
                    "application/json",
                  );
                })
              }
            />
          </div>
          <button
            className="csg-btn"
            type="button"
            onClick={onClose}
            style={{ flexShrink: 0, alignSelf: "center" }}
          >
            關閉
          </button>
        </div>
      </div>
      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

async function buildSpeakerNotes(
  project: Project,
  creds: ProviderCredentials | null,
): Promise<string> {
  const sections = project.deck.slides.map((slide, idx) => {
    const content = extractSlideText(slide.elements).join("\n");
    return `## 第 ${idx + 1} 頁\n${content || "（無文字內容）"}`;
  });
  const seed = sections.join("\n\n");
  if (!creds) {
    return `# ${project.meta.title} — 講者備忘稿\n\n${sections.join("\n\n")}`;
  }

  const system =
    "你是專業簡報講者助理。請把每一頁內容改寫成 30-90 秒可直接口播的繁體中文講稿。輸出 Markdown。";
  const user =
    `簡報標題：${project.meta.title}\n\n以下是每頁內容，請產生對應講者備忘稿：\n\n${seed}`;
  try {
    const out = await chat(creds, [{ role: "system", content: system }, { role: "user", content: user }], {
      temperature: 0.4,
    });
    return `# ${project.meta.title} — 講者備忘稿\n\n${out}`;
  } catch {
    return `# ${project.meta.title} — 講者備忘稿\n\n${sections.join("\n\n")}`;
  }
}

function extractSlideText(elements: Element[]): string[] {
  const out: string[] = [];
  for (const el of elements) {
    if (el.type === "text") out.push(el.content.spans.map((s) => s.text).join(""));
    else if (el.type === "list") out.push(...el.items.map((it) => it.spans.map((s) => s.text).join("")));
    else if (el.type === "group") out.push(...extractSlideText(el.children));
  }
  return out.map((x) => x.trim()).filter(Boolean);
}

function ExportRow({
  label,
  desc,
  busy,
  compact,
  onClick,
}: {
  label: string;
  desc: string;
  busy: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="csg-export-row"
      onClick={onClick}
      disabled={busy}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: compact ? 1 : 2,
        width: compact ? 290 : "100%",
        maxWidth: compact ? 290 : undefined,
        flexShrink: compact ? 0 : undefined,
        padding: compact ? "6px 12px" : "12px 14px",
        background: "var(--app-canvas-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: compact ? 8 : 10,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          fontSize: compact ? 12 : 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "處理中…" : label}
      </span>
      <span
        style={{
          fontSize: compact ? 9 : 12,
          color: "var(--app-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {desc}
      </span>
    </button>
  );
}
