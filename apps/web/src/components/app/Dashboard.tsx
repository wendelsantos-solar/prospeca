import { useMemo, useState } from "react";
import { useLeadsStore, usePeriodStore } from "@/stores";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DashboardCityTable } from "./DashboardCityTable";
import { formatBRL, formatNumber, formatPercent, formatDecimal } from "@/lib/format";
import { STAGE_LABELS, STAGE_ORDER, PERIOD_OPTIONS } from "@/lib/constants";
import { resolvePeriod, previousWindow, leadsInWindow, deltaPct, inWindow } from "@/lib/period";
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

import { Progress } from "@/components/ui/progress";
import { ArrowRight, BarChart3, TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/category";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PRIMARY = "var(--color-primary)";
const INFO = "var(--color-info)";
const NEUTRAL = "var(--color-muted-foreground)";
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--color-border)",
} as const;
const AXIS_PROPS = { fontSize: 11, stroke: "var(--color-muted-foreground)" } as const;

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
  const responses = leads.filter((lead) => lead.respondedAt).length;
  const meetings = leads.filter((lead) => lead.meetingAt).length;
  const proposals = leads.filter((lead) => lead.proposalAt).length;
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
    responses,
    meetings,
    proposals,
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

function ChartCard({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3">
        <div className="text-[13px] font-semibold">{title}</div>
        {subtitle && <div className="text-[11.5px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="h-64">
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
      </div>
    </div>
  );
}

/** LocalMetricCard estilizado conforme referência visual (radar-elevate/analises).
 *  Local a este arquivo — não altera o componente compartilhado usado em outras telas. */
function LocalMetricCard({
  label,
  value,
  delta,
  tooltip,
  accent,
  highlight,
  size = "default",
}: {
  label: string;
  value: string;
  delta?: number | null;
  tooltip?: string;
  accent?: "primary" | "hot" | "warm" | "cold" | "success" | "info";
  highlight?: boolean;
  /** "lg" marks a headline metric — bigger value, more padding. Used to
   * separate the 3-4 numbers that answer "how's the business" from the
   * dozen supporting ones, instead of every card carrying equal weight. */
  size?: "lg" | "default";
}) {
  const trend = delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <div
      className={cn(
        "rounded-xl border",
        size === "lg" ? "p-4" : "p-3.5",
        highlight ? "border-primary/30 bg-primary-subtle" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground">
        {label}
        {tooltip && (
          <TooltipProvider>
            <UiTooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/70" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div
          className={cn(
            "font-semibold leading-none tabular-nums",
            size === "lg" ? "text-[26px]" : "text-[20px]",
            accent === "hot" && "text-hot",
            accent === "success" && "text-success",
          )}
        >
          {value}
        </div>
        {delta != null && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              trend === "up" && "text-primary",
              trend === "down" && "text-muted-foreground",
              trend === "flat" && "text-muted-foreground",
            )}
          >
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {trend === "flat" && <ArrowRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
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
        .map(([rawName, v]) => {
          const name = categoryLabel(rawName);
          return {
            name: name.length > 14 ? name.slice(0, 13) + "…" : name,
            conv: v.total ? Number(((v.won / v.total) * 100).toFixed(1)) : 0,
          };
        })
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

  const nicheRows = useMemo(() => Object.entries(byNiche) as [string, StageAgg][], [byNiche]);
  const nicheColumns: DataTableColumn<[string, StageAgg]>[] = useMemo(() => {
    const max = Math.max(...Object.values(byNiche).map((x) => x.total), 1);
    return [
      {
        key: "name",
        label: "Nicho",
        sortValue: ([niche]) => categoryLabel(niche),
        render: ([niche]) => <span className="font-medium">{categoryLabel(niche)}</span>,
      },
      {
        key: "total",
        label: "Leads",
        align: "right",
        sortValue: ([, v]) => v.total,
        render: ([, v]) => (
          <div className="flex items-center justify-end gap-2">
            <span className="tabular-nums">{v.total}</span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${(v.total / max) * 100}%` }} />
            </div>
          </div>
        ),
      },
      {
        key: "qualified",
        label: "Qualificados",
        align: "right",
        sortValue: ([, v]) => v.qualified,
        render: ([, v]) => <span className="tabular-nums">{v.qualified}</span>,
      },
      {
        key: "contacted",
        label: "Contatados",
        align: "right",
        sortValue: ([, v]) => v.contacted,
        render: ([, v]) => <span className="tabular-nums">{v.contacted}</span>,
      },
      {
        key: "won",
        label: "Ganhos",
        align: "right",
        sortValue: ([, v]) => v.won,
        render: ([, v]) => <span className="tabular-nums">{v.won}</span>,
      },
      {
        key: "conv",
        label: "Conversão",
        align: "right",
        sortValue: ([, v]) => (v.total ? v.won / v.total : 0),
        render: ([, v]) => (
          <span className="tabular-nums">
            {v.total ? ((v.won / v.total) * 100).toFixed(1) : "0"}%
          </span>
        ),
      },
      {
        key: "revenue",
        label: "Receita",
        align: "right",
        sortValue: ([, v]) => v.revenue,
        render: ([, v]) => <span className="tabular-nums">{formatBRL(v.revenue)}</span>,
      },
      {
        key: "ticket",
        label: "Ticket médio",
        align: "right",
        sortValue: ([, v]) => (v.won ? v.revenue / v.won : 0),
        render: ([, v]) => (
          <span className="tabular-nums">{v.won ? formatBRL(v.revenue / v.won) : "—"}</span>
        ),
      },
    ];
  }, [byNiche]);
  const empty = current.length === 0;

  return (
    <div className="min-h-full bg-surface-2 p-4 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold">Painel de conversão</h1>
            <p className="text-[12.5px] text-muted-foreground">
              Acompanhe métricas de leads, funil e receita no período.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
              <TabsList className="h-auto flex-wrap rounded-md border border-border bg-surface p-0.5">
                {PERIOD_OPTIONS.map((o) => (
                  <TabsTrigger
                    key={o.value}
                    value={o.value}
                    className="rounded px-2.5 py-1 text-[12px] font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                  >
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
          <div className="rounded-xl border border-border bg-surface p-4">
            <EmptyState
              icon={BarChart3}
              title="Nenhum dado no período selecionado"
              description="Amplie o período ou realize novas buscas para alimentar o painel."
            />
          </div>
        ) : (
          <>
            {/* Principais — os 4 números que respondem "como tá o negócio" de cara */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <LocalMetricCard
                size="lg"
                label="Total de leads"
                value={formatNumber(a.total)}
                delta={deltaPct(a.total, p.total)}
                tooltip="Leads descobertos dentro do período selecionado."
              />
              <LocalMetricCard
                size="lg"
                label="Ganhos"
                value={formatNumber(a.byStage.won.length)}
                delta={deltaPct(a.byStage.won.length, p.byStage.won.length)}
                accent="success"
                highlight
                tooltip="Negócios fechados."
              />
              <LocalMetricCard
                size="lg"
                label="Conversão"
                value={formatPercent(a.conv / 100)}
                delta={deltaPct(a.conv, p.conv)}
                tooltip="Ganhos sobre o total de leads do período."
              />
              <LocalMetricCard
                size="lg"
                label="Receita fechada"
                value={formatBRL(a.revenue)}
                delta={deltaPct(a.revenue, p.revenue)}
                accent="success"
                highlight
                tooltip="Soma dos valores fechados no período."
              />
            </div>

            {/* Secundárias — detalhe de apoio */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <LocalMetricCard
                label="Enriquecidos"
                value={formatNumber(a.enriched)}
                delta={deltaPct(a.enriched, p.enriched)}
                tooltip="Leads com pelo menos um canal de contato encontrado."
              />
              <LocalMetricCard
                label="Qualificados"
                value={formatNumber(a.byStage.qualified.length)}
                delta={deltaPct(a.byStage.qualified.length, p.byStage.qualified.length)}
                tooltip="Leads no estágio Qualificado."
              />
              <LocalMetricCard
                label="Contatados"
                value={formatNumber(a.byStage.contacted.length)}
                delta={deltaPct(a.byStage.contacted.length, p.byStage.contacted.length)}
                tooltip="Leads no estágio Contatado."
              />
              <LocalMetricCard
                label="Respostas"
                value={formatNumber(a.responses)}
                delta={deltaPct(a.responses, p.responses)}
                tooltip="Leads do período com resposta confirmada pelo usuário."
              />
              <LocalMetricCard
                label="Reuniões"
                value={formatNumber(a.meetings)}
                delta={deltaPct(a.meetings, p.meetings)}
                tooltip="Leads do período com reunião registrada."
              />
              <LocalMetricCard
                label="Propostas"
                value={formatNumber(a.proposals)}
                delta={deltaPct(a.proposals, p.proposals)}
                tooltip="Leads do período com proposta registrada."
              />
              <LocalMetricCard
                label="Descartados"
                value={formatNumber(a.byStage.discarded.length)}
                delta={deltaPct(a.byStage.discarded.length, p.byStage.discarded.length)}
                tooltip="Leads descartados no período."
              />
              <LocalMetricCard
                label="Buscas"
                value={formatNumber(searchesInWin)}
                delta={deltaPct(searchesInWin, searchesInPrev)}
                tooltip="Buscas realizadas no período."
              />
              <LocalMetricCard
                label="Leads no funil"
                value={formatNumber(a.pipelineCount)}
                delta={deltaPct(a.pipelineCount, p.pipelineCount)}
                tooltip="Leads ativos (fora de Ganho e Descartado)."
              />
              <LocalMetricCard
                label="Valor em negociação"
                value={formatBRL(a.pipelineValue)}
                delta={deltaPct(a.pipelineValue, p.pipelineValue)}
                tooltip="Soma dos valores estimados dos leads ativos."
              />
              <LocalMetricCard
                label="Ticket médio"
                value={formatBRL(a.avgTicket)}
                delta={deltaPct(a.avgTicket, p.avgTicket)}
                tooltip="Receita fechada dividida pelos negócios ganhos."
              />
              <LocalMetricCard
                label="Tempo médio conv."
                value={a.avgConvDays != null ? `${formatDecimal(a.avgConvDays)} dias` : "—"}
                delta={
                  a.avgConvDays != null && p.avgConvDays != null
                    ? deltaPct(a.avgConvDays, p.avgConvDays)
                    : undefined
                }
                tooltip="Média de dias entre a descoberta e o fechamento."
              />
              <LocalMetricCard
                label="Taxa de conversão"
                value={formatPercent(a.conv / 100)}
                delta={deltaPct(a.conv, p.conv)}
                tooltip="Percentual de leads que chegaram a Ganho."
              />
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3">
                <div className="text-[13px] font-semibold">Funil comercial</div>
                <div className="text-[11.5px] text-muted-foreground">Etapas até o fechamento</div>
              </div>
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Leads encontrados por dia"
                subtitle="Novos leads capturados ao longo do tempo"
                empty={daySeries.length === 0}
              >
                <ResponsiveContainer>
                  <LineChart data={daySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke={PRIMARY}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Leads por estágio"
                subtitle="Volume em cada etapa do funil"
                empty={a.total === 0}
              >
                <ResponsiveContainer>
                  <BarChart
                    data={STAGE_ORDER.map((s) => ({
                      name: STAGE_LABELS[s],
                      value: a.byStage[s].length,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="value" name="Leads" fill={PRIMARY} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Conversão por período (%)"
                subtitle="Evolução da taxa de fechamento"
                empty={daySeries.length === 0}
              >
                <ResponsiveContainer>
                  <LineChart data={daySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} unit="%" />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [`${v}%`, "Conversão"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="conv"
                      name="Conversão"
                      stroke={INFO}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Leads por temperatura"
                subtitle="Onde estão suas melhores oportunidades"
                empty={a.total === 0}
              >
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
                        <Cell key={i} fill={[PRIMARY, INFO, NEUTRAL][i]} />
                      ))}
                    </Pie>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Distribuição por canal encontrado"
                subtitle="Canais de contato disponíveis"
                empty={a.total === 0}
              >
                <ResponsiveContainer>
                  <BarChart data={channelSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="value" name="Leads" fill={INFO} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Receita fechada por período"
                subtitle="Faturamento gerado ao longo do tempo"
                empty={daySeries.every((d) => d.revenue === 0)}
              >
                <ResponsiveContainer>
                  <BarChart data={daySeries.filter((d) => d.revenue > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" {...AXIS_PROPS} />
                    <YAxis
                      {...AXIS_PROPS}
                      tickFormatter={(v: number) => formatBRL(v).replace(",00", "")}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [formatBRL(v), "Receita"]}
                    />
                    <Bar dataKey="revenue" name="Receita" fill={PRIMARY} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Taxa de conversão por nicho (%)"
                subtitle="Ranking por desempenho"
                empty={nicheConvSeries.length === 0}
              >
                <ResponsiveContainer>
                  <BarChart data={nicheConvSeries} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" {...AXIS_PROPS} unit="%" />
                    <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={110} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [`${v}%`, "Conversão"]}
                    />
                    <Bar dataKey="conv" name="Conversão" fill={INFO} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Taxa de conversão por cidade (%)"
                subtitle="Onde você tem mais tração"
                empty={cityConvSeries.length === 0}
              >
                <ResponsiveContainer>
                  <BarChart data={cityConvSeries} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" {...AXIS_PROPS} unit="%" />
                    <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={110} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [`${v}%`, "Conversão"]}
                    />
                    <Bar dataKey="conv" name="Conversão" fill={PRIMARY} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3">
                <div className="text-[13px] font-semibold">Desempenho por nicho</div>
                <div className="text-[11.5px] text-muted-foreground">Ranking por desempenho</div>
              </div>
              <DataTable
                columns={nicheColumns}
                data={nicheRows}
                rowKey={([niche]) => niche}
                emptyTitle="Nenhum nicho ainda"
              />
            </div>

            <DashboardCityTable byCity={byCity} />
          </>
        )}
      </div>
    </div>
  );
}
