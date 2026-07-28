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

export function DetailsSkeleton() {
  return (
    <div className="p-5 space-y-4" aria-busy="true">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
