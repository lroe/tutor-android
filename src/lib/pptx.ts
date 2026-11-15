import JSZip from "jszip";
import type {
  ExtractHooks,
  ExtractResult,
  Figure,
  PageImage,
  PageText,
} from "./types";
import { cleanTitle, sleep, uid } from "./util";

export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const MAX_BYTES = 300 * 1024 * 1024;
const PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ffffff"/></svg>',
  );

const GENERIC_TITLES =
  /^(slide\s*\d+|untitled|powerpoint presentation|presentation|agenda|outline|contents|table of contents|objectives|learning objectives|introduction|welcome)$/i;

interface SlideImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

function parseXml(text: string): Document | null {
  try {
    return new DOMParser().parseFromString(text, "application/xml");
  } catch {
    return null;
  }
}

function mimeFor(extension: string): string | null {
  const ext = extension.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "bmp") return "image/bmp";
  return null;
}

function resolvePart(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${baseDir}/${target}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read an image."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't read an image."));
    image.src = source;
  });
}

async function fitImage(
  dataUrl: string,
  mime: string,
  max = 1400,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || 1200;
    const height = image.naturalHeight || 800;
    if (mime === "image/svg+xml" || (width <= max && height <= max)) {
      return { dataUrl, width, height };
    }
    const scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const type = mime === "image/png" ? "image/png" : "image/jpeg";
    return {
      dataUrl: canvas.toDataURL(type, 0.86),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async("text") : null;
}

function relationshipMap(xml: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  const document = parseXml(xml);
  if (!document) return map;
  for (const node of Array.from(document.getElementsByTagName("Relationship"))) {
    const id = node.getAttribute("Id");
    const target = node.getAttribute("Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

function slideNumber(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
}

async function slideOrder(zip: JSZip): Promise<string[]> {
  const presentation = await readText(zip, "ppt/presentation.xml");
  const relationships = await readText(
    zip,
    "ppt/_rels/presentation.xml.rels",
  );
  if (presentation && relationships) {
    const rels = relationshipMap(relationships);
    const document = parseXml(presentation);
    if (document) {
      const paths = Array.from(document.getElementsByTagName("p:sldId"))
        .map((node) => node.getAttribute("r:id"))
        .map((id) => (id ? rels.get(id) : undefined))
        .filter((target): target is string => Boolean(target))
        .map((target) => resolvePart("ppt", target))
        .filter((path) => Boolean(zip.file(path)));
      if (paths.length) return paths;
    }
  }

  return Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
}

function slideText(document: Document): string {
  const paragraphs = Array.from(document.getElementsByTagName("a:p"));
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    let line = "";
    for (const node of Array.from(paragraph.getElementsByTagName("*"))) {
      if (node.tagName === "a:t") line += node.textContent ?? "";
      else if (node.tagName === "a:br") line += "\n";
    }
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function slideImages(
  zip: JSZip,
  slidePath: string,
  slideXml: string,
): Promise<SlideImage[]> {
  const relPath = slidePath.replace(
    /\/slides\/(slide\d+\.xml)$/i,
    "/slides/_rels/$1.rels",
  );
  const relationships = relationshipMap(await readText(zip, relPath));
  const document = parseXml(slideXml);
  if (!document) return [];

  const targets = new Set<string>();
  for (const blip of Array.from(document.getElementsByTagName("a:blip"))) {
    const id = blip.getAttribute("r:embed");
    const target = id ? relationships.get(id) : undefined;
    if (target) targets.add(resolvePart("ppt/slides", target));
  }

  const images: SlideImage[] = [];
  for (const path of targets) {
    const file = zip.file(path);
    if (!file) continue;
    const extension = path.split(".").pop() ?? "";
    const mime = mimeFor(extension);
    if (!mime) continue;
    const blob = await file.async("blob");
    if (!blob.size) continue;
    const dataUrl = await blobToDataUrl(new Blob([blob], { type: mime }));
    const fitted = await fitImage(dataUrl, mime);
    if (!fitted) continue;
    images.push({ ...fitted, bytes: blob.size });
  }
  return images;
}

async function coreProperties(zip: JSZip): Promise<{
  title: string;
  author?: string;
}> {
  const xml = await readText(zip, "docProps/core.xml");
  if (!xml) return { title: "" };
  const document = parseXml(xml);
  if (!document) return { title: "" };
  const title =
    document.getElementsByTagName("dc:title")[0]?.textContent?.trim() ?? "";
  const author =
    document.getElementsByTagName("dc:creator")[0]?.textContent?.trim() ?? "";
  return {
    title,
    author:
      author &&
      !/^(admin|administrator|user|owner|unknown)$/i.test(author)
        ? author.slice(0, 90)
        : undefined,
  };
}

function chooseTitle(
  coreTitle: string,
  firstSlideTitle: string,
  fileName: string,
): string {
  for (const candidate of [coreTitle, firstSlideTitle]) {
    const clean = candidate.replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 3 || clean.length > 140) continue;
    if (GENERIC_TITLES.test(clean)) continue;
    if (/^(chapter|part|unit|section|lecture)\s+\d+/i.test(clean)) continue;
    return cleanTitle(clean);
  }
  return cleanTitle(fileName);
}

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

export async function extractPptx(
  bookId: string,
  file: File,
  hooks: ExtractHooks = {},
): Promise<ExtractResult> {
  const { signal, onProgress } = hooks;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (file.size > MAX_BYTES) {
    throw new Error("This file is over 300 MB. Try a smaller PowerPoint.");
  }

  const zip = await JSZip.loadAsync(file, { checkCRC32: false });
  const slides = await slideOrder(zip);
  if (!slides.length) throw new Error("This PowerPoint has no slides.");

  const pages: PageText[] = [];
  const pageImages: PageImage[] = [];
  const figures: Figure[] = [];
  const scannedPages: number[] = [];
  let firstSlideTitle = "";
  let cover: string | undefined;
  const now = Date.now();
  onProgress?.(0, slides.length);

  for (let index = 0; index < slides.length; index += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const slidePath = slides[index];
    const xml = await readText(zip, slidePath);
    if (!xml) continue;
    const document = parseXml(xml);
    const text = document ? slideText(document) : "";
    const pageNo = index + 1;
    const images = await slideImages(zip, slidePath, xml);
    images.sort(
      (a, b) => b.width * b.height - a.width * a.height || b.bytes - a.bytes,
    );
    const image = images[0];

    if (index === 0) {
      firstSlideTitle = firstLine(text);
      cover = image?.dataUrl;
    }

    if (text.replace(/\s+/g, "").length < 40 && image) {
      scannedPages.push(pageNo);
    }

    pages.push({
      id: `${bookId}:${pageNo}`,
      bookId,
      pageNo,
      text,
      source: "pptx",
    });
    pageImages.push({
      id: `${bookId}:${pageNo}`,
      bookId,
      pageNo,
      dataUrl: image?.dataUrl ?? PLACEHOLDER,
      figuresChecked: true,
      createdAt: now + pageNo,
    });
    if (image) {
      figures.push({
        id: uid(),
        bookId,
        pageNo,
        box: [0, 0, 1000, 1000],
        caption: firstLine(text) || `Slide ${pageNo}`,
        kind: "figure",
        dataUrl: image.dataUrl,
        createdAt: now + pageNo,
      });
    }

    onProgress?.(pageNo, slides.length);
    if (pageNo % 5 === 0) await sleep(0, signal);
  }

  if (!pages.length) throw new Error("This PowerPoint has no readable slides.");
  const core = await coreProperties(zip);

  return {
    title: chooseTitle(core.title, firstSlideTitle, file.name),
    author: core.author,
    pageCount: slides.length,
    chapters: [],
    chapterSource: "ranges",
    scannedPages,
    cover,
    pages,
    format: "pptx",
    pageImages,
    figures,
  };
}
