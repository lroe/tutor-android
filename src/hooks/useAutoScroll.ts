import { useCallback, useEffect, useRef, type RefCallback } from "react";

export function useAutoScroll<T extends HTMLElement>(trigger: unknown) {
  const elementRef = useRef<T | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const stickRef = useRef(true);

  const scrollIfSticking = useCallback(() => {
    const element = elementRef.current;
    if (element && stickRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, []);

  const containerRef = useCallback<RefCallback<T>>(
    (node) => {
      elementRef.current = node;
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;

      const observer = new ResizeObserver(scrollIfSticking);
      observer.observe(node);
      const child = node.firstElementChild;
      if (child) observer.observe(child);
      observerRef.current = observer;

      if (stickRef.current) {
        node.scrollTop = node.scrollHeight;
      }
    },
    [scrollIfSticking],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    if (stickRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [trigger]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  const onScroll = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickRef.current = distance < 160;
  }, []);

  const jumpToEnd = useCallback(() => {
    stickRef.current = true;
    const element = elementRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  const scrollToMessage = useCallback((id: number, offset = 8) => {
    const element = elementRef.current;
    if (!element) return;
    const target = element.querySelector<HTMLElement>(
      `[data-message-id="${id}"]`,
    );
    if (!target) return;
    stickRef.current = false;
    const top =
      target.getBoundingClientRect().top -
      element.getBoundingClientRect().top +
      element.scrollTop;
    element.scrollTop = Math.max(0, top - offset);
  }, []);

  return { containerRef, onScroll, jumpToEnd, scrollToMessage };
}
