import { GEMINI_MODEL, OPENCODE_MODEL } from "./models";
import type { Settings } from "./types";

export function activeModel(settings: Settings): string {
  return settings.provider === "gemini" ? GEMINI_MODEL : OPENCODE_MODEL;
}

export function isConfigured(settings: Settings): boolean {
  return settings.provider === "gemini"
    ? Boolean(settings.geminiKey.trim())
    : Boolean(settings.proxyUrl.trim());
}

export function missingConfig(settings: Settings): string {
  return settings.provider === "gemini"
    ? "Add your Gemini API key in Settings first."
    : "Add your Worker URL in Settings first.";
}
