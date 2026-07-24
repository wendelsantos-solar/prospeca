import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, TrendingUp, TrendingDown, ArrowRight, Search } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { Lead } from "@/types";

const COLORS = ["oklch(0.586 0.117 158)", "oklch(0.76 0.14 75)", "oklch(0.6 0.02 160)"];
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function Dashboard({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const found = leads.length;
    const qualified = leads.filter(
      (l) => l.stage === "qualified" || l.stage === "contacted" || l.stage === "won",
    ).length;
    const contacted = leads.filter((l) => l.stage === "contacted" || l.stage === "won").length;
    const won = leads.filter((l) => l.stage === "won").length;
    const rate = leads.length > 0 ? Math.round((won / leads.length) * 100) : 0;
    const potential = leads
      .filter((l) => l.stage !== "discarded" && l.stage !== "won")
      .reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
    const revenue = leads
      .filter((l) => l.stage === "won")
      .reduce((s, l) => s + (l.closedValue ?? l.estimatedValue ?? 0), 0);
    const avgTicket = won > 0 ? Math.round(revenue / won) : 0;
    return { found, qualified, contacted, won, rate, potential, revenue, avgTicket };
  }, [leads]);

  const funnelData = [
    { name: "Encontrados", value: leads.length },
    { name: "No pipeline", value: leads.length },
    { name: "Qualificados", value: stats.qualified },
    { name: "Contatados", value: stats.contacted },
    { name: "Ganhos", value: stats.won },
  ];

  const tempData = useMemo(() => {
    const c = { Quente: 0, Morno: 0, Frio: 0 };
    leads.forEach((l) => {
      if (l.temperature === "hot") c.Quente++;
      else if (l.temperature === "warm") c.Morno++;
      else c.Frio++;
    });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const byCity = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach((l) => {
      m[l.city] = (m[l.city] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .slice(0, 6);
  }, [leads]);

  const trendData = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return WEEKDAYS.map((label, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const leadsCount = leads.filter((l) => sameDay(new Date(l.discoveredAt), day)).length;
      const ganhosCount = leads.filter(
        (l) =>
          l.stage === "won" &&
          sameDay(new Date(l.closedAt ?? l.lastInteractionAt ?? l.discoveredAt), day),
      ).length;
      return { day: label, leads: leadsCount, ganhos: ganhosCount };
    });
  }, [leads]);

  if (leads.length === 0) {
    return (
      <div className="grid h-full place-items-center bg-surface-2 p-8">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h2 className="text-[15px] font-semibold">Ainda não há dados suficientes</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Realize uma nova busca, importe leads ou amplie o período para visualizar suas métricas
            comerciais.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              to="/app/mapa"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <Search className="h-3.5 w-3.5" /> Fazer nova busca
            </Link>
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium hover:border-border-strong">
              Ampliar para 30 dias
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-2 p-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold">Inteligência comercial</h1>
            <p className="text-[12.5px] text-muted-foreground">
              Visão consolidada do seu funil e da sua receita.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
            {["7d", "30d", "90d"].map((p, i) => (
              <button
                key={p}
                className={`rounded px-2.5 py-1 text-[12px] font-medium ${
                  i === 0
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Leads encontrados" value={stats.found} delta="+12%" up />
          <MetricCard label="Qualificados" value={stats.qualified} delta="+4%" up />
          <MetricCard label="Contatados" value={stats.contacted} delta="—" />
          <MetricCard label="Negócios ganhos" value={stats.won} delta="+1" up highlight />
          <MetricCard label="Taxa de conversão" value={`${stats.rate}%`} delta="+3pp" up />
          <MetricCard
            label="Valor potencial"
            value={`R$ ${stats.potential.toLocaleString("pt-BR")}`}
          />
          <MetricCard
            label="Receita fechada"
            value={`R$ ${stats.revenue.toLocaleString("pt-BR")}`}
            highlight
          />
          <MetricCard
            label="Ticket médio"
            value={`R$ ${stats.avgTicket.toLocaleString("pt-BR")}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ChartCard title="Leads por dia" subtitle="Novos leads e negócios ganhos">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="ganhos"
                  stroke="var(--color-info)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Funil de conversão" subtitle="Etapas até o fechamento">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  horizontal={false}
                />
                <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Distribuição por temperatura"
            subtitle="Onde estão suas melhores oportunidades"
          >
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={tempData}
                  innerRadius={45}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                >
                  {tempData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Conversão por cidade" subtitle="Onde você tem mais tração">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCity} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Bar dataKey="value" fill="var(--color-info)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  up,
  highlight,
}: {
  label: string;
  value: string | number;
  delta?: string;
  up?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        highlight ? "border-primary/30 bg-primary-subtle" : "border-border bg-surface"
      }`}
    >
      <div className="text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="text-[20px] font-semibold leading-none">{value}</div>
        {delta && (
          <div
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
              up ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta !== "—" ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="text-[11.5px] text-muted-foreground">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
