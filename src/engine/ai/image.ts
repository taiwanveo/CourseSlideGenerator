/**
 * AI 生圖 — 使用 OpenAI 相容的 images/generations 端點（gpt-image-1 / dall-e-3）。
 * 桌面版透過 platformRequest 繞過 CORS。回傳 data URL，方便直接存入 AssetRef。
 */
import { getProvider } from "../llm/providers";
import { platformRequest } from "../llm/client";
import type { ProviderCredentials } from "../llm/types";

export interface GeneratedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const SIZE = "1024x1024" as const;

export async function generateImage(
  creds: ProviderCredentials,
  prompt: string,
): Promise<GeneratedImage> {
  const def = getProvider(creds.providerId);
  if (def.apiStyle !== "openai") {
    throw new Error("目前僅支援 OpenAI 相容供應商進行 AI 生圖，請於設定切換至 OpenAI。");
  }
  const base = (creds.baseUrl ?? def.baseUrl).replace(/\/$/, "");
  // 影像模型與聊天模型不同；若使用者填的是聊天模型則回退為 gpt-image-1
  const model = /image|dall/i.test(creds.model) ? creds.model : "gpt-image-1";

  const res = await platformRequest(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: SIZE,
      n: 1,
      ...(model === "dall-e-3" ? { response_format: "b64_json" } : {}),
    }),
  });
  if (!res.ok) throw new Error(`生圖失敗 ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = data.data?.[0];
  if (!first) throw new Error("生圖回傳為空。");

  let dataUrl: string;
  if (first.b64_json) {
    dataUrl = `data:image/png;base64,${first.b64_json}`;
  } else if (first.url) {
    // 取回遠端圖檔轉成 data URL（避免日後連結失效）
    const imgRes = await platformRequest(first.url);
    const blob = await imgRes.blob();
    dataUrl = await blobToDataUrl(blob);
  } else {
    throw new Error("生圖回傳格式無法辨識。");
  }

  const [w, h] = parseSize(SIZE);
  return { dataUrl, width: w, height: h };
}

function parseSize(s: string): [number, number] {
  const [w, h] = s.split("x").map((n) => Number(n));
  return [w ?? 1024, h ?? 1024];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("圖檔讀取失敗"));
    reader.readAsDataURL(blob);
  });
}
