import { useEffect, useMemo, useState } from "react";
import {
  ensureFigures,
  figuresForPages,
  loadPageImages,
  visualPages,
} from "../lib/visuals";
import { isConfigured } from "../lib/provider";
import type { Figure, Settings } from "../lib/types";

export function InlineFigure({
  bookId,
  pageNumbers,
  pageFilter,
  settings,
  onOpen,
}: {
  bookId: string;
  pageNumbers: number[];
  pageFilter?: number;
  settings: Settings;
  onOpen: (src: string) => void;
}) {
  const pages = useMemo(
    () => visualPages(pageNumbers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumbers.join(",")],
  );
  const pageKey = pages.join(",");
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFigures([]);
    setLoading(true);

    (async () => {
      const loaded = await loadPageImages(bookId, pages);
      if (cancelled) return;

      const cached = await figuresForPages(bookId, pages);
      if (cancelled) return;
      setFigures(cached);
      setLoading(false);

      if (!loaded.length || !isConfigured(settings)) return;
      const found = [...cached];
      for (const image of loaded) {
        if (cancelled) break;
        try {
          const pageFigures = await ensureFigures(bookId, image.pageNo, settings);
          for (const figure of pageFigures) {
            if (!found.some((item) => item.id === figure.id)) {
              found.push(figure);
            }
          }
          if (!cancelled) {
            setFigures(
              [...found].sort(
                (a, b) => a.pageNo - b.pageNo || a.box[0] - b.box[0],
              ),
            );
          }
        } catch {
          // No crop for this page. Never substitute the full page: a text-only
          // page is not a diagram.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, pageKey, settings]);

  if (loading) return null;

  const figure = pageFilter
    ? figures.find((item) => item.pageNo === pageFilter)
    : figures[0];
  if (!figure) return null;

  return (
    <button
      type="button"
      className="inline-figure"
      onClick={() => onOpen(figure.dataUrl)}
      aria-label={`Open the diagram from page ${figure.pageNo}`}
    >
      <img src={figure.dataUrl} alt="" loading="lazy" />
    </button>
  );
}
