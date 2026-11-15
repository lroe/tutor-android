import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type {
  Chapter,
  ExtractHooks,
  ExtractResult,
  PageText,
} from "./types";
import { cleanTitle, sleep, uid } from "./util";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL: boolean;
  fontName: string;
}

interface HeadingCandidate {
  page: number;
  title: string;
  weight: number;
}

interface RawOutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items?: RawOutlineItem[];
}

interface FlatOutlineItem {
  title: string;
  page: number;
  depth: number;
}

export async function withPdf<T>(
  blob: Blob,
  run: (document: PDFDocumentProxy) => Promise<T>,
): Promise<T> {
  const url = URL.createObjectURL(blob);
  const task = pdfjs.getDocument({
    url,
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    try {
      return await run(document);
    } finally {
      await document.destroy();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === "object" && item !== null && "str" in item;
}

function joinWrappedLines(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const output: string[] = [];

  for (const line of lines) {
    const previous = output[output.length - 1];
    if (!previous) {
      output.push(line);
      continue;
    }
    const itemPattern = /^(?:[•●▪◦‣·]|[-–—]\s|\d{1,3}[.)]\s)/;
    const startsItem = itemPattern.test(line);
    const previousItem = itemPattern.test(previous);
    const startsLowercase = /^[a-z(]/.test(line);
    const previousEndsOpen = /[,;:–—-]$/.test(previous);
    const previousIsLong = previous.length >= 55;
    const lineStartsSentence = /^[A-Z0-9"'“‘]/.test(line);
    const shouldJoin =
      !startsItem &&
      !previousItem &&
      (startsLowercase ||
        previousEndsOpen ||
        (previousIsLong &&
          !/[.!?]$/.test(previous) &&
          lineStartsSentence));

    if (shouldJoin) {
      output[output.length - 1] = `${previous} ${line}`;
    } else {
      output.push(line);
    }
  }
  return output.join("\n");
}

function normalisePageText(items: unknown[]): string {
  let text = "";
  for (const item of items) {
    if (!isTextItem(item)) continue;
    const value = item.str;
    if (!value) {
      if (item.hasEOL) text += "\n";
      continue;
    }
    text += value;
    if (item.hasEOL) text += "\n";
    else if (!/[ \t]$/.test(value)) text += " ";
  }
  const cleaned = text
    .replace(/\u00ad/g, "")
    .replace(/([a-zA-Z])-\s*\n\s*([a-z])/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n\s*\d{1,4}\s*\n/g, "\n");
  return joinWrappedLines(cleaned).replace(/\n{3,}/g, "\n\n").trim();
}

function collectHeading(
  items: unknown[],
  pageNumber: number,
  pageHeight: number,
): HeadingCandidate | null {
  if (!items.length || pageHeight <= 0) return null;
  const textItems = items.filter(isTextItem).filter((item) => item.str.trim());
  if (!textItems.length) return null;

  const bodyHeights = textItems
    .filter((item) => item.str.trim().length > 8)
    .map((item) => item.height)
    .sort((a, b) => a - b);
  const median =
    bodyHeights.length > 0
      ? bodyHeights[Math.floor(bodyHeights.length / 2)]
      : 0;
  if (median <= 0) return null;

  const lines: Array<{
    text: string;
    height: number;
    y: number;
    x: number;
  }> = [];

  for (const item of textItems) {
    const height = item.height;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const existing = lines.find(
      (line) => Math.abs(line.y - y) < Math.max(1.5, height * 0.32),
    );
    if (existing) {
      existing.text += `${existing.text.endsWith(" ") ? "" : " "}${item.str.trim()}`;
      existing.height = Math.max(existing.height, height);
      existing.x = Math.min(existing.x, x);
    } else {
      lines.push({ text: item.str.trim(), height, y, x });
    }
  }
  lines.sort((a, b) => b.y - a.y || a.x - b.x);

  const candidates = lines.filter((line) => {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (text.length < 3 || text.length > 96) return false;
    if (line.height < median * 1.2) return false;
    if (line.y < pageHeight * 0.06 || line.y > pageHeight * 0.93) return false;
    if (!/[A-Za-z]{2}/.test(text)) return false;
    if (/[.;:,]$/.test(text)) return false;
    if (/^(figure|table|box|plate|exhibit|source|continued|see)\b/i.test(text))
      return false;
    if (/^\d+([.\s-]|$)/.test(text) && text.length < 8) return false;
    const words = text.split(/\s+/).length;
    if (words > 14) return false;
    if (text === text.toUpperCase() && text.length < 4) return false;
    return true;
  });

  if (!candidates.length) return null;
  const best = candidates[0];
  return {
    page: pageNumber,
    title: best.text.replace(/\s+/g, " ").trim(),
    weight: best.height,
  };
}

function cleanOutlineTitle(raw: string): string {
  const title = raw.replace(/\s+/g, " ").trim();
  const cleaned = title
    .replace(
      /^(?:chapter|part|unit|section)\s+[0-9ivxlc]+(?:\s*[:.\-–—]\s*|\s+)/i,
      "",
    )
    .replace(/^\d{1,3}(?:\.\d+){0,2}\s*[.):\-–—]\s*/, "")
    .trim();
  return cleaned || title;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function chooseOutlineLevel(
  items: FlatOutlineItem[],
  pageCount: number,
): FlatOutlineItem[] {
  if (!items.length) return [];
  const byDepth = new Map<number, FlatOutlineItem[]>();
  for (const item of items) {
    const bucket = byDepth.get(item.depth) ?? [];
    bucket.push(item);
    byDepth.set(item.depth, bucket);
  }
  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  for (const depth of depths) {
    const bucket = (byDepth.get(depth) ?? []).sort(
      (a, b) => a.page - b.page,
    );
    if (bucket.length < 3 || bucket.length > 100) continue;
    const spans: number[] = [];
    for (let index = 0; index < bucket.length - 1; index += 1) {
      const span = bucket[index + 1].page - bucket[index].page;
      if (span > 0) spans.push(span);
    }
    const tail = pageCount - bucket[bucket.length - 1].page;
    if (tail > 0) spans.push(tail);
    const typical = median(spans);
    if (typical >= 2 && typical <= 80) {
      return bucket;
    }
  }

  const candidates = depths
    .map((depth) => byDepth.get(depth) ?? [])
    .filter((bucket) => bucket.length >= 2 && bucket.length <= 120);
  candidates.sort(
    (a, b) => Math.abs(a.length - 20) - Math.abs(b.length - 20),
  );
  return candidates[0] ?? items;
}

function chaptersFromOutline(
  items: FlatOutlineItem[],
  pageCount: number,
): Chapter[] {
  const skip =
    /^(cover|title page|half title|contents|table of contents|copyright|dedication|index|colophon|erratum)\b/i;
  const cleaned = chooseOutlineLevel(items, pageCount)
    .filter(
      (item) =>
        item.page >= 1 &&
        item.page <= pageCount &&
        item.title.length >= 2 &&
        item.title.length <= 140 &&
        !skip.test(item.title.trim()),
    )
    .sort((a, b) => a.page - b.page || a.title.localeCompare(b.title))
    .filter((item) => item.page <= pageCount);

  const deduped: FlatOutlineItem[] = [];
  for (const item of cleaned) {
    const last = deduped[deduped.length - 1];
    if (last && last.page === item.page) continue;
    deduped.push(item);
  }
  if (deduped.length < 2) return [];

  return deduped.map((item, index) => {
    const next = deduped[index + 1];
    return {
      id: uid(),
      title: cleanOutlineTitle(item.title),
      startPage: item.page,
      endPage: next ? Math.max(item.page, next.page - 1) : pageCount,
    };
  });
}

function chaptersFromHeadings(
  headings: HeadingCandidate[],
  pageCount: number,
): Chapter[] {
  if (headings.length < 4) return [];
  const counts = new Map<string, number>();
  for (const heading of headings) {
    counts.set(heading.title, (counts.get(heading.title) ?? 0) + 1);
  }
  const maxRepeat = Math.max(3, Math.floor(pageCount * 0.02));
  const filtered = headings
    .filter((heading) => (counts.get(heading.title) ?? 0) <= maxRepeat)
    .sort((a, b) => a.page - b.page);

  const deduped: HeadingCandidate[] = [];
  for (const heading of filtered) {
    const previous = deduped[deduped.length - 1];
    if (previous && heading.page - previous.page < 2) continue;
    deduped.push(heading);
  }
  if (deduped.length < 4 || deduped.length > 80) return [];

  return deduped.map((heading, index) => {
    const next = deduped[index + 1];
    return {
      id: uid(),
      title: cleanOutlineTitle(heading.title),
      startPage: heading.page,
      endPage: next ? Math.max(heading.page, next.page - 1) : pageCount,
    };
  });
}

function chaptersFromRanges(pageCount: number): Chapter[] {
  if (pageCount <= 30) {
    return [
      {
        id: uid(),
        title: "The whole book",
        startPage: 1,
        endPage: pageCount,
      },
    ];
  }
  const span = pageCount > 500 ? 25 : pageCount > 150 ? 20 : 15;
  const chapters: Chapter[] = [];
  for (let start = 1; start <= pageCount; start += span) {
    const end = Math.min(pageCount, start + span - 1);
    chapters.push({
      id: uid(),
      title: `Pages ${start}–${end}`,
      startPage: start,
      endPage: end,
    });
  }
  return chapters;
}

async function flattenOutline(
  document: PDFDocumentProxy,
): Promise<FlatOutlineItem[]> {
  const outline = (await document.getOutline()) as RawOutlineItem[] | null;
  if (!outline?.length) return [];
  const result: FlatOutlineItem[] = [];

  const visit = async (items: RawOutlineItem[], depth: number) => {
    for (const item of items) {
      let page = 0;
      try {
        let dest = item.dest;
        if (typeof dest === "string") {
          dest = await document.getDestination(dest);
        }
        if (Array.isArray(dest) && dest.length > 0) {
          const reference = dest[0] as Parameters<
            PDFDocumentProxy["getPageIndex"]
          >[0];
          page = (await document.getPageIndex(reference)) + 1;
        }
      } catch {
        page = 0;
      }
      if (page > 0) {
        result.push({ title: item.title.trim(), page, depth });
      }
      if (item.items?.length) {
        await visit(item.items, depth + 1);
      }
    }
  };

  await visit(outline, 0);
  return result;
}

function metadataTitle(
  info: Record<string, unknown> | undefined,
  fileName: string,
): { title: string; fromMetadata: boolean } {
  const candidate =
    typeof info?.Title === "string" ? info.Title.trim() : undefined;
  if (
    candidate &&
    candidate.length >= 3 &&
    candidate.length <= 140 &&
    !/^untitled$/i.test(candidate) &&
    !/microsoft word|powerpoint|adobe|indesign|quark/i.test(candidate)
  ) {
    return { title: cleanTitle(candidate), fromMetadata: true };
  }
  return { title: cleanTitle(fileName), fromMetadata: false };
}

function metadataAuthor(
  info: Record<string, unknown> | undefined,
): string | undefined {
  const author = typeof info?.Author === "string" ? info.Author.trim() : "";
  if (!author || author.length > 90) return undefined;
  if (/^(admin|administrator|user|owner|unknown)$/i.test(author)) return undefined;
  return author;
}

async function renderCover(
  document: PDFDocumentProxy,
): Promise<string | undefined> {
  try {
    const page = await document.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const width = 320;
    const scale = width / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return undefined;
  }
}

export async function extractPdf(
  bookId: string,
  file: File,
  hooks: ExtractHooks = {},
): Promise<ExtractResult> {
  const { signal, onProgress } = hooks;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (file.size > 300 * 1024 * 1024) {
    throw new Error("This file is over 300 MB. Try a smaller PDF.");
  }

  return withPdf(file, async (document) => {
    const pageCount = document.numPages;
    if (!pageCount) throw new Error("This PDF has no pages.");

    let info: Record<string, unknown> | undefined;
    try {
      const meta = await document.getMetadata();
      info = meta.info as Record<string, unknown>;
    } catch {
      info = undefined;
    }

    const outline = await flattenOutline(document).catch(() => []);
    const cover = await renderCover(document);
    const pages: PageText[] = [];
    const scanned: number[] = [];
    const headings: HeadingCandidate[] = [];
    onProgress?.(0, pageCount);

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      let text = "";
      let heading: HeadingCandidate | null = null;
      try {
        const content = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });
        text = normalisePageText(content.items);
        heading = collectHeading(content.items, pageNumber, viewport.height);
      } finally {
        page.cleanup();
      }
      if (text.replace(/\s+/g, "").length < 40) scanned.push(pageNumber);
      if (heading) headings.push(heading);
      pages.push({
        id: `${bookId}:${pageNumber}`,
        bookId,
        pageNo: pageNumber,
        text,
        source: "pdf",
      });
      onProgress?.(pageNumber, pageCount);
      if (pageNumber % 6 === 0) {
        await sleep(0, signal);
      }
    }

    let chapters = chaptersFromOutline(outline, pageCount);
    let chapterSource: ExtractResult["chapterSource"] = "outline";
    if (chapters.length < 2) {
      chapters = chaptersFromHeadings(headings, pageCount);
      chapterSource = "headings";
    }
    if (chapters.length < 2) {
      chapters = chaptersFromRanges(pageCount);
      chapterSource = "ranges";
    }

    const metaTitle = metadataTitle(info, file.name);
    const firstHeading = headings
      .filter((heading) => heading.page === 1)
      .map((heading) => heading.title)
      .find(
        (title) =>
          title.length >= 4 &&
          !/^(chapter|part|unit|section|lecture|slide)\b/i.test(title),
      );
    const title =
      !metaTitle.fromMetadata && firstHeading
        ? cleanTitle(firstHeading)
        : metaTitle.title;

    return {
      title,
      author: metadataAuthor(info),
      pageCount,
      chapters,
      chapterSource,
      scannedPages: scanned,
      cover,
      pages,
      format: "pdf",
    };
  });
}

export interface RenderOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function renderPageImage(
  document: PDFDocumentProxy,
  pageNumber: number,
  options: RenderOptions = {},
): Promise<string> {
  const { maxWidth = 1700, maxHeight = 2400, quality = 0.82 } = options;
  const page = await document.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / base.width, maxHeight / base.height);
    const viewport = page.getViewport({ scale: Math.max(0.2, scale) });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the page image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    page.cleanup();
  }
}

export async function testPdf(file: File): Promise<number> {
  return withPdf(file, async (document) => document.numPages);
}
