import { Check } from "lucide-react";
import { Sheet } from "./Sheet";
import { DEFAULT_MODE, MODES } from "../lib/modes";
import type { LessonMode } from "../lib/types";

export function ModeSheet({
  mode,
  onSelect,
  onClose,
}: {
  mode: LessonMode;
  onSelect: (mode: LessonMode) => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      title="Learning mode"
      subtitle="Applies to the next explanation and feedback. For this lesson only."
    >
      <div className="mode-list">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              item.id === mode ? "mode-option is-active" : "mode-option"
            }
            onClick={() => onSelect(item.id)}
          >
            <span className="mode-option-copy">
              <span className="mode-option-label">
                {item.label}
                {item.id === DEFAULT_MODE && (
                  <span className="mode-default">Default</span>
                )}
              </span>
              <span className="mode-option-desc">{item.description}</span>
            </span>
            {item.id === mode && <Check size={16} />}
          </button>
        ))}
      </div>
      <p className="field-hint mode-hint">
        You can also type a style in chat, like “ELI5” or “teach like a
        textbook.” It sticks for this lesson, even after you change the mode.
      </p>
    </Sheet>
  );
}
