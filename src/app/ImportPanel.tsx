import { useRef, useState } from "react";
import { parseProjectJson, type ImportMode } from "../engine/import/project";
import { useEditor } from "../store/editorStore";
import { Modal } from "./GeneratePanel";

export function ImportPanel({ onClose }: { onClose: () => void }) {
  const importProject = useEditor((s) => s.importProject);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickImportFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const incoming = parseProjectJson(await file.text());
      if (incoming.deck.slides.length === 0) {
        throw new Error("匯入的專案沒有任何頁面。");
      }
      if (importMode === "replace") {
        const ok = window.confirm(
          "「取代」會用匯入的專案覆蓋目前簡報（可用 Ctrl+Z 復原）。確定要繼續嗎？",
        );
        if (!ok) return;
      }
      importProject(incoming, importMode);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "匯入失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="匯入專案 JSON" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="import-mode"
              checked={importMode === "replace"}
              onChange={() => setImportMode("replace")}
            />
            取代（Replace）
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="import-mode"
              checked={importMode === "append"}
              onChange={() => setImportMode("append")}
            />
            附加（Append）
          </label>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "var(--app-muted)", lineHeight: 1.5 }}>
          {importMode === "replace"
            ? "以匯入檔完全取代目前簡報，適合從備份還原或接續編輯單一專案。"
            : "把匯入檔的頁面接在目前簡報後方，可多次匯入合併成一份長簡報。"}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickImportFile(file);
            e.target.value = "";
          }}
        />
        <button
          className="csg-btn"
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          style={{ width: "100%" }}
        >
          {busy ? "匯入中…" : "選擇 JSON 檔案並匯入"}
        </button>
      </div>

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="csg-btn" onClick={onClose}>
          關閉
        </button>
      </div>
    </Modal>
  );
}
