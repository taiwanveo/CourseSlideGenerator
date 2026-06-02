/**
 * 統一聊天客戶端 — 支援 OpenAI 相容 / Anthropic / Google 三種 API 風格。
 * 桌面版（Tauri）可注入 platformFetch 以繞過 CORS；瀏覽器開發退回 window.fetch。
 */
import { getProvider } from "./providers";
import type { ChatMessage, GenOptions, ModelInfo, ProviderCredentials } from "./types";

export type PlatformFetch = typeof fetch;

let platformFetch: PlatformFetch = (...args) => fetch(...args);

export function setPlatformFetch(fn: PlatformFetch): void {
  platformFetch = fn;
}

/** 以平台 fetch 發送請求（桌面版繞過 CORS）。 */
export function platformRequest(input: string, init?: RequestInit): Promise<Response> {
  return platformFetch(input, init);
}

function baseUrlFor(creds: ProviderCredentials): string {
  const def = getProvider(creds.providerId);
  return (creds.baseUrl ?? def.baseUrl).replace(/\/$/, "");
}

export async function chat(
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions = {},
): Promise<string> {
  const def = getProvider(creds.providerId);
  const base = baseUrlFor(creds);

  if (def.apiStyle === "anthropic") {
    return chatAnthropic(base, creds, messages, opts);
  }
  if (def.apiStyle === "google") {
    return chatGoogle(base, creds, messages, opts);
  }
  return chatOpenAI(base, creds, messages, opts);
}

async function chatOpenAI(
  base: string,
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions,
): Promise<string> {
  const res = await platformFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify({
      model: creds.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`LLM 錯誤 ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function chatAnthropic(
  base: string,
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions,
): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await platformFetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": creds.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: creds.model,
      system: system || undefined,
      messages: rest,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`LLM 錯誤 ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

async function chatGoogle(
  base: string,
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions,
): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const url = `${base}/models/${encodeURIComponent(creds.model)}:generateContent?key=${encodeURIComponent(creds.apiKey)}`;
  const res = await platformFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`LLM 錯誤 ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export async function listModels(creds: ProviderCredentials): Promise<ModelInfo[]> {
  const def = getProvider(creds.providerId);
  const base = baseUrlFor(creds);
  try {
    if (def.apiStyle === "google") {
      const res = await platformFetch(`${base}/models?key=${encodeURIComponent(creds.apiKey)}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name?: string }> };
      return (data.models ?? [])
        .map((m) => (m.name ?? "").replace(/^models\//, ""))
        .filter(Boolean)
        .map((id) => ({ id, label: id }));
    }
    const headers: Record<string, string> =
      def.apiStyle === "anthropic"
        ? { "x-api-key": creds.apiKey, "anthropic-version": "2023-06-01" }
        : { Authorization: `Bearer ${creds.apiKey}` };
    const res = await platformFetch(`${base}${def.modelsPath ?? "/models"}`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => ({ id: m.id, label: m.id }));
  } catch {
    return [];
  }
}
