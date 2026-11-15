import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "../lib/util";
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const portalTarget =
    document.getElementById("app-portal") ?? document.body;

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div
        className={cx("sheet", wide && "sheet-wide")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <div>
            <h2 id="sheet-title" className="sheet-title">
              {title}
            </h2>
            {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-button sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    portalTarget,
  );
}
