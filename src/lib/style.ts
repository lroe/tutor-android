import type { Message } from "./types";

const STYLE_PATTERNS: RegExp[] = [
  /\b(eli5|explain like i(?:'m| am) (?:5|five)|like a (?:5|five)[- ]year[- ]old)\b/i,
  /\b(plain (?:english|language)|simple(?:r)? (?:words|language|terms)|no jargon|easy words|keep it simple)\b/i,
  /\b(simpler|simplify|simply)\b/i,
  /\b(textbook(?: style| language)?|jargon|more detailed|more detail|in[- ]depth|deeper explanation)\b/i,
  /\b(socratic|first[- ]principles?|feynman|clinical|exam[- ]focused)\b/i,
  /\b(shorter|be brief|more concise|fewer words|one paragraph|two sentences)\b/i,
  /\b(use (?:an? )?analogy|analogies|give (?:me )?examples?|bullet points?|step[- ]by[- ]step)\b/i,
  /\b(back to normal|normal style|default style|usual style)\b/i,
];

const RESET_PATTERN = /\b(back to normal|normal style|default style|usual style)\b/i;
const REQUEST_CUE =
  /\b(please|pls|can you|could you|explain|teach|use|make it|keep it|be more|be less|switch|from now on|let'?s|talk|write)\b/i;
const EXACT_REQUEST =
  /^(eli5|socratic|textbook|first principles|clinical|exam|simpler|shorter|more detail|in depth|be brief)$/i;

export function isStyleInstruction(text: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length > 240) return false;
  if (RESET_PATTERN.test(clean)) return true;
  if (!REQUEST_CUE.test(clean) && !EXACT_REQUEST.test(clean)) return false;
  return STYLE_PATTERNS.some((pattern) => pattern.test(clean));
}

export function styleFor(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    const text = message.content.replace(/\s+/g, " ").trim();
    if (!isStyleInstruction(text)) continue;
    return RESET_PATTERN.test(text)
      ? "Return to the selected learning mode with no extra style constraints."
      : text.slice(0, 240);
  }
  return "";
}
