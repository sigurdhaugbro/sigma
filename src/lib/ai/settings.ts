export type Provider = "openai" | "anthropic";

export interface AiSettings {
  provider: Provider;
  models: Record<Provider, string>;
  keys: Partial<Record<Provider, string>>;
}

/** Claude is the primary provider; OpenAI stays available as an alternative. */
export const PROVIDERS: Provider[] = ["anthropic", "openai"];

export const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
};

export const PROVIDER_LABELS: Record<Provider, string> = { anthropic: "Claude (Anthropic)", openai: "OpenAI" };

const KEY = "setscreens:ai";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "anthropic",
  models: { anthropic: MODEL_SUGGESTIONS.anthropic[0], openai: MODEL_SUGGESTIONS.openai[0] },
  keys: {},
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...raw, models: { ...DEFAULT_AI_SETTINGS.models, ...raw.models }, keys: { ...raw.keys } };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(s: AiSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
