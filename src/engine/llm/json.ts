/**
 * 從 LLM 文字回應萃取 JSON，並在失敗時自動重試一次。
 */
import { chat } from "./client";
import type { ChatMessage, GenOptions, ProviderCredentials } from "./types";

const JSON_ONLY_HINT =
  "請只輸出單一合法 JSON 物件（或陣列），不要 markdown 程式碼區塊、不要前言或結語。";

/** 移除推理模型常見的前置雜訊（think 標籤等）。 */
export function stripModelNoise(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

/** 從 LLM 回傳中萃取 JSON（容忍 ```json 包裹、前後雜訊、尾逗號與截斷）。 */
export function extractJson(raw: string): unknown {
  const trimmed = stripModelNoise(raw);
  if (!trimmed) {
    throw new Error("AI 未回傳有效 JSON（回應為空，請確認模型是否支援 JSON 模式或換用 gpt-4o-mini / gemini-2.0-flash）");
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  const startObj = body.indexOf("{");
  const startArr = body.indexOf("[");
  let start = -1;
  if (startObj >= 0 && (startArr < 0 || startObj <= startArr)) start = startObj;
  else if (startArr >= 0) start = startArr;

  if (start < 0) {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `AI 未回傳有效 JSON（回應中找不到 { 或 [）。開頭內容：「${preview}${trimmed.length > 120 ? "…" : ""}」`,
    );
  }

  const balanced = sliceBalanced(body, start);
  const candidate = balanced ?? body.slice(start);

  try {
    return JSON.parse(candidate);
  } catch {
    const repaired = repairJson(candidate);
    try {
      return JSON.parse(repaired);
    } catch (e) {
      throw new Error(`AI 回傳的 JSON 無法解析：${e instanceof Error ? e.message : "格式錯誤"}`);
    }
  }
}

/** 呼叫 LLM 並解析 JSON；若格式錯誤會重試一次。 */
export async function requestJson(
  creds: ProviderCredentials,
  messages: ChatMessage[],
  opts: GenOptions,
  label: string,
): Promise<unknown> {
  let lastRaw = "";
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const batch =
      attempt === 0
        ? messages
        : [
            ...messages,
            { role: "assistant" as const, content: lastRaw || "（空回應）" },
            { role: "user" as const, content: `${JSON_ONLY_HINT}\n上一則回覆無法解析，請修正後重送。` },
          ];

    lastRaw = await chat(creds, batch, { ...opts, json: true });
    try {
      return extractJson(lastRaw);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr ?? new Error(`${label}：AI 未回傳有效 JSON`);
}

function sliceBalanced(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function repairJson(input: string): string {
  let s = input;
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) s += '"';
  s = s.replace(/,\s*"[^"]*"\s*:?\s*$/g, "");
  s = s.replace(/,\s*$/g, "");
  while (stack.length > 0) {
    s = s.replace(/,\s*$/g, "");
    s += stack.pop();
  }
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}
