/**
 * AnimatedSection — wraps content with a fade-in + slide-up on scroll reveal.
 * Respects prefers-reduced-motion (disables animation when set).
 */
import type { ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

export function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal(0.1, "0px 0px -60px 0px");

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-enter",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * AnimatedCard — individual card with stagger delay for grid layouts.
 */
export function AnimatedCard({
  children,
  className,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const { ref, visible } = useScrollReveal(0.05, "0px 0px -30px 0px");

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-500 ease-enter",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className,
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {children}
    </div>
  );
}
