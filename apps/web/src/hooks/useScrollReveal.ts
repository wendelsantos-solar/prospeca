/**
 * useScrollReveal — Intersection Observer hook for scroll-triggered animations.
 * Respects prefers-reduced-motion: disables all animations when set.
 */
import { useEffect, useRef, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return prefers;
}

/**
 * Reveals an element when it enters the viewport.
 * Returns a ref to attach + whether the element is visible.
 *
 * @param threshold — 0 to 1, how much of the element must be visible (default 0.15)
 * @param rootMargin — margin around the root (default "0px 0px -40px 0px")
 */
export function useScrollReveal(threshold = 0.15, rootMargin = "0px 0px -40px 0px") {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, reducedMotion]);

  return { ref, visible };
}
