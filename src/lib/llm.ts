import {
  AIError,
  generateJson as geminiGenerateJson,
  generateText as geminiGenerateText,
  streamText as geminiStreamText,
  type GeminiCallOptions,
} from "./gemini";
import {
  generateJson as opencodeGenerateJson,
  generateText as opencodeGenerateText,
  streamText as opencodeStreamText,
  type OpenAICallOptions,
} from "./opencode";
import { activeModel, isConfigured, missingConfig } from "./provider";
import type { Settings } from "./types";

export { AIError };

export type LLMCallOptions = OpenAICallOptions;

function assertConfigured(settings: Settings): void {
  if (!isConfigured(settings)) {
    throw new AIError(missingConfig(settings));
  }
}

function forGemini(options: LLMCallOptions): GeminiCallOptions {
  return {
    apiKey: options.settings.geminiKey,
    model: activeModel(options.settings),
    system: options.system,
    prompt: options.prompt,
    schema: options.schema,
    maxOutputTokens: options.maxOutputTokens,
    thinkingLevel: options.thinkingLevel,
    image: options.image,
    signal: options.signal,
  };
}

export async function generateJson<T>(
  options: LLMCallOptions,
): Promise<T> {
  assertConfigured(options.settings);
  return options.settings.provider === "gemini"
    ? geminiGenerateJson<T>(forGemini(options))
    : opencodeGenerateJson<T>(options);
}

export async function generateText(
  options: LLMCallOptions,
): Promise<string> {
  assertConfigured(options.settings);
  return options.settings.provider === "gemini"
    ? geminiGenerateText(forGemini(options))
    : opencodeGenerateText(options);
}

export async function streamText(
  options: LLMCallOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  assertConfigured(options.settings);
  return options.settings.provider === "gemini"
    ? geminiStreamText(forGemini(options), onDelta)
    : opencodeStreamText(options, onDelta);
}
