export class AIError extends Error {
  status?: number;
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "AIError";
    this.status = status;
    this.detail = detail;
  }
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number; status?: string };
}

export interface GeminiCallOptions {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  thinkingLevel?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
  image?: { mimeType: string; data: string };
  signal?: AbortSignal;
}

function endpoint(model: string, method: string): string {
  const cleaned = model.replace(/^models\//, "").trim();
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleaned,
  )}:${method}`;
}

function friendlyError(raw: string, status: number): AIError {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as GeminiResponse;
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    // keep raw text
  }
  const lower = detail.toLowerCase();
  if (status === 400 && lower.includes("api key")) {
    return new AIError(
      "That Gemini key doesn't look valid. Check it in Settings.",
      status,
    );
  }
  if (status === 400 && lower.includes("thinking")) {
    return new AIError(
      "This model doesn't support the requested thinking mode. Try another model in Settings.",
      status,
    );
  }
  if (status === 401 || status === 403) {
    return new AIError(
      "This key isn't allowed to use that model. Check the key or pick another model in Settings.",
      status,
    );
  }
  if (status === 404) {
    return new AIError(
      "That model isn't available for this key. Choose another model in Settings.",
      status,
    );
  }
  if (status === 429) {
    return new AIError(
      "Gemini is taking a breath — it's rate-limited right now. Try again in a minute.",
      status,
    );
  }
  if (status >= 500) {
    return new AIError(
      "Gemini had a small hiccup. Your work is safe — try again.",
      status,
    );
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return new AIError(
      "Gemini paused on that response. Try rephrasing your message.",
      status,
    );
  }
  return new AIError(
    detail.length > 180 ? `${detail.slice(0, 177)}…` : detail,
    status,
  );
}

async function buildResponse(
  response: Response,
  options: GeminiCallOptions,
  allowThinkingRetry: boolean,
  stream: boolean,
): Promise<Response> {
  if (response.ok) return response;
  const raw = await response.text().catch(() => "");
  if (
    allowThinkingRetry &&
    response.status === 400 &&
    options.thinkingLevel &&
    /thinking/i.test(raw)
  ) {
    return fetchRequest({ ...options, thinkingLevel: undefined }, true, stream);
  }
  throw friendlyError(raw || `HTTP ${response.status}`, response.status);
}

async function fetchRequest(
  options: GeminiCallOptions,
  allowThinkingRetry = true,
  stream = false,
): Promise<Response> {
  if (!options.apiKey.trim()) {
    throw new AIError("Add your Gemini API key in Settings first.");
  }
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  };
  if (options.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.schema;
  }
  if (options.thinkingLevel) {
    generationConfig.thinkingConfig = {
      thinkingLevel: options.thinkingLevel,
    };
  }

  const parts: GeminiPart[] = [];
  if (options.image) {
    parts.push({
      inlineData: {
        mimeType: options.image.mimeType,
        data: options.image.data,
      },
    });
  }
  parts.push({ text: options.prompt });

  const method = stream ? "streamGenerateContent" : "generateContent";
  const url = stream
    ? `${endpoint(options.model, method)}?alt=sse`
    : endpoint(options.model, method);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey.trim(),
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.system }] },
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AIError(
      "Couldn't reach Gemini. Check your internet connection and try again.",
    );
  }
  return buildResponse(response, options, allowThinkingRetry, stream);
}

function extractText(data: GeminiResponse): string {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) {
      throw new AIError("Gemini blocked that request. Try rephrasing it.");
    }
    throw new AIError("Gemini returned an empty reply. Try again.");
  }
  const parts = candidate.content?.parts ?? [];
  const text = parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text ?? "")
    .join("");
  if (!text.trim()) {
    if (candidate.finishReason === "SAFETY") {
      throw new AIError("Gemini paused on that response. Try rephrasing it.");
    }
    if (candidate.finishReason === "MAX_TOKENS") {
      throw new AIError("Gemini ran out of room. Try a shorter chapter or a smaller range.");
    }
    throw new AIError("Gemini returned an empty reply. Try again.");
  }
  return text.trim();
}

function stripFences(text: string): string {
  let value = text.trim();
  if (value.startsWith("```")) {
    value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    value = value.slice(firstBrace, lastBrace + 1);
  }
  return value;
}

export async function generateJson<T>(
  options: GeminiCallOptions,
): Promise<T> {
  const response = await fetchRequest(options);
  const payload = (await response.json()) as GeminiResponse;
  const text = extractText(payload);
  try {
    return JSON.parse(stripFences(text)) as T;
  } catch {
    throw new AIError("Gemini sent an answer in an unexpected shape. Try again.");
  }
}

export async function generateText(
  options: GeminiCallOptions,
): Promise<string> {
  const response = await fetchRequest(options);
  const payload = (await response.json()) as GeminiResponse;
  return extractText(payload);
}

export async function streamText(
  options: GeminiCallOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  const response = await fetchRequest(
    {
      ...options,
      thinkingLevel: options.thinkingLevel,
    },
    true,
    true,
  );

  if (!response.body) {
    const payload = (await response.json()) as GeminiResponse;
    const text = extractText(payload);
    onDelta(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let finishReason = "";
  let blocked = false;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let payload: GeminiResponse;
    try {
      payload = JSON.parse(data) as GeminiResponse;
    } catch {
      return;
    }
    if (payload.error) {
      throw friendlyError(JSON.stringify(payload), payload.error.code ?? 500);
    }
    if (payload.promptFeedback?.blockReason) blocked = true;
    const candidate = payload.candidates?.[0];
    if (!candidate) return;
    if (candidate.finishReason) finishReason = candidate.finishReason;
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      if (!part.text || part.thought) continue;
      full += part.text;
      onDelta(part.text);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    if (buffer.trim()) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!full.trim()) {
    if (blocked || finishReason === "SAFETY") {
      throw new AIError("Gemini paused on that response. Try rephrasing your message.");
    }
    if (finishReason === "MAX_TOKENS") {
      throw new AIError("That answer got cut off. Try again or ask for less.");
    }
    throw new AIError("Gemini went quiet. Try again.");
  }
  return full.trim();
}

export async function testConnection(
  apiKey: string,
  model: string,
): Promise<void> {
  const response = await fetchRequest({
    apiKey,
    model,
    system: "You are a concise assistant.",
    prompt: "Reply with the single word: ready",
    maxOutputTokens: 300,
    thinkingLevel: "LOW",
  });
  const payload = (await response.json()) as GeminiResponse;
  extractText(payload);
}

export function describeAIError(error: unknown): string {
  if (error instanceof AIError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Stopped.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}
