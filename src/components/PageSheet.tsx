import { useState } from "react";
import { Sheet } from "./Sheet";
import type { Book } from "../lib/types";
import { clamp } from "../lib/util";

export function PageSheet({
  book,
  onClose,
  onBuild,
}: {
  book: Book;
  onClose: () => void;
  onBuild: (startPage: number, endPage: number) => void;
}) {
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(Math.min(book.pageCount, 10));

  const safeStart = clamp(Math.round(start) || 1, 1, book.pageCount);
  const safeEnd = clamp(Math.round(end) || 1, 1, book.pageCount);
  const valid = safeEnd >= safeStart;
  const unit = book.format === "pptx" ? "slide" : "page";

  return (
    <Sheet
      open
      onClose={onClose}
      title={book.format === "pptx" ? "Slides" : "Pages"}
      subtitle={`${book.title} · ${book.pageCount} ${
        book.pageCount === 1 ? unit : `${unit}s`
      }`}
      footer={
        <button
          type="button"
          className="primary-button"
          disabled={!valid}
          onClick={() => onBuild(safeStart, safeEnd)}
        >
          Build lesson
        </button>
      }
    >
      <div className="page-fields">
        <label className="page-field">
          <span>From</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={book.pageCount}
            value={start}
            onChange={(event) => setStart(Number(event.target.value))}
            onBlur={() => setStart(safeStart)}
          />
        </label>
        <label className="page-field">
          <span>To</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={book.pageCount}
            value={end}
            onChange={(event) => setEnd(Number(event.target.value))}
            onBlur={() => setEnd(safeEnd)}
          />
        </label>
      </div>
      {!valid && (
        <p className="form-error">{`The last ${unit} needs to come after the first.`}</p>
      )}
    </Sheet>
  );
}
