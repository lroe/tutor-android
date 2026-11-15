import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Spinner } from "./Brand";
import { addBook } from "../lib/library";
import { describeAIError } from "../lib/gemini";
import type { Book } from "../lib/types";
import { isAbort } from "../lib/util";

export function UploadOverlay({
  file,
  onClose,
  onDone,
}: {
  file: File;
  onClose: () => void;
  onDone: (book: Book) => void;
}) {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const unit = file.name.toLowerCase().endsWith(".pptx") ? "slides" : "pages";
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    addBook(file, {
      signal: controller.signal,
      onProgress: (count, pages) => {
        if (!mountedRef.current) return;
        setDone(count);
        setTotal(pages);
      },
    })
      .then((book) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        onDone(book);
      })
      .catch((caught) => {
        if (!mountedRef.current || isAbort(caught) || controller.signal.aborted) {
          return;
        }
        setError(describeAIError(caught));
      });

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [file, onDone]);

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  const target = document.getElementById("app-portal") ?? document.body;

  return createPortal(
    <div className="upload-overlay">
      {!error && (
        <button
          type="button"
          className="overlay-close"
          onClick={close}
          aria-label="Cancel"
        >
          <X size={20} />
        </button>
      )}
      <div className="upload-center">
        {error ? (
          <>
            <p className="upload-title">Couldn’t read that note.</p>
            <p className="upload-sub">{error}</p>
            <button type="button" className="text-button" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <Spinner size={24} />
            <p className="upload-title">Reading note…</p>
            {total > 0 && (
              <p className="upload-sub">
                {done} / {total} {unit}
              </p>
            )}
          </>
        )}
      </div>
    </div>,
    target,
  );
}
