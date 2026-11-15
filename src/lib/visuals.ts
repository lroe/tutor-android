import { findFigures } from "./ai";
import { db } from "./db";
import { renderPageImage, withPdf } from "./pdf";
import type { Figure, PageImage, Settings } from "./types";
import { isConfigured } from "./provider";
import { clamp, uid } from "./util";

const pagePromises = new Map<string, Promise<PageImage | null>>();
const figurePromises = new Map<string, Promise<Figure[]>>();

export function visualPages(pages: number[], limit = 3): number[] {
  const valid = [...new Set(pages.filter((page) => Number.isFinite(page) && page > 0))]
    .map((page) => Math.round(page))
    .sort((a, b) => a - b);
  if (!valid.length) return [];
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (last - first <= limit - 1) {
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }
  return valid.slice(0, limit);
}

export async function getPageImage(
  bookId: string,
  pageNo: number,
): Promise<PageImage | null> {
  const id = `${bookId}:${pageNo}`;
  const cached = await db.pageImages.get(id);
  if (cached) return cached;
  const book = await db.books.get(bookId);
  if (book?.format === "pptx") return null;

  const inflight = pagePromises.get(id);
  if (inflight) return inflight;

  const promise = (async (): Promise<PageImage | null> => {
    const file = await db.files.get(bookId);
    if (!file) return null;
    try {
      const dataUrl = await withPdf(file.blob, (document) =>
        renderPageImage(document, pageNo, {
          maxWidth: 1100,
          maxHeight: 1500,
          quality: 0.8,
        }),
      );
      const record: PageImage = {
        id,
        bookId,
        pageNo,
        dataUrl,
        figuresChecked: false,
        createdAt: Date.now(),
      };
      await db.pageImages.put(record);
      return record;
    } catch {
      return null;
    }
  })().finally(() => pagePromises.delete(id));

  pagePromises.set(id, promise);
  return promise;
}

export async function loadPageImages(
  bookId: string,
  pageNumbers: number[],
): Promise<PageImage[]> {
  const ids = pageNumbers.map((pageNo) => `${bookId}:${pageNo}`);
  const cached = await db.pageImages.bulkGet(ids);
  const book = await db.books.get(bookId);
  if (book?.format === "pptx") {
    return cached.filter((image): image is PageImage => image !== undefined);
  }
  const missing = pageNumbers.filter((_, index) => !cached[index]);

  if (missing.length) {
    const file = await db.files.get(bookId);
    if (file) {
      const rendered = await withPdf(file.blob, async (document) => {
        const records: PageImage[] = [];
        for (const pageNo of missing) {
          try {
            const dataUrl = await renderPageImage(document, pageNo, {
              maxWidth: 1100,
              maxHeight: 1500,
              quality: 0.8,
            });
            records.push({
              id: `${bookId}:${pageNo}`,
              bookId,
              pageNo,
              dataUrl,
              figuresChecked: false,
              createdAt: Date.now(),
            });
          } catch {
            // One unreadable page should not hide the others.
          }
        }
        return records;
      });
      if (rendered.length) await db.pageImages.bulkPut(rendered);
    }
  }

  const images = await db.pageImages.bulkGet(ids);
  return images.filter((image): image is PageImage => image !== undefined);
}

export async function figuresForPages(
  bookId: string,
  pageNumbers: number[],
): Promise<Figure[]> {
  const pages = await Promise.all(
    pageNumbers.map((pageNo) =>
      db.figures
        .where("[bookId+pageNo]")
        .equals([bookId, pageNo])
        .toArray(),
    ),
  );
  return pages
    .flat()
    .sort((a, b) => a.pageNo - b.pageNo || a.box[0] - b.box[0]);
}

export async function ensureFigures(
  bookId: string,
  pageNo: number,
  settings: Settings,
): Promise<Figure[]> {
  if (!isConfigured(settings)) return [];
  const id = `${bookId}:${pageNo}`;
  const page = await db.pageImages.get(id);
  if (!page) return [];
  if (page.figuresChecked) {
    return figuresForPages(bookId, [pageNo]);
  }

  const existing = await figuresForPages(bookId, [pageNo]);
  if (existing.length) return existing;

  const inflight = figurePromises.get(id);
  if (inflight) return inflight;

  const promise = (async (): Promise<Figure[]> => {
    const candidates = await findFigures({
      settings,
      imageDataUrl: page.dataUrl,
      pageNo,
    });
    const figures: Figure[] = [];
    for (const candidate of candidates) {
      const cropped = await cropDataUrl(page.dataUrl, candidate.box);
      if (!cropped) continue;
      figures.push({
        id: uid(),
        bookId,
        pageNo,
        box: candidate.box,
        caption: candidate.caption,
        kind: candidate.kind,
        dataUrl: cropped,
        createdAt: Date.now(),
      });
    }
    await db.transaction("rw", [db.figures, db.pageImages], async () => {
      await db.figures
        .where("[bookId+pageNo]")
        .equals([bookId, pageNo])
        .delete();
      if (figures.length) await db.figures.bulkPut(figures);
      await db.pageImages.update(id, { figuresChecked: true });
    });
    return figures;
  })().finally(() => figurePromises.delete(id));

  figurePromises.set(id, promise);
  return promise;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't read that page image."));
    image.src = source;
  });
}

export function figureKindLabel(kind: "page" | Figure["kind"]): string {
  if (kind === "page") return "Page";
  if (kind === "table") return "Table";
  if (kind === "diagram") return "Diagram";
  if (kind === "photo") return "Photo";
  if (kind === "chart") return "Chart";
  return "Figure";
}

async function cropDataUrl(
  source: string,
  box: [number, number, number, number],
): Promise<string | null> {
  try {
    const image = await loadImage(source);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return null;

    const pad = 0.012;
    const x1 = clamp(((box[1] / 1000) - pad) * width, 0, width - 1);
    const y1 = clamp(((box[0] / 1000) - pad) * height, 0, height - 1);
    const x2 = clamp(((box[3] / 1000) + pad) * width, x1 + 1, width);
    const y2 = clamp(((box[2] / 1000) + pad) * height, y1 + 1, height);
    const sourceWidth = x2 - x1;
    const sourceHeight = y2 - y1;
    if (sourceWidth < 36 || sourceHeight < 36) return null;

    const scale = Math.min(1, 1100 / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      x1,
      y1,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  }
}
