import { useState } from "react";
import { listModels } from "../engine/llm/client";
import type { ModelInfo, ProviderId } from "../engine/llm/types";
import { PROVIDERS, useSettings } from "../store/settingsStore";
import { Modal } from "./GeneratePanel";

interface Props {
  onClose: () => void;
  onOpenOnboarding: () => void;
}

export function SettingsPanel({ onClose, onOpenOnboarding }: Props) {
  const settings = useSettings();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const provider = settings.providerId;
  const providerDef = PROVIDERS.find((p) => p.id === provider)!;
  const apiKey = settings.apiKeys[provider] ?? "";
  const model = settings.models[provider] ?? providerDef.defaultModel;

  const fetchModels = async () => {
    const creds = settings.credentials();
    if (!creds) {
      setModelError("請先輸入 API Key");
      return;
    }
    try {
      setFetchingModels(true);
      setModelError(null);
      const list = await listModels(creds);
      setModels(list);
      if (list.length === 0) setModelError("無法取得模型清單，可手動輸入模型名稱");
    } catch (e) {
      setModelError(e instanceof Error ? e.message : "讀取模型失敗");
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <Modal title="設定" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            border: "1px solid var(--app-border)",
            borderRadius: 10,
            padding: 12,
            background: "var(--app-canvas-bg)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>AI 模型設定</div>
          <label className="csg-field-label">AI 供應商</label>
          <select
            className="csg-select"
            value={provider}
            onChange={(e) => {
              settings.setProvider(e.target.value as ProviderId);
              setModels([]);
              setModelError(null);
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="csg-field-label">API Key</label>
          <input
            className="csg-input"
            type="password"
            value={apiKey}
            placeholder="貼上 API Key"
            onChange={(e) => settings.setApiKey(provider, e.target.value)}
          />
          <a href={providerDef.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--app-accent)" }}>
            取得 {providerDef.name} 金鑰 →
          </a>

          <label className="csg-field-label">模型</label>
          <div style={{ display: "flex", gap: 6 }}>
            {models.length > 0 ? (
              <select
                className="csg-select"
                style={{ flex: 1, minWidth: 0 }}
                value={model}
                onChange={(e) => settings.setModel(provider, e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="csg-input"
                style={{ flex: 1, minWidth: 0 }}
                value={model}
                onChange={(e) => settings.setModel(provider, e.target.value)}
              />
            )}
            <button className="csg-btn-sm" style={{ flexShrink: 0 }} onClick={fetchModels} disabled={fetchingModels}>
              {fetchingModels ? "讀取中…" : "列出"}
            </button>
          </div>
          {modelError && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{modelError}</div>}
        </div>

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
