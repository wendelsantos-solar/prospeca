import { useMemo } from "react";
import { usePeriodStore } from "@/stores";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DashboardCityTable } from "./DashboardCityTable";
import { formatBRL, formatNumber, formatPercent, formatDecimal } from "@/lib/format";
import { STAGE_LABELS, STAGE_ORDER, PERIOD_OPTIONS } from "@/lib/constants";
import { deltaPct } from "@/lib/period";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MiniBarChart, MiniLineChart, MiniDonutChart } from "@/components/app/MiniCharts";
import type { DashboardPeriod } from "@/types";
import type { DashboardOverview } from "@/repositories/types";

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

interface StageAgg {
  total: number;
  qualified: number;
  contacted: number;
  won: number;
  revenue: number;
  distSum: number;
}

/**
 * Fase 4.2 — o painel agora consome get_dashboard_overview (agregação
 * SERVER-SIDE com membership check). Nada aqui deriva do array truncado de
 * 50 leads. `distSum` permanece 0: leads de funil não têm distância no banco
 * (distanceKm é sempre 0 — ver SORT_ORDER em supabase.ts).
 */
function groupAgg<
  T extends { count: number; won: number; qualified: number; contacted: number; revenue: number },
>(entries: T[], key: (e: T) => string): Record<string, StageAgg> {
  const out: Record<string, StageAgg> = {};
  for (const e of entries) {
    out[key(e)] = {
      total: e.count,
      qualified: e.qualified,
      contacted: e.contacted,
      won: e.won,
      revenue: e.revenue,
      distSum: 0,
    };
  }
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
      <div className="mt-1 flex min-w-0 flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <div
          className={cn(
            "min-w-0 break-words font-semibold leading-none tabular-nums",
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

export function Dashboard({
  current,
  previous,
}: {
  current: DashboardOverview;
  previous: DashboardOverview;
}) {
  const period = usePeriodStore((s) => s.period);
  const setPeriod = usePeriodStore((s) => s.setPeriod);
  const customFrom = usePeriodStore((s) => s.customFrom);
  const customTo = usePeriodStore((s) => s.customTo);
  const setCustomRange = usePeriodStore((s) => s.setCustomRange);

  // Tudo vem do servidor (agregação sobre a carteira inteira, nunca array
  // truncado). a = janela atual, p = janela anterior (para deltas).
  const a = current;
  const p = previous;

  const daySeries = useMemo(
    () =>
      a.dailySeries.map((d) => ({
        ...d,
        conv: d.leads ? Math.round((d.won / d.leads) * 100) : 0,
      })),
    [a.dailySeries],
  );

  const tempSeries = useMemo(
    () =>
      (["hot", "warm", "cold"] as const).map((t) => ({
        name: t === "hot" ? "Quente" : t === "warm" ? "Morno" : "Frio",
        value: a.byTemperature[t] ?? 0,
      })),
    [a.byTemperature],
  );

  const channelSeries = useMemo(
    () => [
      { name: "WhatsApp", value: a.channels.whatsapp },
      { name: "Telefone", value: a.channels.phone },
      { name: "Instagram", value: a.channels.instagram },
      { name: "E-mail", value: a.channels.email },
      { name: "Site", value: a.channels.site },
    ],
    [a.channels],
  );

  const byNiche = useMemo(() => groupAgg(a.byCategory, (e) => e.category), [a.byCategory]);
  const byCity = useMemo(() => groupAgg(a.byCity, (e) => e.city), [a.byCity]);

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
  const empty = a.totalLeads === 0;

  return (
    <div className="min-h-full bg-surface-2 p-4 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">Painel de conversão</h2>
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
                value={formatNumber(a.totalLeads)}
                delta={deltaPct(a.totalLeads, p.totalLeads)}
                tooltip="Leads descobertos dentro do período selecionado."
              />
              <LocalMetricCard
                size="lg"
                label="Ganhos"
                value={formatNumber(a.byStage.won ?? 0)}
                delta={deltaPct(a.byStage.won ?? 0, p.byStage.won ?? 0)}
                accent="success"
                highlight
                tooltip="Negócios fechados."
              />
              <LocalMetricCard
                size="lg"
                label="Conversão"
                value={formatPercent(a.conversionRate / 100)}
                delta={deltaPct(a.conversionRate, p.conversionRate)}
                tooltip="Ganhos sobre o total de leads do período."
              />
              <LocalMetricCard
                size="lg"
                label="Receita fechada"
                value={formatBRL(a.wonValue)}
                delta={deltaPct(a.wonValue, p.wonValue)}
                accent="success"
                highlight
                tooltip="Soma dos valores fechados no período."
              />
            </div>

            {/* Secundárias — detalhe de apoio */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <LocalMetricCard
                label="Enriquecidos"
                value={formatNumber(a.enrichedCount)}
                delta={deltaPct(a.enrichedCount, p.enrichedCount)}
                tooltip="Leads com pelo menos um canal de contato encontrado."
              />
              <LocalMetricCard
                label="Qualificados"
                value={formatNumber(a.byStage.qualified ?? 0)}
                delta={deltaPct(a.byStage.qualified ?? 0, p.byStage.qualified ?? 0)}
                tooltip="Leads no estágio Qualificado."
              />
              <LocalMetricCard
                label="Contatados"
                value={formatNumber(a.byStage.contacted ?? 0)}
                delta={deltaPct(a.byStage.contacted ?? 0, p.byStage.contacted ?? 0)}
                tooltip="Leads no estágio Contatado."
              />
              <LocalMetricCard
                label="Respostas"
                value={formatNumber(a.respondedCount)}
                delta={deltaPct(a.respondedCount, p.respondedCount)}
                tooltip="Leads do período com resposta confirmada pelo usuário."
              />
              <LocalMetricCard
                label="Reuniões"
                value={formatNumber(a.meetingCount)}
                delta={deltaPct(a.meetingCount, p.meetingCount)}
                tooltip="Leads do período com reunião registrada."
              />
              <LocalMetricCard
                label="Propostas"
                value={formatNumber(a.proposalCount)}
                delta={deltaPct(a.proposalCount, p.proposalCount)}
                tooltip="Leads do período com proposta registrada."
              />
              <LocalMetricCard
                label="Descartados"
                value={formatNumber(a.byStage.discarded ?? 0)}
                delta={deltaPct(a.byStage.discarded ?? 0, p.byStage.discarded ?? 0)}
                tooltip="Leads descartados no período."
              />
              <LocalMetricCard
                label="Buscas"
                value={formatNumber(a.searchCount)}
                delta={deltaPct(a.searchCount, p.searchCount)}
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
                value={formatBRL(a.pipelineValueWindowed)}
                delta={deltaPct(a.pipelineValueWindowed, p.pipelineValueWindowed)}
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
                value={a.avgDaysToClose > 0 ? `${formatDecimal(a.avgDaysToClose)} dias` : "—"}
                delta={
                  a.avgDaysToClose > 0 && p.avgDaysToClose > 0
                    ? deltaPct(a.avgDaysToClose, p.avgDaysToClose)
                    : undefined
                }
                tooltip="Média de dias entre a descoberta e o fechamento."
              />
              <LocalMetricCard
                label="Taxa de conversão"
                value={formatPercent(a.conversionRate / 100)}
                delta={deltaPct(a.conversionRate, p.conversionRate)}
                tooltip="Percentual de leads que chegaram a Ganho."
              />
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3">
                <div className="text-[13px] font-semibold">Funil comercial</div>
                <div className="text-[11.5px] text-muted-foreground">Etapas até o fechamento</div>
              </div>
              <div className="space-y-2">
                {STAGE_ORDER.map((s) => {
                  const count = a.byStage[s] ?? 0;
                  const value = a.byStageValue[s] ?? 0;
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{STAGE_LABELS[s]}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {count} ({a.totalLeads ? ((count / a.totalLeads) * 100).toFixed(0) : 0}%)
                          • {formatBRL(value)}
                        </span>
                      </div>
                      <Progress
                        value={a.totalLeads ? (count / a.totalLeads) * 100 : 0}
                        className="h-2"
                      />
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
                <MiniLineChart
                  data={daySeries.map((d) => ({ label: d.date, value: d.leads }))}
                  color={PRIMARY}
                />
              </ChartCard>

              <ChartCard
                title="Leads por estágio"
                subtitle="Volume em cada etapa do funil"
                empty={a.totalLeads === 0}
              >
                <MiniBarChart
                  data={STAGE_ORDER.map((s) => ({
                    label: STAGE_LABELS[s],
                    value: a.byStage[s] ?? 0,
                  }))}
                  color={PRIMARY}
                />
              </ChartCard>

              <ChartCard
                title="Conversão por período (%)"
                subtitle="Evolução da taxa de fechamento"
                empty={daySeries.length === 0}
              >
                <MiniLineChart
                  data={daySeries.map((d) => ({ label: d.date, value: d.conv }))}
                  color={INFO}
                  formatValue={(v) => `${v}%`}
                />
              </ChartCard>

              <ChartCard
                title="Leads por temperatura"
                subtitle="Onde estão suas melhores oportunidades"
                empty={a.totalLeads === 0}
              >
                <MiniDonutChart
                  data={tempSeries.map((t) => ({ label: t.name, value: t.value }))}
                  colors={[PRIMARY, INFO, NEUTRAL]}
                />
              </ChartCard>

              <ChartCard
                title="Distribuição por canal encontrado"
                subtitle="Canais de contato disponíveis"
                empty={a.totalLeads === 0}
              >
                <MiniBarChart
                  data={channelSeries.map((c) => ({ label: c.name, value: c.value }))}
                  color={INFO}
                />
              </ChartCard>

              <ChartCard
                title="Receita fechada por período"
                subtitle="Faturamento gerado ao longo do tempo"
                empty={daySeries.every((d) => d.revenue === 0)}
              >
                <MiniBarChart
                  data={daySeries
                    .filter((d) => d.revenue > 0)
                    .map((d) => ({ label: d.date, value: d.revenue }))}
                  color={PRIMARY}
                  formatValue={formatBRL}
                />
              </ChartCard>

              <ChartCard
                title="Taxa de conversão por nicho (%)"
                subtitle="Ranking por desempenho"
                empty={nicheConvSeries.length === 0}
              >
                <MiniBarChart
                  data={nicheConvSeries.map((n) => ({ label: n.name, value: n.conv }))}
                  color={INFO}
                  horizontal
                  formatValue={(v) => `${v}%`}
                />
              </ChartCard>

              <ChartCard
                title="Taxa de conversão por cidade (%)"
                subtitle="Onde você tem mais tração"
                empty={cityConvSeries.length === 0}
              >
                <MiniBarChart
                  data={cityConvSeries.map((c) => ({ label: c.name, value: c.conv }))}
                  color={PRIMARY}
                  horizontal
                  formatValue={(v) => `${v}%`}
                />
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
