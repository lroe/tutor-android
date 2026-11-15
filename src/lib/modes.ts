import type { LessonMode } from "./types";

export interface ModeInfo {
  id: LessonMode;
  label: string;
  short: string;
  description: string;
  prompt: string;
}

export const MODES: ModeInfo[] = [
  {
    id: "eli5-textbook",
    label: "ELI5 + textbook",
    short: "ELI5 + textbook",
    description: "Simple first, then the textbook version.",
    prompt:
      "Teach in two parts. Part 1: explain like she is five. Use short sentences, everyday words, and one concrete analogy. Introduce the proper term only after the simple explanation. End Part 1 with one check question after ---CHECK---. Part 2: after the check question, put ---TEXTBOOK--- on its own line, then give the same idea in precise textbook language. Do not label Part 2, do not say it is a restatement, and do not repeat the check question or add another question. Keep Part 2 to 2-4 sentences. Put any figure token in Part 1 only.",
  },
  {
    id: "textbook",
    label: "Textbook",
    short: "Textbook",
    description: "Plain language first, then the proper term.",
    prompt:
      "Teach in clear textbook language. Start with a plain-language explanation, then give the proper term. Prioritise accuracy, the mechanism, and the distinctions that matter.",
  },
  {
    id: "eli5",
    label: "ELI5",
    short: "ELI5",
    description: "Everyday words and one concrete analogy.",
    prompt:
      "Explain like she is five. Use short sentences, everyday words, and one concrete analogy. Introduce the proper term only after the simple explanation. Avoid jargon until the term is earned.",
  },
  {
    id: "socratic",
    label: "Socratic",
    short: "Socratic",
    description: "Questions guide you to the idea.",
    prompt:
      "Teach Socratically. Give only a one-sentence orientation, then ask one guiding question that makes her reason toward the idea. Do not explain the full mechanism yet. The check question is that guiding question. After her answer, use the feedback to draw out the reasoning.",
  },
  {
    id: "first-principles",
    label: "First principles",
    short: "First principles",
    description: "Build from basic facts, step by step.",
    prompt:
      "Build the idea from first principles. Start with the most basic physical or biological facts, then reason step by step to the conclusion. Show the causal chain. Introduce terminology only when it becomes necessary.",
  },
  {
    id: "clinical",
    label: "Clinical",
    short: "Clinical",
    description: "Start with a patient, then the mechanism.",
    prompt:
      "Start with a short patient or clinical scenario. Then explain the mechanism and what she would notice, in that order. Keep it concrete and clinically relevant. End with the check.",
  },
  {
    id: "exam",
    label: "Exam",
    short: "Exam",
    description: "High-yield distinctions and memory hooks.",
    prompt:
      "Teach for an exam. State the high-yield distinction, the likely question, and a compact memory hook. Keep it tight and avoid long stories.",
  },
];

export const DEFAULT_MODE: LessonMode = "eli5-textbook";

export function modeInfo(mode: LessonMode | undefined): ModeInfo {
  return (
    MODES.find((item) => item.id === mode) ??
    MODES.find((item) => item.id === DEFAULT_MODE) ??
    MODES[0]
  );
}
