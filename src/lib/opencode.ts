import { AIError } from "./gemini";
import { activeModel } from "./provider";
import type { Settings } from "./types";

export interface OpenAICallOptions {
  settings: Settings;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  thinkingLevel?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
  image?: { mimeType: string; data: string };
  signal?: AbortSignal;
}

type JsonFormat = "json_schema" | "json_object" | "none";

interface OpenAIChoice {
  message?: {
    content?: string | null;
    reasoning_content?: string | null;
  };
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
  };
  finish_reason?: string | null;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  error?: { message?: string; type?: string; code?: number | string } | string;
  message?: string;
}

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

let sessionCache = "";

function sessionId(): string {
  if (sessionCache) return sessionCache;
  try {
    const stored = localStorage.getItem("cove.session.v1");
    if (stored) {
      sessionCache = stored;
      return stored;
    }
    const id = makeId();
    localStorage.setItem("cove.session.v1", id);
    sessionCache = id;
    return id;
  } catch {
    sessionCache = makeId();
    return sessionCache;
  }
}

function proxyBase(proxyUrl: string): string {
  const base = proxyUrl.trim().replace(/\/+$/, "");
  if (!base) throw new AIError("Add your Worker URL in Settings first.");
  if (!/^https?:\/\//i.test(base)) {
    throw new AIError("The Worker URL needs to start with https://.");
  }
  return base
    .replace(/\/v1\/chat\/completions$/i, "")
    .replace(/\/v1$/i, "");
}

function endpoint(proxyUrl: string): string {
  return `${proxyBase(proxyUrl)}/v1/chat/completions`;
}

export async function testProxy(proxyUrl: string): Promise<void> {
  const base = proxyBase(proxyUrl);
  let response: Response;
  try {
    response = await fetch(`${base}/health`);
  } catch {
    throw new AIError(
      "Couldn't reach that Worker. Check the URL and that it's deployed.",
    );
  }
  if (!response.ok) {
    throw new AIError(`The Worker answered with HTTP ${response.status}.`);
  }
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
  } | null;
  if (!data?.ok) {
    throw new AIError("That URL answered, but it isn't a Cove Worker.");
  }
}

function schemaType(value: string): string {
  const map: Record<string, string> = {
    OBJECT: "object",
    ARRAY: "array",
    STRING: "string",
    INTEGER: "integer",
    NUMBER: "number",
    BOOLEAN: "boolean",
  };
  return map[value.toUpperCase()] ?? value.toLowerCase();
}

function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== "object") return node;
  const source = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "type" && typeof value === "string") {
      out[key] = schemaType(value);
    } else if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(
          ([name, property]) => [name, toJsonSchema(property)],
        ),
      );
    } else if (key === "items" || key === "additionalProperties") {
      out[key] = toJsonSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function schemaHint(
  schema: Record<string, unknown> | undefined,
  format: JsonFormat,
): string {
  if (!schema) return "";
  if (format === "json_schema") {
    return "\n\nReturn only one JSON object. No prose, no code fences.";
  }
  return `\n\nReturn only one JSON object matching this JSON Schema. No prose, no code fences.\n${JSON.stringify(
    toJsonSchema(schema),
  )}`;
}

function reasoningEffort(
  level: OpenAICallOptions["thinkingLevel"],
): string | undefined {
  if (level === "MINIMAL" || level === "LOW") return "low";
  if (level === "MEDIUM" || level === "HIGH") return "high";
  return undefined;
}

function buildBody(
  options: OpenAICallOptions,
  stream: boolean,
  format: JsonFormat,
): Record<string, unknown> {
  const prompt = `${options.prompt}${schemaHint(options.schema, format)}`;
  const content = options.image
    ? [
        {
          type: "image_url",
          image_url: {
            url: `data:${options.image.mimeType};base64,${options.image.data}`,
          },
        },
        { type: "text", text: prompt },
      ]
    : prompt;

  const requested = options.maxOutputTokens ?? 4096;
  const budget = requested >= 8192 ? requested + 4096 : 8192;

  const body: Record<string, unknown> = {
    model: activeModel(options.settings),
    messages: [
      { role: "system", content: options.system },
      { role: "user", content },
    ],
    max_tokens: budget,
    stream,
  };

  if (stream) body.stream_options = { include_usage: true };
  const effort = reasoningEffort(options.thinkingLevel);
  if (effort) body.reasoning_effort = effort;

  if (format === "json_schema" && options.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "cove_response",
        schema: toJsonSchema(options.schema),
      },
    };
  } else if (format === "json_object") {
    body.response_format = { type: "json_object" };
  }

  return body;
}

function errorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as OpenAIResponse;
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // keep raw text
  }
  return raw;
}

function friendlyError(raw: string, status: number): AIError {
  const detail = errorDetail(raw).trim() || `HTTP ${status}`;
  const lower = detail.toLowerCase();
  let message = detail.length > 220 ? `${detail.slice(0, 217)}…` : detail;

  if (status === 401 || status === 403) {
    message =
      "The Worker's OpenCode key isn't allowed. Check OPENCODE_API_KEY on the Worker.";
  } else if (status === 404) {
    message = "That Worker URL doesn't look right. Check it in Settings.";
  } else if (status === 429) {
    message = "OpenCode Go is rate-limited right now. Try again in a minute.";
  } else if (status === 413) {
    message = "That request is too large for the Worker. Try a smaller page range.";
  } else if (status >= 500) {
    message =
      "The Worker or OpenCode had a hiccup. Your work is safe — try again.";
  } else if (
    status === 400 &&
    (lower.includes("api key") ||
      lower.includes("unauthorized") ||
      lower.includes("permission"))
  ) {
    message =
      "The Worker's OpenCode key isn't valid. Check OPENCODE_API_KEY on the Worker.";
  } else if (
    status === 400 &&
    (lower.includes("image") || lower.includes("vision"))
  ) {
    message =
      "The model couldn't read that page image. Try again, or switch to Gemini in Settings.";
  } else if (
    status === 400 &&
    lower.includes("model") &&
    (lower.includes("not") ||
      lower.includes("unknown") ||
      lower.includes("invalid") ||
      lower.includes("unsupported"))
  ) {
    message =
      "That model isn't available on this Go plan. Check ALLOWED_MODELS on the Worker.";
  } else if (
    status === 400 &&
    (lower.includes("context") ||
      lower.includes("too long") ||
      lower.includes("token"))
  ) {
    message = "That page range is too long for the model. Try fewer pages.";
  }

  return new AIError(message, status, detail);
}

async function post(
  options: OpenAICallOptions,
  body: Record<string, unknown>,
  allowRetry = true,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(endpoint(options.settings.proxyUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cove-model": activeModel(options.settings),
        "x-opencode-session": sessionId(),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AIError(
      "Couldn't reach the Cove Worker. Check the Worker URL in Settings and that it's deployed.",
    );
  }

  if (response.ok) return response;

  const raw = await response.text().catch(() => "");
  const lower = raw.toLowerCase();

  if (allowRetry && response.status === 400) {
    if (body.reasoning_effort && lower.includes("reasoning")) {
      delete body.reasoning_effort;
      return post(options, body, false);
    }
    if (
      body.max_tokens &&
      (lower.includes("max_tokens") || lower.includes("max completion"))
    ) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
      return post(options, body, false);
    }
    if (body.stream_options && lower.includes("stream_options")) {
      delete body.stream_options;
      return post(options, body, false);
    }
  }

  throw friendlyError(raw || `HTTP ${response.status}`, response.status);
}

function extractMessage(payload: OpenAIResponse): string {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();

  if (payload.error) {
    throw friendlyError(JSON.stringify(payload), 500);
  }
  if (choice?.finish_reason === "length") {
    throw new AIError(
      "That answer got cut off. Try a smaller page range or ask for less.",
    );
  }
  if (choice?.message?.reasoning_content) {
    throw new AIError(
      "The model spent its output budget thinking and never wrote an answer. Try again.",
    );
  }
  throw new AIError("OpenCode returned an empty reply. Try again.");
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

function schemaRejected(error: unknown): boolean {
  return (
    error instanceof AIError &&
    error.status === 400 &&
    /response_format|json_schema|json schema|structured|schema/i.test(
      error.detail ?? "",
    )
  );
}

async function requestJson<T>(
  options: OpenAICallOptions,
  format: JsonFormat,
): Promise<T> {
  const response = await post(options, buildBody(options, false, format));
  let payload: OpenAIResponse;
  try {
    payload = (await response.json()) as OpenAIResponse;
  } catch {
    throw new AIError("OpenCode sent an answer we couldn't read. Try again.");
  }
  const text = extractMessage(payload);
  try {
    return JSON.parse(stripFences(text)) as T;
  } catch {
    throw new AIError(
      "OpenCode sent an answer in an unexpected shape. Try again.",
    );
  }
}

export async function generateJson<T>(
  options: OpenAICallOptions,
): Promise<T> {
  try {
    return await requestJson<T>(options, "json_schema");
  } catch (error) {
    if (!schemaRejected(error)) throw error;
    try {
      return await requestJson<T>(options, "json_object");
    } catch (second) {
      if (!schemaRejected(second)) throw second;
      return requestJson<T>(options, "none");
    }
  }
}

export async function generateText(
  options: OpenAICallOptions,
): Promise<string> {
  const response = await post(options, buildBody(options, false, "none"));
  let payload: OpenAIResponse;
  try {
    payload = (await response.json()) as OpenAIResponse;
  } catch {
    throw new AIError("OpenCode sent an answer we couldn't read. Try again.");
  }
  return extractMessage(payload);
}

export async function streamText(
  options: OpenAICallOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  const response = await post(options, buildBody(options, true, "none"));
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.body || contentType.includes("application/json")) {
    const payload = (await response.json()) as OpenAIResponse;
    const text = extractMessage(payload);
    onDelta(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let finishReason = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let payload: OpenAIResponse;
    try {
      payload = JSON.parse(data) as OpenAIResponse;
    } catch {
      return;
    }
    if (payload.error) {
      throw friendlyError(JSON.stringify(payload), 500);
    }
    const choice = payload.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta?.content;
    if (typeof delta === "string" && delta) {
      full += delta;
      onDelta(delta);
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
    if (finishReason === "length") {
      throw new AIError("That answer got cut off. Try again or ask for less.");
    }
    throw new AIError("OpenCode went quiet. Try again.");
  }
  return full.trim();
}
