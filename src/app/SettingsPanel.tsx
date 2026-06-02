import { useSettings } from "../store/settingsStore";
import { Modal } from "./GeneratePanel";

interface Props {
  onClose: () => void;
  onOpenOnboarding: () => void;
}

export function SettingsPanel({ onClose, onOpenOnboarding }: Props) {
  const settings = useSettings();

  return (
    <Modal title="設定" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            border: "1px solid var(--app-border)",
            borderRadius: 10,
            padding: 12,
            background: "var(--app-canvas-bg)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            AI 覆蓋率門檻
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span>最低覆蓋率</span>
            <strong>{settings.coverageThreshold}%</strong>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={settings.coverageThreshold}
            onChange={(e) => settings.setCoverageThreshold(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--app-muted)" }}>
            預設值為 90%。當生成後覆蓋率低於門檻時，系統會自動再補頁。
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--app-muted)" }}>
          設定會自動儲存在本機，下次啟動仍會沿用。
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button className="csg-btn" onClick={onOpenOnboarding}>重新顯示導覽</button>
          <button className="csg-btn csg-btn-accent" onClick={onClose}>完成</button>
        </div>
      </div>
    </Modal>
  );
}
