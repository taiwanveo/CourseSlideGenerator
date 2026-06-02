import type { ProviderDef, ProviderId } from "./types";

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    apiStyle: "openai",
    baseUrl: "https://api.openai.com/v1",
    modelsPath: "/models",
    defaultModel: "gpt-4o-mini",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    name: "Google Gemini",
    apiStyle: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsPath: "/models",
    defaultModel: "gemini-2.0-flash",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    apiStyle: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    modelsPath: "/models",
    defaultModel: "openai/gpt-4o-mini",
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    apiStyle: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    modelsPath: "/models",
    defaultModel: "claude-3-5-sonnet-latest",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "groq",
    name: "Groq",
    apiStyle: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    modelsPath: "/models",
    defaultModel: "llama-3.3-70b-versatile",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "mistral",
    name: "Mistral",
    apiStyle: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    modelsPath: "/models",
    defaultModel: "mistral-large-latest",
    docsUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "xai",
    name: "xAI Grok",
    apiStyle: "openai",
    baseUrl: "https://api.x.ai/v1",
    modelsPath: "/models",
    defaultModel: "grok-2-latest",
    docsUrl: "https://console.x.ai",
  },
];

const MAP = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: ProviderId): ProviderDef {
  return MAP.get(id) ?? PROVIDERS[0]!;
}
