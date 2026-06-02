/** LLM 供應商與聊天介面型別。 */

export type ProviderId =
  | "openai"
  | "google"
  | "openrouter"
  | "anthropic"
  | "groq"
  | "mistral"
  | "xai";

export type ApiStyle = "openai" | "anthropic" | "google";

export interface ProviderDef {
  id: ProviderId;
  name: string;
  apiStyle: ApiStyle;
  baseUrl: string;
  /** 取得模型清單的端點（相對 baseUrl 或完整 URL） */
  modelsPath?: string;
  defaultModel: string;
  docsUrl: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenOptions {
  temperature?: number;
  maxTokens?: number;
  /** 要求 JSON 物件輸出 */
  json?: boolean;
  signal?: AbortSignal;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ProviderCredentials {
  providerId: ProviderId;
  apiKey: string;
  /** 自訂 baseUrl（可選，覆蓋預設） */
  baseUrl?: string;
  model: string;
}
