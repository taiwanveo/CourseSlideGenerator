/**
 * 平台偵測與整合 — 桌面版（Tauri）啟用 HTTP 外掛（繞過 CORS）與 SQLite 儲存。
 * 瀏覽器環境下為無操作，App 仍以 window.fetch + localStorage 正常運作。
 */
import { setPlatformFetch } from "../engine/llm/client";
import { setStore } from "../engine/storage/store";

interface TauriGlobal {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as TauriGlobal;
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

/** 在 main.tsx 啟動時呼叫；桌面環境會切換 fetch 與儲存後端。 */
export async function initPlatform(): Promise<void> {
  if (!isTauri()) return;
  try {
    const http = await import("@tauri-apps/plugin-http");
    setPlatformFetch(http.fetch as typeof fetch);
  } catch (err) {
    console.warn("Tauri HTTP 外掛載入失敗，沿用 window.fetch：", err);
  }
  try {
    const { TauriSqlStore } = await import("./tauriStore");
    setStore(new TauriSqlStore());
  } catch (err) {
    console.warn("Tauri SQLite 儲存載入失敗，沿用 localStorage：", err);
  }
}
