import { db } from "./db";
import { extractPdf } from "./pdf";
import { extractPptx, PPTX_MIME } from "./pptx";
import { DEFAULT_MODE } from "./modes";
import type { Book, Chapter, Lesson } from "./types";
import { uid } from "./util";

export async function addBook(
  file: File,
  options: {
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<Book> {
  const lower = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
  const isPptx = file.type === PPTX_MIME || lower.endsWith(".pptx");
  if (!isPdf && !isPptx) {
    throw new Error("Cove needs a PDF or PowerPoint note.");
  }
  if (file.size === 0) {
    throw new Error("That file is empty.");
  }

  const id = uid();
  const extracted = isPptx
    ? await extractPptx(id, file, {
        signal: options.signal,
        onProgress: options.onProgress,
      })
    : await extractPdf(id, file, {
        signal: options.signal,
        onProgress: options.onProgress,
      });
  const now = Date.now();
  const book: Book = {
    id,
    title: extracted.title,
    author: extracted.author,
    fileName: file.name,
    format: isPptx ? "pptx" : "pdf",
    pageCount: extracted.pageCount,
    sizeBytes: file.size,
    cover: extracted.cover,
    createdAt: now,
    lastOpenedAt: now,
    chapters: extracted.chapters,
    chapterSource: extracted.chapterSource,
    scannedPages: extracted.scannedPages,
    extracted: true,
  };

  await db.transaction(
    "rw",
    [db.books, db.pages, db.files, db.pageImages, db.figures],
    async () => {
      await db.books.put(book);
      await db.pages.bulkPut(extracted.pages);
      if (extracted.pageImages?.length) {
        await db.pageImages.bulkPut(extracted.pageImages);
      }
      if (extracted.figures?.length) {
        await db.figures.bulkPut(extracted.figures);
      }
      await db.files.put({
        bookId: id,
        blob: file,
        mime: file.type || (isPptx ? PPTX_MIME : "application/pdf"),
      });
    },
  );
  return book;
}

export async function latestLessonForChapter(
  bookId: string,
  chapterId: string,
): Promise<Lesson | undefined> {
  const lessons = await db.lessons
    .where("bookId")
    .equals(bookId)
    .filter((lesson) => lesson.chapterId === chapterId)
    .toArray();
  lessons.sort((a, b) => b.updatedAt - a.updatedAt);
  return lessons[0];
}

export async function openLesson(
  book: Book,
  chapter: Chapter,
): Promise<Lesson> {
  const existing = await latestLessonForChapter(book.id, chapter.id);
  const now = Date.now();
  await db.books.update(book.id, { lastOpenedAt: now });
  if (existing) return existing;

  const lesson: Lesson = {
    id: uid(),
    bookId: book.id,
    bookTitle: book.title,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    startPage: chapter.startPage,
    endPage: chapter.endPage,
    plan: [],
    currentIndex: 0,
    status: "planning",
    mode: DEFAULT_MODE,
    createdAt: now,
    updatedAt: now,
  };
  await db.lessons.put(lesson);
  return lesson;
}

export function customChapter(
  startPage: number,
  endPage: number,
  format: Book["format"] = "pdf",
): Chapter {
  const unit = format === "pptx" ? "Slide" : "Page";
  return {
    id: `custom:${startPage}-${endPage}`,
    title:
      startPage === endPage
        ? `${unit} ${startPage}`
        : `${unit}s ${startPage}–${endPage}`,
    startPage,
    endPage,
  };
}

export async function activeLessons(): Promise<Lesson[]> {
  const lessons = await db.lessons
    .where("status")
    .anyOf(["active", "planning"])
    .toArray();
  return lessons.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function renameBook(bookId: string, title: string): Promise<void> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!clean) return;
  await db.books.update(bookId, { title: clean });
}
