import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ImageViewer({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const target = document.getElementById("app-portal") ?? document.body;

  return createPortal(
    <div className="image-viewer" onClick={onClose}>
      <button
        type="button"
        className="image-close"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt="A page or figure from the note"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    target,
  );
}
