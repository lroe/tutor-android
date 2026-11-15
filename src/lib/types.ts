export interface Chapter {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
}

export type BookFormat = "pdf" | "pptx";

export interface Book {
  id: string;
  title: string;
  author?: string;
  fileName: string;
  format?: BookFormat;
  pageCount: number;
  sizeBytes: number;
  cover?: string;
  createdAt: number;
  lastOpenedAt: number;
  chapters: Chapter[];
  chapterSource: "outline" | "headings" | "ranges";
  scannedPages: number[];
  extracted: boolean;
}

export interface StoredFile {
  bookId: string;
  blob: Blob;
  mime: string;
}

export interface PageText {
  id: string;
  bookId: string;
  pageNo: number;
  text: string;
  source: "pdf" | "pptx" | "ocr";
}

export type FigureKind = "figure" | "diagram" | "photo" | "table" | "chart";

export interface PageImage {
  id: string;
  bookId: string;
  pageNo: number;
  dataUrl: string;
  figuresChecked: boolean;
  createdAt: number;
}

export interface FigureCandidate {
  box: [number, number, number, number];
  caption: string;
  kind: FigureKind;
}

export interface Figure extends FigureCandidate {
  id: string;
  bookId: string;
  pageNo: number;
  dataUrl: string;
  createdAt: number;
}

export interface VisualSelection {
  dataUrl: string;
  title: string;
  caption?: string;
  pageNo: number;
  kind: "page" | FigureKind;
}

export type Mastery = "passed" | "shaky" | "skipped";
export type Verdict = "correct" | "partial" | "incorrect" | "question";
export type ConceptKind = "recall" | "concept" | "apply";
export interface ConceptCheck {
  question: string;
  messageId: number;
  answered: boolean;
  verdict?: Exclude<Verdict, "question">;
  mastered?: boolean;
  attempts: number;
  followUp?: string;
}

export interface Concept {
  id: string;
  title: string;
  goal: string;
  kind: ConceptKind;
  pages: number[];
  keyTerms: string[];
  covered: boolean;
  mastery?: Mastery;
  check?: ConceptCheck;
  coveredAt?: number;
  reviewAt?: number;
  reviewCount?: number;
}

export type LessonMode =
  | "eli5-textbook"
  | "textbook"
  | "eli5"
  | "socratic"
  | "first-principles"
  | "clinical"
  | "exam";

export interface Lesson {
  id: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  startPage: number;
  endPage: number;
  plan: Concept[];
  currentIndex: number;
  status: "planning" | "active" | "done" | "error";
  mode?: LessonMode;
  createdAt: number;
  updatedAt: number;
}

export type MessageKind = "teach" | "chat" | "feedback" | "summary" | "note";

export interface Message {
  id?: number;
  lessonId: string;
  role: "tutor" | "user";
  kind: MessageKind;
  content: string;
  conceptIndex?: number;
  checkQuestion?: string;
  checkVerdict?: Verdict;
  verdict?: Verdict;
  createdAt: number;
}

export interface Activity {
  date: string;
  concepts: number;
  checks: number;
}

export type AIProvider = "opencode" | "gemini";

export interface Settings {
  provider: AIProvider;
  proxyUrl: string;
  geminiKey: string;
}

export interface PlanItem {
  title: string;
  goal: string;
  kind: ConceptKind;
  pages: number[];
  keyTerms: string[];
}

export interface ChatTurn {
  role: "tutor" | "student";
  text: string;
}

export interface Evaluation {
  verdict: Verdict;
  mastered: boolean;
  reply: string;
  followUp?: string;
}

export interface ExtractResult {
  title: string;
  author?: string;
  pageCount: number;
  chapters: Chapter[];
  chapterSource: Book["chapterSource"];
  scannedPages: number[];
  cover?: string;
  pages: PageText[];
  format?: BookFormat;
  pageImages?: PageImage[];
  figures?: Figure[];
}

export interface ExtractHooks {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}
