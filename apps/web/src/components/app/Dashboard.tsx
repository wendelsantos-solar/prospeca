import { useMemo, useState, Fragment } from "react";
import { useLeadsStore, usePeriodStore } from "@/stores";
import { MetricCard } from "@/components/shared/MetricCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatBRL, formatNumber, formatPercent, formatDecimal } from "@/lib/format";
import { STAGE_LABELS, STAGE_ORDER, PERIOD_OPTIONS } from "@/lib/constants";
import { resolvePeriod, previousWindow, leadsInWindow, deltaPct, inWindow } from "@/lib/period";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import type { Lead, LeadStage, DashboardPeriod } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowUpDown, ChevronDown, ChevronRight, BarChart3, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "oklch(0.58 0.14 155)",
  "oklch(0.62 0.16 245)",
  "oklch(0.72 0.17 55)",
  "oklch(0.83 0.15 90)",
  "oklch(0.60 0.20 305)",
];
const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--popover)",
  border: "1px solid var(--border)",
  color: "var(--popover-foreground)",
} as const;

interface StageAgg {
  total: number;
  qualified: number;
  contacted: number;
  won: number;
  revenue: number;
  distSum: number;
}

function aggregate(leads: Lead[]) {
  const byStage: Record<LeadStage, Lead[]> = {
    new: [],
    qualified: [],
    contacted: [],
    won: [],
    discarded: [],
  };
  leads.forEach((l) => byStage[l.stage].push(l));
  const total = leads.length;
  const enriched = leads.filter((l) => l.phone || l.whatsapp || l.email).length;
  const revenue = byStage.won.reduce((s, l) => s + (l.closedValue ?? 0), 0);
  const pipeline = leads.filter((l) => l.stage !== "discarded" && l.stage !== "won");
  const pipelineValue = pipeline.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const conv = total ? (byStage.won.length / total) * 100 : 0;
  const avgTicket = byStage.won.length ? revenue / byStage.won.length : 0;
  const convDays = byStage.won
    .filter((l) => l.closedAt)
    .map((l) => (new Date(l.closedAt!).getTime() - new Date(l.discoveredAt).getTime()) / 86400000);
  const avgConvDays = convDays.length
    ? convDays.reduce((a, b) => a + b, 0) / convDays.length
    : null;
  return {
    byStage,
    total,
    enriched,
    revenue,
    pipelineValue,
    pipelineCount: pipeline.length,
    conv,
    avgTicket,
    avgConvDays,
  };
}

function groupBy(leads: Lead[], key: (l: Lead) => string): Record<string, StageAgg> {
  const out: Record<string, StageAgg> = {};
  leads.forEach((l) => {
    const k = key(l);
    out[k] ??= { total: 0, qualified: 0, contacted: 0, won: 0, revenue: 0, distSum: 0 };
    out[k].total++;
    out[k].distSum += l.distanceKm;
    if (l.stage === "qualified") out[k].qualified++;
    if (l.stage === "contacted") out[k].contacted++;
    if (l.stage === "won") {
      out[k].won++;
      out[k].revenue += l.closedValue ?? 0;
    }
  });
  return out;
}

type SortKey =
  | "total"
  | "qualified"
  | "contacted"
  | "won"
  | "conv"
  | "revenue"
  | "ticket"
  | "dist"
  | "name";

function sortRows(rows: [string, StageAgg][], key: SortKey, dir: 1 | -1) {
  const val = ([name, v]: [string, StageAgg]) => {
    switch (key) {
      case "name":
        return name;
      case "conv":
        return v.total ? v.won / v.total : 0;
      case "ticket":
        return v.won ? v.revenue / v.won : 0;
      case "dist":
        return v.total ? v.distSum / v.total : 0;
      default:
        return v[key];
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a),
      y = val(b);
    if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * dir;
    return ((x as number) - (y as number)) * dir;
  });
}

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
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort({ key: k, dir: sort.key === k ? (sort.dir === 1 ? -1 : 1) : -1 })}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <ArrowUpDown
          className={cn("h-3 w-3", sort.key === k ? "text-foreground" : "text-muted-foreground/50")}
        />
      </button>
    </TableHead>
  );
}

function ChartCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-elegant">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {empty ? (
          <EmptyState
            icon={BarChart3}
            title="Nenhum dado no período"
            description="Ajuste o período ou faça novas buscas."
            className="h-full py-0"
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard({ leads }: { leads: Lead[] }) {
  const period = usePeriodStore((s) => s.period);
  const setPeriod = usePeriodStore((s) => s.setPeriod);
  const customFrom = usePeriodStore((s) => s.customFrom);
  const customTo = usePeriodStore((s) => s.customTo);
  const setCustomRange = usePeriodStore((s) => s.setCustomRange);
  const history = useLeadsStore((s) => s.history);

  const win = useMemo(
    () => resolvePeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  );
  const prevWin = useMemo(() => previousWindow(win), [win]);
  const current = useMemo(() => leadsInWindow(leads, win), [leads, win]);
  const previous = useMemo(() => leadsInWindow(leads, prevWin), [leads, prevWin]);
  const a = useMemo(() => aggregate(current), [current]);
  const p = useMemo(() => aggregate(previous), [previous]);
  const searchesInWin = useMemo(
    () => history.filter((h) => inWindow(h.createdAt, win)).length,
    [history, win],
  );
  const searchesInPrev = useMemo(
    () => history.filter((h) => inWindow(h.createdAt, prevWin)).length,
    [history, prevWin],
  );

  // Taxa de resposta simulada, estável por conjunto de dados.
  const responseRate =
    a.byStage.contacted.length + a.byStage.won.length > 0
      ? Math.min(72, 25 + ((a.byStage.won.length * 17 + a.byStage.contacted.length * 7) % 40))
      : 0;
  const prevResponseRate =
    p.byStage.contacted.length + p.byStage.won.length > 0
      ? Math.min(72, 25 + ((p.byStage.won.length * 17 + p.byStage.contacted.length * 7) % 40))
      : 0;

  const daySeries = useMemo(() => {
    const byDay: Record<string, { leads: number; revenue: number; won: number }> = {};
    current.forEach((l) => {
      const d = new Date(l.discoveredAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      byDay[d] ??= { leads: 0, revenue: 0, won: 0 };
      byDay[d].leads++;
    });
    current
      .filter((l) => l.stage === "won" && l.closedAt)
      .forEach((l) => {
        const d = new Date(l.closedAt!).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        byDay[d] ??= { leads: 0, revenue: 0, won: 0 };
        byDay[d].revenue += l.closedValue ?? 0;
        byDay[d].won++;
      });
    return Object.entries(byDay)
      .map(([date, v]) => ({ date, ...v, conv: v.leads ? Math.round((v.won / v.leads) * 100) : 0 }))
      .slice(-30);
  }, [current]);

  const tempSeries = useMemo(
    () =>
      (["hot", "warm", "cold"] as const).map((t) => ({
        name: t === "hot" ? "Quente" : t === "warm" ? "Morno" : "Frio",
        value: current.filter((l) => l.temperature === t).length,
      })),
    [current],
  );

  const channelSeries = useMemo(
    () => [
      { name: "WhatsApp", value: current.filter((l) => l.whatsapp).length },
      { name: "Telefone", value: current.filter((l) => l.phone).length },
      { name: "Instagram", value: current.filter((l) => l.instagram).length },
      { name: "E-mail", value: current.filter((l) => l.email).length },
      { name: "Site", value: current.filter((l) => l.hasWebsite).length },
    ],
    [current],
  );

  const byNiche = useMemo(() => groupBy(current, (l) => l.category), [current]);
  const byCity = useMemo(() => groupBy(current, (l) => l.city), [current]);

  const nicheConvSeries = useMemo(
    () =>
      Object.entries(byNiche)
        .map(([name, v]) => ({
          name: name.length > 14 ? name.slice(0, 13) + "…" : name,
          conv: v.total ? Number(((v.won / v.total) * 100).toFixed(1)) : 0,
        }))
        .sort((x, y) => y.conv - x.conv)
        .slice(0, 8),
    [byNiche],
  );
  const cityConvSeries = useMemo(
    () =>
      Object.entries(byCity)
        .map(([name, v]) => ({
          name,
          conv: v.total ? Number(((v.won / v.total) * 100).toFixed(1)) : 0,
        }))
        .sort((x, y) => y.conv - x.conv),
    [byCity],
  );

  const [nicheSort, setNicheSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "total",
    dir: -1,
  });
  const [citySort, setCitySort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "total",
    dir: -1,
  });
  const [citySearch, setCitySearch] = useState("");
  const [cityPage, setCityPage] = useState(0);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const CITY_PAGE_SIZE = 5;

  const nicheRows = useMemo(
    () => sortRows(Object.entries(byNiche), nicheSort.key, nicheSort.dir),
    [byNiche, nicheSort],
  );
  const cityRowsAll = useMemo(() => {
    const rows = sortRows(Object.entries(byCity), citySort.key, citySort.dir);
    return citySearch
      ? rows.filter(([name]) => name.toLowerCase().includes(citySearch.toLowerCase()))
      : rows;
  }, [byCity, citySort, citySearch]);
  const cityPages = Math.max(1, Math.ceil(cityRowsAll.length / CITY_PAGE_SIZE));
  const cityRows = cityRowsAll.slice(cityPage * CITY_PAGE_SIZE, (cityPage + 1) * CITY_PAGE_SIZE);

  const neighborhoodsOf = (city: string) => {
    const rows = groupBy(
      current.filter((l) => l.city === city && l.neighborhood),
      (l) => l.neighborhood!,
    );
    return Object.entries(rows).sort((x, y) => y[1].total - x[1].total);
  };

  const empty = current.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Painel de conversão</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe métricas de leads, funil e receita no período.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
            <TabsList className="h-8 flex-wrap">
              {PERIOD_OPTIONS.map((o) => (
                <TabsTrigger key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={customFrom}
                onChange={(e) => setCustomRange(e.target.value, customTo)}
                aria-label="Data inicial"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={customTo}
                onChange={(e) => setCustomRange(customFrom, e.target.value)}
                aria-label="Data final"
              />
            </div>
          )}
        </div>
      </div>

      {empty ? (
        <Card className="border-border/70 shadow-elegant">
          <CardContent>
            <EmptyState
              icon={BarChart3}
              title="Nenhum dado no período selecionado"
              description="Amplie o período ou realize novas buscas para alimentar o painel."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <MetricCard
              label="Total de leads"
              value={formatNumber(a.total)}
              delta={deltaPct(a.total, p.total)}
              tooltip="Leads descobertos dentro do período selecionado."
            />
            <MetricCard
              label="Enriquecidos"
              value={formatNumber(a.enriched)}
              delta={deltaPct(a.enriched, p.enriched)}
              tooltip="Leads com pelo menos um canal de contato encontrado."
            />
            <MetricCard
              label="Qualificados"
              value={formatNumber(a.byStage.qualified.length)}
              delta={deltaPct(a.byStage.qualified.length, p.byStage.qualified.length)}
              tooltip="Leads no estágio Qualificado."
            />
            <MetricCard
              label="Contatados"
              value={formatNumber(a.byStage.contacted.length)}
              delta={deltaPct(a.byStage.contacted.length, p.byStage.contacted.length)}
              tooltip="Leads no estágio Contatado."
            />
            <MetricCard
              label="Ganhos"
              value={formatNumber(a.byStage.won.length)}
              delta={deltaPct(a.byStage.won.length, p.byStage.won.length)}
              accent="success"
              tooltip="Negócios fechados."
            />
            <MetricCard
              label="Descartados"
              value={formatNumber(a.byStage.discarded.length)}
              delta={deltaPct(a.byStage.discarded.length, p.byStage.discarded.length)}
              tooltip="Leads descartados no período."
            />
            <MetricCard
              label="Conversão"
              value={formatPercent(a.conv / 100)}
              delta={deltaPct(a.conv, p.conv)}
              tooltip="Ganhos sobre o total de leads do período."
            />
            <MetricCard
              label="Buscas"
              value={formatNumber(searchesInWin)}
              delta={deltaPct(searchesInWin, searchesInPrev)}
              tooltip="Buscas realizadas no período."
            />
            <MetricCard
              label="Leads no funil"
              value={formatNumber(a.pipelineCount)}
              delta={deltaPct(a.pipelineCount, p.pipelineCount)}
              tooltip="Leads ativos (fora de Ganho e Descartado)."
            />
            <MetricCard
              label="Valor em negociação"
              value={formatBRL(a.pipelineValue)}
              delta={deltaPct(a.pipelineValue, p.pipelineValue)}
              tooltip="Soma dos valores estimados dos leads ativos."
            />
            <MetricCard
              label="Receita fechada"
              value={formatBRL(a.revenue)}
              delta={deltaPct(a.revenue, p.revenue)}
              accent="success"
              tooltip="Soma dos valores fechados no período."
            />
            <MetricCard
              label="Ticket médio"
              value={formatBRL(a.avgTicket)}
              delta={deltaPct(a.avgTicket, p.avgTicket)}
              tooltip="Receita fechada dividida pelos negócios ganhos."
            />
            <MetricCard
              label="Tempo médio conv."
              value={a.avgConvDays != null ? `${formatDecimal(a.avgConvDays)} dias` : "—"}
              delta={
                a.avgConvDays != null && p.avgConvDays != null
                  ? deltaPct(a.avgConvDays, p.avgConvDays)
                  : undefined
              }
              tooltip="Média de dias entre a descoberta e o fechamento."
            />
            <MetricCard
              label="Taxa de resposta"
              value={formatPercent(responseRate / 100)}
              delta={deltaPct(responseRate, prevResponseRate)}
              tooltip="Taxa simulada de resposta às mensagens enviadas."
            />
          </div>

          <Card className="border-border/70 shadow-elegant">
            <CardHeader>
              <CardTitle className="text-sm">Funil comercial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {STAGE_ORDER.map((s, i) => {
                  const count = a.byStage[s].length;
                  const prev = i > 0 ? a.byStage[STAGE_ORDER[i - 1]].length : a.total;
                  const pass = prev ? (count / prev) * 100 : 0;
                  const value = a.byStage[s].reduce(
                    (sum, l) =>
                      sum + (s === "won" ? (l.closedValue ?? 0) : (l.estimatedValue ?? 0)),
                    0,
                  );
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{STAGE_LABELS[s]}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {count} ({a.total ? ((count / a.total) * 100).toFixed(0) : 0}%) •{" "}
                          {formatBRL(value)}
                          {i > 0 && (
                            <span className="ml-2 text-[10px]">({pass.toFixed(0)}% passagem)</span>
                          )}
                        </span>
                      </div>
                      <Progress value={a.total ? (count / a.total) * 100 : 0} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Leads encontrados por dia" empty={daySeries.length === 0}>
              <ResponsiveContainer>
                <LineChart data={daySeries}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Leads por estágio" empty={a.total === 0}>
              <ResponsiveContainer>
                <BarChart
                  data={STAGE_ORDER.map((s) => ({
                    name: STAGE_LABELS[s],
                    value: a.byStage[s].length,
                  }))}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Leads" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Conversão por período (%)" empty={daySeries.length === 0}>
              <ResponsiveContainer>
                <LineChart data={daySeries}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v}%`, "Conversão"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="conv"
                    name="Conversão"
                    stroke={CHART_COLORS[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Leads por temperatura" empty={a.total === 0}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={tempSeries}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {tempSeries.map((_, i) => (
                      <Cell
                        key={i}
                        fill={[CHART_COLORS[2], CHART_COLORS[3], "oklch(0.72 0.04 250)"][i]}
                      />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuição por canal encontrado" empty={a.total === 0}>
              <ResponsiveContainer>
                <BarChart data={channelSeries}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Leads" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Receita fechada por período"
              empty={daySeries.every((d) => d.revenue === 0)}
            >
              <ResponsiveContainer>
                <BarChart data={daySeries.filter((d) => d.revenue > 0)}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => formatBRL(v).replace(",00", "")}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [formatBRL(v), "Receita"]}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Receita"
                    fill={CHART_COLORS[0]}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Taxa de conversão por nicho (%)" empty={nicheConvSeries.length === 0}>
              <ResponsiveContainer>
                <BarChart data={nicheConvSeries} layout="vertical">
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v}%`, "Conversão"]}
                  />
                  <Bar
                    dataKey="conv"
                    name="Conversão"
                    fill={CHART_COLORS[4]}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Taxa de conversão por cidade (%)" empty={cityConvSeries.length === 0}>
              <ResponsiveContainer>
                <BarChart data={cityConvSeries} layout="vertical">
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v}%`, "Conversão"]}
                  />
                  <Bar
                    dataKey="conv"
                    name="Conversão"
                    fill={CHART_COLORS[2]}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <Card className="border-border/70 shadow-elegant">
            <CardHeader>
              <CardTitle className="text-sm">Desempenho por nicho</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Nicho" k="name" sort={nicheSort} setSort={setNicheSort} />
                    <SortableHead
                      label="Leads"
                      k="total"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Qualificados"
                      k="qualified"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Contatados"
                      k="contacted"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Ganhos"
                      k="won"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Conversão"
                      k="conv"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Receita"
                      k="revenue"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Ticket médio"
                      k="ticket"
                      sort={nicheSort}
                      setSort={setNicheSort}
                      className="text-right"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nicheRows.map(([niche, v]) => {
                    const max = Math.max(...Object.values(byNiche).map((x) => x.total), 1);
                    return (
                      <TableRow key={niche}>
                        <TableCell className="font-medium">{niche}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="tabular-nums">{v.total}</span>
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${(v.total / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{v.qualified}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.contacted}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.won}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v.total ? ((v.won / v.total) * 100).toFixed(1) : "0"}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(v.revenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v.won ? formatBRL(v.revenue / v.won) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-sm">Desempenho por cidade</CardTitle>
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
            </CardHeader>
            <CardContent className="overflow-x-auto">
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
                      <TableCell
                        colSpan={9}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
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
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(v.revenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v.total ? `${formatDecimal(v.distSum / v.total)} km` : "—"}
                        </TableCell>
                      </TableRow>
                      {expandedCity === city &&
                        neighborhoodsOf(city).map(([nb, nv]) => (
                          <TableRow key={`${city}-${nb}`} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="pl-8 text-xs text-muted-foreground">
                              {nb}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {nv.total}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {nv.qualified}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {nv.contacted}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {nv.won}
                            </TableCell>
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
                    Página {cityPage + 1} de {cityPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    disabled={cityPage === 0}
                    onClick={() => setCityPage((p2) => p2 - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    disabled={cityPage >= cityPages - 1}
                    onClick={() => setCityPage((p2) => p2 + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
