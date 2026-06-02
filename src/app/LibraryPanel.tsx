/**
 * 我的簡報 — 列出已存檔的簡報，可開啟或刪除。資料來源為 ProjectStore（localStorage / Tauri SQLite）。
 */
import { useEffect, useState } from "react";
import type { Project } from "../model/types";
import { getStore, type ProjectListItem } from "../engine/storage/store";
import { Modal } from "./GeneratePanel";

export function LibraryPanel({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (project: Project) => void;
}) {
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    void getStore()
      .list()
      .then((list) => setItems(list))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const onOpen = async (id: string) => {
    const p = await getStore().load(id);
    if (p) onPick(p);
  };

  const onDelete = async (id: string, title: string) => {
    if (!window.confirm(`確定要刪除「${title}」嗎？此動作無法復原。`)) return;
    await getStore().remove(id);
    refresh();
  };

  return (
    <Modal title="我的簡報" onClose={onClose}>
      {loading ? (
        <div style={{ padding: 24, color: "var(--app-muted)" }}>載入中…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24, color: "var(--app-muted)" }}>目前沒有已存檔的簡報。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--app-border)",
                borderRadius: 8,
                background: "var(--app-panel)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {it.title || "未命名簡報"}
                </div>
                <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>
                  {formatTime(it.updatedAt)}
                </div>
              </div>
              <button className="csg-btn" onClick={() => void onOpen(it.id)}>
                開啟
              </button>
              <button
                className="csg-btn-sm"
                style={{ color: "#ff6b6b" }}
                onClick={() => void onDelete(it.id, it.title)}
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
