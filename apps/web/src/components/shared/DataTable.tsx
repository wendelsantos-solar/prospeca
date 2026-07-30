import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";

/** SSR-safe media query hook — only renders the appropriate layout (desktop
 * table vs mobile cards) instead of rendering both and hiding one via CSS.
 * Cuts per-row DOM work in half on either device. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Present → column header is clickable and sortable. Return the raw
   * comparable value (not the rendered node) for this row. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface SortState {
  key: string;
  dir: 1 | -1;
}

/** Generic table: sort, pagination, density, empty state, and a mobile
 * stacked-card fallback — built once so pages stop hand-rolling this.
 * Doesn't (yet) support expandable/nested rows — the one existing table
 * that needs that (Dashboard's per-city breakdown) stays hand-rolled. */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  pageSize,
  defaultSort,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  className,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  defaultSort?: SortState;
  emptyIcon?: React.ElementType;
  emptyTitle: string;
  emptyDescription?: string;
  className?: string;
}) {
  const density = useUIStore((s) => s.density);
  const compact = density === "compact";
  const isMobile = useIsMobile();
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const x = col.sortValue!(a);
      const y = col.sortValue!(b);
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * sort.dir;
      return ((x as number) - (y as number)) * sort.dir;
    });
  }, [data, sort, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const paged = pageSize ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted;

  const toggleSort = (key: string) => {
    setSort((s) => ({ key, dir: s?.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));
    setPage(0);
  };

  const alignClass = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : undefined;

  if (data.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={className}>
      {isMobile ? (
        /* Mobile: stacked label:value cards */
        <div className="space-y-2">
          {paged.map((row) => (
            <div key={rowKey(row)} className="rounded-lg border border-border bg-surface p-3">
              {columns.map((col) => (
                <div
                  key={col.key}
                  className="flex items-center justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0"
                >
                  <span className="text-xs text-muted-foreground">{col.label}</span>
                  <span className="text-right">{col.render(row)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* Desktop/tablet: real table */
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(alignClass(col.align), col.headerClassName)}
                  >
                    {col.sortValue ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort(col.key)}
                        aria-label={`Ordenar por ${col.label}`}
                      >
                        {col.label}
                        <AppIcon
                          icon={icons.directional.sort}
                          size="xs"
                          tone={sort?.key === col.key ? "default" : "muted"}
                          decorative
                        />
                      </button>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        alignClass(col.align),
                        compact ? "py-1.5 text-[12.5px]" : "py-2",
                        col.cellClassName,
                      )}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageSize && pageCount > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {pageCount}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Página anterior"
          >
            <AppIcon icon={icons.directional.chevronLeft} size="sm" tone="inherit" decorative />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Próxima página"
          >
            <AppIcon icon={icons.directional.chevronRight} size="sm" tone="inherit" decorative />
          </Button>
        </div>
      )}
    </div>
  );
}
