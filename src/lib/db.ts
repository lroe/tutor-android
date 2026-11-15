import Dexie, { type Table } from "dexie";
import type {
  Activity,
  Book,
  Figure,
  Lesson,
  Message,
  PageImage,
  PageText,
  StoredFile,
} from "./types";
import { dayKey } from "./util";

class CoveDatabase extends Dexie {
  books!: Table<Book, string>;
  files!: Table<StoredFile, string>;
  pages!: Table<PageText, string>;
  lessons!: Table<Lesson, string>;
  messages!: Table<Message, number>;
  activity!: Table<Activity, string>;
  pageImages!: Table<PageImage, string>;
  figures!: Table<Figure, string>;

  constructor() {
    super("cove");
    this.version(1).stores({
      books: "id, createdAt, lastOpenedAt",
      files: "bookId",
      pages: "id, bookId, [bookId+pageNo]",
      lessons: "id, bookId, chapterId, status, updatedAt",
      messages: "++id, lessonId, [lessonId+createdAt]",
      activity: "date",
    });
    this.version(2).stores({
      books: "id, createdAt, lastOpenedAt",
      files: "bookId",
      pages: "id, bookId, [bookId+pageNo]",
      lessons: "id, bookId, chapterId, status, updatedAt",
      messages: "++id, lessonId, [lessonId+createdAt]",
      activity: "date",
      pageImages: "id, bookId, [bookId+pageNo]",
      figures: "id, bookId, [bookId+pageNo]",
    });
  }
}

export const db = new CoveDatabase();

export async function pagesFor(
  bookId: string,
  startPage: number,
  endPage: number,
): Promise<PageText[]> {
  return db.pages
    .where("[bookId+pageNo]")
    .between([bookId, startPage], [bookId, endPage], true, true)
    .toArray();
}

export async function deleteBookDeep(bookId: string): Promise<void> {
  const lessonIds = await db.lessons.where("bookId").equals(bookId).primaryKeys();
  await db.transaction(
    "rw",
    [
      db.books,
      db.files,
      db.pages,
      db.lessons,
      db.messages,
      db.pageImages,
      db.figures,
    ],
    async () => {
      if (lessonIds.length) {
        await db.messages.where("lessonId").anyOf(lessonIds).delete();
      }
      await db.lessons.where("bookId").equals(bookId).delete();
      await db.pages.where("bookId").equals(bookId).delete();
      await db.pageImages.where("bookId").equals(bookId).delete();
      await db.figures.where("bookId").equals(bookId).delete();
      await db.files.delete(bookId);
      await db.books.delete(bookId);
    },
  );
}

export async function bumpActivity(concepts = 0, checks = 0): Promise<void> {
  const date = dayKey();
  await db.transaction("rw", db.activity, async () => {
    const current = await db.activity.get(date);
    await db.activity.put({
      date,
      concepts: (current?.concepts ?? 0) + concepts,
      checks: (current?.checks ?? 0) + checks,
    });
  });
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.books,
      db.files,
      db.pages,
      db.lessons,
      db.messages,
      db.activity,
      db.pageImages,
      db.figures,
    ],
    async () => {
      await Promise.all([
        db.books.clear(),
        db.files.clear(),
        db.pages.clear(),
        db.lessons.clear(),
        db.messages.clear(),
        db.activity.clear(),
        db.pageImages.clear(),
        db.figures.clear(),
      ]);
    },
  );
}
