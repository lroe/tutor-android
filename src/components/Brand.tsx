import { cx } from "../lib/util";

export function ToothMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M32 19.7c-2.7-2.2-6.3-3.7-9.6-2.6-5.1 1.6-6.9 6.9-6 11.7.7 3.5 2.5 6.1 3.3 9.3.9 3.3.7 6.8 1.6 10.1.4 2 1.5 3.9 3.5 3.9 2.2 0 2.9-2.6 3.3-5.2.4-3.3.9-7 3.9-7s3.5 3.7 3.9 7c.4 2.6 1.1 5.2 3.3 5.2 2 0 3.1-1.9 3.5-3.9.9-3.3.7-6.8 1.6-10.1.8-3.2 2.6-5.8 3.3-9.3.9-4.8-.9-10.1-6-11.7-3.3-1.1-6.9.4-9.6 2.6Z" />
    </svg>
  );
}

export function Wordmark({
  size = 19,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cx("wordmark", className)} aria-label="Cove">
      <ToothMark size={size} />
      <span className="wordmark-text">Cove</span>
    </span>
  );
}

export function TypingDots() {
  return (
    <span className="typing-dots" aria-label="Cove is thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
