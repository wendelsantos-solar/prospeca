import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ShieldAlert,
  DollarSign,
  Database,
  Zap,
  Users,
  Building2,
  Activity,
  FileSearch,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

interface Overview {
  orgs: number;
  users: number;
  activeOrgs: number;
  searches: number;
  cacheHits: number;
  hitRate: number;
  searchPages: number;
  placeDetails: number;
  geocodes: number;
  forcedRefreshes: number;
  estCostUsd: number;
  estSavedUsd: number;
  cacheEntries: number;
  cacheLifetimeHits: number;
  cacheLifetimeSavedUsd: number;
  stuckSearches: number;
  failedSearches: number;
  budgetCapped: number;
}
interface OrgRow {
  org_id: string;
  name: string;
  plan: string;
  users: number;
  searches: number;
  est_cost_usd: number;
  budget_usd: number | null;
  last_activity: string | null;
}
interface Series {
  day: string;
  searches: number;
  est_cost_usd: number;
}
interface AdminData {
  days: number;
  overview: Overview;
  orgs: OrgRow[];
  timeseries: Series[];
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      {children}
    </section>
  );
}

function AdminCard({
  icon: Icon,
  label,
  value,
  sub,
  delta,
  tone,
  size = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  tone?: "success" | "warn";
  /** "lg" marks a headline indicator (spend, savings, volume, tenants) —
   * separates those from the supporting detail cards instead of every
   * card carrying equal visual weight. */
  size?: "lg" | "default";
}) {
  const iconColor =
    tone === "success"
      ? "text-primary bg-primary-soft"
      : tone === "warn"
        ? "text-warning-foreground bg-warning/15"
        : "text-muted-foreground bg-muted";
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface", size === "lg" ? "p-4" : "p-3.5")}
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-7 w-7 place-items-center rounded-md ${iconColor}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {delta && <span className="text-[10.5px] font-medium text-primary">{delta}</span>}
      </div>
      <div className="mt-2 text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-semibold leading-tight",
          size === "lg" ? "mt-1 text-[24px]" : "mt-0.5 text-[18px]",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function HealthRow({
  name,
  status,
  details,
}: {
  name: string;
  status: "ok" | "warn" | "err";
  details: string;
}) {
  const color =
    status === "ok" ? "bg-primary" : status === "warn" ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium">{name}</div>
        <div className="text-[11px] text-muted-foreground">{details}</div>
      </div>
    </div>
  );
}

/** Teto de gasto US$/mês editável. Vazio = ilimitado. Salva no blur/Enter e
 * ativa o guarda-corpo do execute-search (para de pagar Google ao estourar). */
function BudgetCell({ org, onSaved }: { org: OrgRow; onSaved: () => void }) {
  const [val, setVal] = useState(org.budget_usd != null ? String(org.budget_usd) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = val.trim();
    const budget = trimmed === "" ? null : Number(trimmed);
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
      toast.error("Valor inválido");
      setVal(org.budget_usd != null ? String(org.budget_usd) : "");
      return;
    }
    if (budget === (org.budget_usd ?? null)) return; // sem mudança
    setSaving(true);
    try {
      await invokeFunction("set-org-budget", { orgId: org.org_id, budget });
      toast.success(budget == null ? "Teto removido (ilimitado)" : `Teto: US$ ${budget}/mês`);
      onSaved();
    } catch {
      toast.error("Falha ao salvar teto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-xs text-muted-foreground">US$</span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="∞"
        disabled={saving}
        aria-label={`Teto mensal de ${org.name}`}
        className="w-20 rounded border bg-background px-2 py-1 text-right text-sm disabled:opacity-50"
      />
    </div>
  );
}

const PERIODS = [7, 15, 30, 90];

function AdminPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery<AdminData>({
    queryKey: ["admin-overview", days],
    queryFn: () => invokeFunction<AdminData>("get-admin-overview", { days }),
    enabled: isRealMode,
    retry: false,
    staleTime: 60_000,
    placeholderData: (prev) => prev, // mantém a tela na troca de período (sem flash)
  });

  if (!isRealMode) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Painel disponível apenas em modo real.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando painel…
        </div>
      </div>
    );
  }
  if (error || !data?.overview) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm rounded-lg border bg-surface p-6 text-center shadow-elevated">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm font-medium">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Este painel é exclusivo do administrador da plataforma.
          </p>
        </div>
      </div>
    );
  }

  const o = data.overview;
  const consumo = data.timeseries.map((s) => ({
    d: new Date(s.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    buscas: s.searches,
    custo: s.est_cost_usd,
  }));

  const orgColumns: DataTableColumn<OrgRow>[] = [
    { key: "name", label: "Organização", sortValue: (r) => r.name, render: (r) => r.name },
    {
      key: "plan",
      label: "Plano",
      sortValue: (r) => r.plan,
      render: (r) => <Badge variant="secondary">{r.plan}</Badge>,
    },
    {
      key: "users",
      label: "Usuários",
      align: "right",
      sortValue: (r) => r.users,
      render: (r) => r.users,
    },
    {
      key: "searches",
      label: "Buscas",
      align: "right",
      sortValue: (r) => r.searches,
      render: (r) => r.searches,
    },
    {
      key: "est_cost_usd",
      label: "Custo est.",
      align: "right",
      sortValue: (r) => r.est_cost_usd,
      render: (r) => (
        <span
          className={cn(
            r.budget_usd != null &&
              r.est_cost_usd >= r.budget_usd &&
              "font-medium text-destructive",
          )}
        >
          US$ {r.est_cost_usd.toFixed(2)}
        </span>
      ),
    },
    {
      key: "budget_usd",
      label: "Teto (US$/mês)",
      render: (r) => (
        <BudgetCell
          org={r}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-overview"] })}
        />
      ),
    },
    {
      key: "last_activity",
      label: "Última atividade",
      sortValue: (r) => r.last_activity ?? "",
      render: (r) => (
        <span className="text-muted-foreground">
          {r.last_activity ? new Date(r.last_activity).toLocaleDateString("pt-BR") : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-surface-2 p-5">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold">Administração</h1>
            <p className="text-[12.5px] text-muted-foreground">
              Consumo, cache e saúde operacional da plataforma · últimos {days} dias.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {PERIODS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={
                  "rounded px-3 py-1 text-[12.5px] font-medium transition-colors " +
                  (days === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent")
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <Section title="Visão geral" desc={`Indicadores principais dos últimos ${days} dias`}>
          {/* Principais — gasto, economia, volume e organizações */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AdminCard
              size="lg"
              icon={DollarSign}
              label="Custo Google"
              value={`US$ ${o.estCostUsd.toFixed(2)}`}
              tone="warn"
            />
            <AdminCard
              size="lg"
              icon={Database}
              label="Economia do cache"
              value={`US$ ${o.estSavedUsd.toFixed(2)}`}
              sub={`${o.cacheLifetimeHits} reusos totais → US$ ${o.cacheLifetimeSavedUsd.toFixed(2)}`}
              tone="success"
            />
            <AdminCard
              size="lg"
              icon={Activity}
              label="Buscas"
              value={o.searches}
              sub={`${o.cacheHits} do cache`}
            />
            <AdminCard
              size="lg"
              icon={Building2}
              label="Organizações"
              value={`${o.activeOrgs}/${o.orgs}`}
              sub="ativas/total"
            />
          </div>

          {/* Secundárias — detalhe de apoio. Alertas (buscas presas/falhas/
           * budget travado) não repetem aqui — vivem só em "Saúde operacional",
           * que já mostra o estado ok/warn sempre, não só quando > 0. */}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AdminCard
              icon={Zap}
              label="Cache hit-rate"
              value={`${Math.round(o.hitRate * 100)}%`}
              tone="success"
            />
            <AdminCard icon={Database} label="Entradas no cache" value={o.cacheEntries} />
            <AdminCard icon={Users} label="Usuários" value={o.users} />
            <AdminCard
              icon={FileSearch}
              label="Páginas Google"
              value={o.searchPages}
              sub={`+${o.geocodes} geocodes`}
            />
          </div>
        </Section>

        <Section title="Consumo" desc={`Buscas realizadas nos últimos ${days} dias`}>
          <div className="rounded-xl border border-border bg-surface p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={consumo} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="d" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                  }}
                  formatter={(value: number, name: string) =>
                    name === "buscas" ? [value, "Buscas"] : [`US$ ${value}`, "Custo"]
                  }
                />
                <Area
                  type="monotone"
                  dataKey="buscas"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#fillC)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section
          title="Custo por organização"
          desc={`Ordenado por gasto estimado · últimos ${days}d`}
        >
          <div className="rounded-xl border border-border bg-surface p-4">
            <DataTable
              columns={orgColumns}
              data={data.orgs}
              rowKey={(r) => r.org_id}
              emptyIcon={Building2}
              emptyTitle="Nenhuma organização ainda"
            />
          </div>
        </Section>

        <Section title="Saúde operacional" desc="Sinais reais de fila, falhas e budget">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <HealthRow
              name="Fila de buscas"
              status={o.stuckSearches > 0 ? "warn" : "ok"}
              details={`${o.stuckSearches} busca(s) presa(s)`}
            />
            <HealthRow
              name="Buscas falhas"
              status={o.failedSearches > 0 ? "warn" : "ok"}
              details={`${o.failedSearches} falha(s) no período`}
            />
            <HealthRow
              name="Budget das organizações"
              status={o.budgetCapped > 0 ? "warn" : "ok"}
              details={
                o.budgetCapped > 0
                  ? `${o.budgetCapped} org(s) com teto travado`
                  : "Nenhuma organização travada"
              }
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
