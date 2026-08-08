import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * BrowserFrame — wraps content in a subtle browser chrome
 * (● ● ● dots + URL bar) to make mockups feel like real product screens.
 */
export function BrowserFrame({
  children,
  className,
  url = "app.prospeca.com.br",
}: {
  children: ReactNode;
  className?: string;
  url?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-surface shadow-card",
        className,
      )}
    >
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-surface-2 px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-stage-discarded/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-qualified/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-new/40" />
        <div className="ml-2 flex-1 rounded-md bg-surface px-3 py-1 text-[10px] text-muted-foreground">
          {url}
        </div>
      </div>
      {/* Content */}
      <div className="p-4">{children}</div>
    </div>
  );
}
