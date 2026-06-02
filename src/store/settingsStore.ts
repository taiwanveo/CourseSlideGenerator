/** AI 供應商設定 — 持久化於 localStorage（桌面版可改用 Stronghold 加密）。 */
import { create } from "zustand";
import { PROVIDERS, getProvider } from "../engine/llm/providers";
import type { ProviderCredentials, ProviderId } from "../engine/llm/types";

const KEY = "csg:settings";

interface PersistShape {
  providerId: ProviderId;
  apiKeys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  baseUrls: Partial<Record<ProviderId, string>>;
  coverageThreshold: number;
}

function load(): PersistShape {
  const defaults: PersistShape = {
    providerId: "openai",
    apiKeys: {},
    models: {},
    baseUrls: {},
    coverageThreshold: 90,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>;
      return {
        providerId: parsed.providerId ?? defaults.providerId,
        apiKeys: parsed.apiKeys ?? defaults.apiKeys,
        models: parsed.models ?? defaults.models,
        baseUrls: parsed.baseUrls ?? defaults.baseUrls,
        coverageThreshold: Math.max(50, Math.min(100, Math.round(parsed.coverageThreshold ?? defaults.coverageThreshold))),
      };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

function persist(s: PersistShape): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

interface SettingsState extends PersistShape {
  setProvider: (id: ProviderId) => void;
  setApiKey: (id: ProviderId, key: string) => void;
  setModel: (id: ProviderId, model: string) => void;
  setBaseUrl: (id: ProviderId, url: string) => void;
  setCoverageThreshold: (value: number) => void;
  credentials: () => ProviderCredentials | null;
}

const init = load();

export const useSettings = create<SettingsState>((set, get) => ({
  ...init,
  setProvider: (id) =>
    set((s) => {
      const next = { ...s, providerId: id };
      persist(extract(next));
      return next;
    }),
  setApiKey: (id, key) =>
    set((s) => {
      const next = { ...s, apiKeys: { ...s.apiKeys, [id]: key } };
      persist(extract(next));
      return next;
    }),
  setModel: (id, model) =>
    set((s) => {
      const next = { ...s, models: { ...s.models, [id]: model } };
      persist(extract(next));
      return next;
    }),
  setBaseUrl: (id, url) =>
    set((s) => {
      const next = { ...s, baseUrls: { ...s.baseUrls, [id]: url } };
      persist(extract(next));
      return next;
    }),
  setCoverageThreshold: (value) =>
    set((s) => {
      const clamped = Math.max(50, Math.min(100, Math.round(value)));
      const next = { ...s, coverageThreshold: clamped };
      persist(extract(next));
      return next;
    }),
  credentials: () => {
    const s = get();
    const apiKey = s.apiKeys[s.providerId];
    if (!apiKey) return null;
    const def = getProvider(s.providerId);
    return {
      providerId: s.providerId,
      apiKey,
      model: s.models[s.providerId] ?? def.defaultModel,
      baseUrl: s.baseUrls[s.providerId],
    };
  },
}));

function extract(s: SettingsState | PersistShape): PersistShape {
  return {
    providerId: s.providerId,
    apiKeys: s.apiKeys,
    models: s.models,
    baseUrls: s.baseUrls,
    coverageThreshold: s.coverageThreshold,
  };
}

export { PROVIDERS };
