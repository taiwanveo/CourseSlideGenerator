import { useState } from "react";
import { useEditor } from "../store/editorStore";
import { Modal } from "./GeneratePanel";

export function SnapshotsPanel({ onClose }: { onClose: () => void }) {
  const snapshots = useEditor((s) => s.snapshots);
  const saveSnapshot = useEditor((s) => s.saveSnapshot);
  const restoreSnapshot = useEditor((s) => s.restoreSnapshot);
  const deleteSnapshot = useEditor((s) => s.deleteSnapshot);
  const [name, setName] = useState("");

  return (
    <Modal title="版本快照" onClose={onClose}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="csg-input"
            value={name}
            placeholder="輸入快照名稱（例如：提案版 v2）"
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="csg-btn csg-btn-accent"
            onClick={() => {
              saveSnapshot(name);
              setName("");
            }}
          >
            新增快照
          </button>
        </div>

        <div style={{ maxHeight: 420, overflowY: "auto", display: "grid", gap: 8 }}>
          {snapshots.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--app-muted)" }}>尚未建立快照。</div>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                style={{
                  border: "1px solid var(--app-border)",
                  borderRadius: 8,
                  padding: 10,
                  background: "var(--app-canvas-bg)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 600 }}>{snap.name}</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)" }}>
                  {new Date(snap.createdAt).toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="csg-btn-sm" onClick={() => restoreSnapshot(snap.id)}>
                    還原到此快照
                  </button>
                  <button className="csg-btn-sm" onClick={() => deleteSnapshot(snap.id)}>
                    刪除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
