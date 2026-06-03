/**
 * 統一聊天客戶端 — 支援 OpenAI 相容 / Anthropic / Google 三種 API 風格。
 * 桌面版（Tauri）可注入 platformFetch 以繞過 CORS；瀏覽器開發退回 window.fetch。
 */
import { getProvider } from "./providers";
import type { ChatMessage, GenOptions, ModelInfo, ProviderCredentials } from "./types";

export type PlatformFetch = typeof fetch;

const JSON_SYSTEM_SUFFIX =
  "\n\n【輸出格式】只輸出單一合法 JSON 物件，不要 markdown、不要說明文字。";

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
  const headers = buildOpenAIHeaders(creds);
  const attempts: Array<{ forceJson: boolean }> = [{ forceJson: Boolean(opts.json) }];
  if (opts.json) attempts.push({ forceJson: false });

  let lastErr: Error | null = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const body = buildOpenAIRequestBody(creds.model, messages, opts, attempts[i]!.forceJson);
      const res = await platformFetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      const rawText = await res.text();
      let data: OpenAIChatResponse;
      try {
        data = JSON.parse(rawText) as OpenAIChatResponse;
      } catch {
        throw new Error(`LLM 回傳非 JSON（HTTP ${res.status}）：${rawText.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(formatOpenAIHttpError(res.status, data, rawText));
      return pickOpenAIText(data);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i === attempts.length - 1) break;
    }
  }
  throw lastErr ?? new Error("LLM 呼叫失敗");
}

function buildOpenAIHeaders(creds: ProviderCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${creds.apiKey}`,
  };
  if (creds.providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://course-slide-generator.local";
    headers["X-Title"] = "CourseSlideGenerator";
  }
  return headers;
}

function buildOpenAIRequestBody(
  model: string,
  messages: ChatMessage[],
  opts: GenOptions,
  forceJson: boolean,
): Record<string, unknown> {
  const reasoning = isReasoningModel(model);
  const prepared = reasoning ? convertMessagesForReasoning(messages) : withJsonHint(messages, forceJson && opts.json);
  const payload: Record<string, unknown> = {
    model,
    messages: prepared,
  };

  if (opts.maxTokens) {
    if (reasoning || prefersCompletionTokens(model)) {
      payload.max_completion_tokens = opts.maxTokens;
    } else {
      payload.max_tokens = opts.maxTokens;
    }
  }

  if (!reasoning) {
    payload.temperature = opts.temperature ?? 0.7;
  }

  if (forceJson && opts.json && !reasoning && supportsJsonResponseFormat(model)) {
    payload.response_format = { type: "json_object" };
  }

  return payload;
}

function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return /^o[0-9][-\w]*/.test(m) || m.includes("reasoning") || m.includes("deepseek-r1");
}

function prefersCompletionTokens(model: string): boolean {
  const m = model.toLowerCase();
  return isReasoningModel(m) || m.includes("gpt-4.1") || m.includes("gpt-5");
}

function supportsJsonResponseFormat(model: string): boolean {
  return !isReasoningModel(model);
}

function convertMessagesForReasoning(messages: ChatMessage[]): ChatMessage[] {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  if (!system) return rest;
  return [{ role: "user", content: `[系統指示]\n${system}` }, ...rest];
}

type OpenAIChatChoice = {
  message?: {
    content?: string | Array<string | { type?: string; text?: string }> | null;
    refusal?: string | null;
  };
  text?: string;
  finish_reason?: string;
};

type OpenAIChatResponse = {
  choices?: OpenAIChatChoice[] | null;
  data?: { choices?: OpenAIChatChoice[] | null };
  error?: { message?: string; code?: string | number; type?: string };
  message?: string;
  msg?: string;
  code?: number | string;
  output_text?: string;
  output?: string | { text?: string };
  result?: string;
};

function formatOpenAIHttpError(status: number, data: OpenAIChatResponse, rawText: string): string {
  const detail =
    data.error?.message ??
    data.msg ??
    (typeof data.message === "string" ? data.message : null) ??
    rawText.slice(0, 240);
  return `LLM 錯誤 ${status}: ${detail}`;
}

function extractApiError(data: OpenAIChatResponse): string | null {
  if (data.error?.message) return `LLM API 錯誤：${data.error.message}`;
  if (typeof data.msg === "string" && data.msg.trim()) return `LLM API 錯誤：${data.msg.trim()}`;
  if (
    typeof data.message === "string" &&
    data.message.trim() &&
    (!data.choices || data.choices.length === 0)
  ) {
    return `LLM API 錯誤：${data.message.trim()}`;
  }
  if (data.code !== undefined && data.code !== 0 && typeof data.msg === "string") {
    return `LLM API 錯誤（code ${data.code}）：${data.msg}`;
  }
  return null;
}

function pickOpenAIText(data: OpenAIChatResponse): string {
  const apiErr = extractApiError(data);
  if (apiErr) throw new Error(apiErr);

  const choices = data.choices ?? data.data?.choices ?? undefined;
  const choice = choices?.[0];

  if (choice) {
    const msg = choice.message;
    if (msg?.refusal?.trim()) {
      throw new Error(`模型拒絕回應：${msg.refusal.trim()}`);
    }

    let text = "";
    if (typeof msg?.content === "string") text = msg.content;
    else if (Array.isArray(msg?.content)) {
      text = msg.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const p = part as { type?: string; text?: string };
            if (p.type === "reasoning" || p.type === "thinking") return "";
            if ("text" in p) return String(p.text ?? "");
          }
          return "";
        })
        .join("");
    } else if (typeof choice.text === "string") {
      text = choice.text;
    }

    if (text.trim()) return text;

    const reason = choice.finish_reason ? `（finish_reason: ${choice.finish_reason}）` : "";
    throw new Error(
      `AI 回傳內容為空${reason}。此模型可能不支援 JSON 模式或參數不相容，請改試 gpt-4o-mini / gemini-2.0-flash。`,
    );
  }

  const alt =
    (typeof data.output_text === "string" ? data.output_text : "") ||
    (typeof data.output === "string" ? data.output : "") ||
    (typeof data.output === "object" && data.output?.text ? data.output.text : "") ||
    (typeof data.result === "string" ? data.result : "");

  if (alt.trim()) return alt.trim();

  const keys = Object.keys(data as object).slice(0, 10).join("、") || "（無）";
  const snippet = JSON.stringify(data).slice(0, 200);
  throw new Error(
    `AI 回傳內容為空（API 未包含 choices）。常見原因：供應商與模型不匹配、模型不支援 chat/completions、或 API 回傳非標準格式。回應欄位：${keys}。片段：${snippet}…`,
  );
}

function withJsonHint(messages: ChatMessage[], json?: boolean): ChatMessage[] {
  if (!json || messages.length === 0) return messages;
  const out = [...messages];
  const sysIdx = out.findIndex((m) => m.role === "system");
  if (sysIdx >= 0) {
    out[sysIdx] = { ...out[sysIdx]!, content: out[sysIdx]!.content + JSON_SYSTEM_SUFFIX };
  } else {
    out.unshift({ role: "system", content: JSON_SYSTEM_SUFFIX.trim() });
  }
  return out;
}

async function chatAnthropic(
  base: string,
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions,
): Promise<string> {
  const systemRaw = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const system = opts.json ? systemRaw + JSON_SYSTEM_SUFFIX : systemRaw;
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
  const text = data.content?.map((c) => c.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("AI 回傳內容為空。請確認 Anthropic 模型名稱正確，或稍後再試。");
  }
  return text;
}

async function chatGoogle(
  base: string,
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions,
): Promise<string> {
  const systemRaw = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const system = opts.json ? systemRaw + JSON_SYSTEM_SUFFIX : systemRaw;
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
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini 拒絕回應（${data.promptFeedback.blockReason}）。請調整輸入內容後再試。`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("AI 回傳內容為空。請確認 Gemini 模型名稱正確，或改試 gemini-2.0-flash。");
  }
  return text;
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
