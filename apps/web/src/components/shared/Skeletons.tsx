import { Skeleton } from "@/components/ui/skeleton";

export function LeadCardSkeleton() {
  return (
    <div className="rounded-lg border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function LeadListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2" aria-busy="true" aria-label="Carregando leads">
      {Array.from({ length: count }).map((_, i) => (
        <LeadCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="h-full p-3 md:p-4" aria-busy="true" aria-label="Carregando pipeline">
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 flex-1 max-w-xs" />
      </div>
      <div className="flex h-[calc(100%-2.75rem)] gap-3 overflow-hidden">
        {[0, 1, 2].map((column) => (
          <div
            key={column}
            className="w-[calc(100vw-1.5rem)] shrink-0 rounded-lg border bg-surface p-2 md:w-72"
          >
            <Skeleton className="mb-3 h-8 w-full" />
            <div className="space-y-2">
              {[0, 1, 2].map((card) => (
                <LeadCardSkeleton key={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="border-b bg-muted/30 p-3 space-y-2" aria-busy="true">
      <Skeleton className="h-3.5 w-52" />
      <Skeleton className="h-3 w-40" />
      <div className="grid grid-cols-3 gap-1.5">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </div>
  );
}
