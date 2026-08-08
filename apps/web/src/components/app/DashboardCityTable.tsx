/**
 * City performance table — extracted from Dashboard.tsx for code-splitting
 * and memoization. ~140 lines of table logic that only re-renders when the
 * underlying city aggregations change.
 */
import { memo, useState, useMemo, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronRight, ArrowRight, ArrowLeft } from "lucide-react";
import { formatBRL, formatDecimal } from "@/lib/format";

// ── Types ────────────────────────────────────────────────────────────

interface StageAgg {
  total: number;
  qualified: number;
  contacted: number;
  won: number;
  revenue: number;
  distSum: number;
}

type SortKey = "name" | "total" | "qualified" | "contacted" | "won" | "conv" | "revenue" | "dist";

// ── Helpers ───────────────────────────────────────────────────────────

function sortRows(rows: [string, StageAgg][], key: SortKey, dir: 1 | -1) {
  return [...rows].sort((a, b) => {
    const va =
      key === "name"
        ? a[0]
        : key === "conv"
          ? a[1].total
            ? a[1].won / a[1].total
            : 0
          : (a[1][key as keyof StageAgg] ?? 0);
    const vb =
      key === "name"
        ? b[0]
        : key === "conv"
          ? b[1].total
            ? b[1].won / b[1].total
            : 0
          : (b[1][key as keyof StageAgg] ?? 0);
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
    return ((va as number) - (vb as number)) * dir;
  });
}

// ── Sortable head ─────────────────────────────────────────────────────

function SortableHead({
  label,
  k,
  sort,
  setSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  className?: string;
}) {
  return (
    <TableHead
      className={className}
      onClick={() => setSort({ key: k, dir: sort.key === k ? ((sort.dir * -1) as 1 | -1) : -1 })}
    >
      <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        {label}
        {sort.key === k && <span className="text-[10px]">{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}

// ── Component ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export const DashboardCityTable = memo(function DashboardCityTable({
  byCity,
}: {
  byCity: Record<string, StageAgg>;
}) {
  const [citySort, setCitySort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "total",
    dir: -1,
  });
  const [citySearch, setCitySearch] = useState("");
  const [cityPage, setCityPage] = useState(0);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const entries = Object.entries(byCity) as [string, StageAgg][];

  const filtered = useMemo(() => {
    if (!citySearch) return entries;
    const q = citySearch.toLowerCase();
    return entries.filter(([city]) => city.toLowerCase().includes(q));
  }, [entries, citySearch]);

  const sorted = useMemo(
    () => sortRows(filtered, citySort.key, citySort.dir),
    [filtered, citySort],
  );

  const cityPages = Math.ceil(sorted.length / PAGE_SIZE);
  const cityRows = sorted.slice(cityPage * PAGE_SIZE, (cityPage + 1) * PAGE_SIZE);

  // Expanded-city neighborhoods — derived from the same byCity data keyed
  // "City / Neighborhood". Only shown when a row is toggled open.
  const neighborhoodsOf = (city: string): [string, StageAgg][] =>
    entries.filter(([k]) => k.startsWith(`${city} / `) && k !== city);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3">
          <div className="text-[13px] font-semibold">Desempenho por cidade</div>
          <div className="text-[11.5px] text-muted-foreground">Onde você tem mais tração</div>
        </div>
        <p className="text-center text-sm text-muted-foreground py-6">Nenhuma cidade ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-row items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">Desempenho por cidade</div>
          <div className="text-[11.5px] text-muted-foreground">Onde você tem mais tração</div>
        </div>
        <div className="relative w-56">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={citySearch}
            onChange={(e) => {
              setCitySearch(e.target.value);
              setCityPage(0);
            }}
            placeholder="Buscar cidade..."
            className="h-8 pl-7 text-xs"
            aria-label="Buscar cidade"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <SortableHead label="Cidade" k="name" sort={citySort} setSort={setCitySort} />
              <SortableHead
                label="Leads"
                k="total"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
              <SortableHead
                label="Qualificados"
                k="qualified"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
              <SortableHead
                label="Contatados"
                k="contacted"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
              <SortableHead
                label="Ganhos"
                k="won"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
              <SortableHead
                label="Conversão"
                k="conv"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
              <SortableHead
                label="Receita"
                k="revenue"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
              <SortableHead
                label="Dist. média"
                k="dist"
                sort={citySort}
                setSort={setCitySort}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cityRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                  Nenhuma cidade encontrada.
                </TableCell>
              </TableRow>
            )}
            {cityRows.map(([city, v]) => (
              <Fragment key={city}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedCity(expandedCity === city ? null : city)}
                >
                  <TableCell>
                    {expandedCity === city ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{city}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.qualified}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.contacted}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.won}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.total ? ((v.won / v.total) * 100).toFixed(1) : "0"}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(v.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.total ? `${formatDecimal(v.distSum / v.total)} km` : "—"}
                  </TableCell>
                </TableRow>
                {expandedCity === city &&
                  neighborhoodsOf(city).map(([nb, nv]) => (
                    <TableRow key={`${city}-${nb}`} className="bg-muted/30">
                      <TableCell />
                      <TableCell className="pl-8 text-xs text-muted-foreground">{nb}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{nv.total}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {nv.qualified}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {nv.contacted}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{nv.won}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {nv.total ? ((nv.won / nv.total) * 100).toFixed(1) : "0"}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatBRL(nv.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {nv.total ? `${formatDecimal(nv.distSum / nv.total)} km` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        {cityPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>
              {cityPage * PAGE_SIZE + 1}–{Math.min((cityPage + 1) * PAGE_SIZE, sorted.length)} de{" "}
              {sorted.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={cityPage === 0}
              onClick={() => setCityPage((p) => p - 1)}
            >
              <ArrowLeft className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={cityPage >= cityPages - 1}
              onClick={() => setCityPage((p) => p + 1)}
            >
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
