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
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Carregando pipeline">
      {/* Top bar skeleton — matches KanbanTopBar */}
      <div className="flex items-center gap-2 border-b bg-surface px-4 py-2.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40 rounded-md" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      {/* 5 columns centered — matches KanbanBoard layout */}
      <div className="flex-1 snap-x snap-mandatory overflow-x-auto p-2 md:snap-none md:p-4">
        <div className="mx-auto flex h-full w-fit gap-2 md:gap-3">
          {[0, 1, 2, 3, 4].map((column) => (
            <div
              key={column}
              className="flex w-[calc(100vw-1.5rem)] shrink-0 snap-start flex-col md:w-72"
            >
              {/* Column header */}
              <div className="rounded-t-lg border border-b-0 bg-surface px-3 py-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1 h-3 w-12" />
              </div>
              {/* Column body */}
              <div className="flex-1 space-y-2 rounded-b-lg border bg-muted/30 p-2">
                {[0, 1, 2].map((card) => (
                  <LeadCardSkeleton key={card} />
                ))}
              </div>
            </div>
          ))}
        </div>
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
