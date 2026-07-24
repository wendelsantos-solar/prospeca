import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";

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
  overview: Overview;
  orgs: OrgRow[];
  timeseries: Series[];
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-lg border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-2xl font-semibold " +
          (tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-destructive" : "")
        }
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Bars({ series }: { series: Series[] }) {
  const max = Math.max(1, ...series.map((s) => s.searches));
  return (
    <div className="flex items-end gap-1 h-28">
      {series.map((s) => (
        <div
          key={s.day}
          className="flex-1 flex flex-col items-center justify-end gap-1"
          title={`${s.day}: ${s.searches} buscas · US$ ${s.est_cost_usd}`}
        >
          <div
            className="w-full rounded-t bg-primary/70"
            style={{
              height: `${Math.round((s.searches / max) * 100)}%`,
              minHeight: s.searches > 0 ? 3 : 0,
            }}
          />
        </div>
      ))}
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

function AdminPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<AdminData>({
    queryKey: ["admin-overview"],
    queryFn: () => invokeFunction<AdminData>("get-admin-overview", {}),
    enabled: isRealMode,
    retry: false,
    staleTime: 60_000,
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
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Administração da plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de todos os clientes · mês corrente. Custos são estimativas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Custo Google (mês)" value={`US$ ${o.estCostUsd.toFixed(2)}`} />
          <Stat
            label="Economia do cache"
            value={`US$ ${o.estSavedUsd.toFixed(2)}`}
            sub={`${o.cacheLifetimeHits} reusos totais → US$ ${o.cacheLifetimeSavedUsd.toFixed(2)}`}
            tone="good"
          />
          <Stat label="Cache hit-rate" value={`${Math.round(o.hitRate * 100)}%`} tone="good" />
          <Stat label="Entradas no cache" value={String(o.cacheEntries)} />
          <Stat label="Orgs (ativas/total)" value={`${o.activeOrgs}/${o.orgs}`} />
          <Stat label="Usuários" value={String(o.users)} />
          <Stat label="Buscas (mês)" value={String(o.searches)} sub={`${o.cacheHits} do cache`} />
          <Stat
            label="Páginas Google"
            value={String(o.searchPages)}
            sub={`+${o.geocodes} geocodes`}
          />
        </div>

        {(o.stuckSearches > 0 || o.failedSearches > 0 || o.budgetCapped > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Buscas presas"
              value={String(o.stuckSearches)}
              tone={o.stuckSearches > 0 ? "warn" : undefined}
            />
            <Stat
              label="Buscas falhas"
              value={String(o.failedSearches)}
              tone={o.failedSearches > 0 ? "warn" : undefined}
            />
            <Stat
              label="Budget travado"
              value={String(o.budgetCapped)}
              tone={o.budgetCapped > 0 ? "warn" : undefined}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscas por dia (30d)</CardTitle>
            <CardDescription>Barra = buscas concluídas no dia.</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars series={data.timeseries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custo por organização (mês)</CardTitle>
            <CardDescription>Ordenado por gasto estimado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Organização</th>
                    <th className="py-2 pr-3 font-medium">Plano</th>
                    <th className="py-2 pr-3 font-medium text-right">Usuários</th>
                    <th className="py-2 pr-3 font-medium text-right">Buscas</th>
                    <th className="py-2 pr-3 font-medium text-right">Custo est.</th>
                    <th className="py-2 pr-3 font-medium text-right">Teto (US$/mês)</th>
                    <th className="py-2 font-medium">Última atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orgs.map((r) => (
                    <tr key={r.org_id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="secondary">{r.plan}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">{r.users}</td>
                      <td className="py-2 pr-3 text-right">{r.searches}</td>
                      <td
                        className={
                          "py-2 pr-3 text-right" +
                          (r.budget_usd != null && r.est_cost_usd >= r.budget_usd
                            ? " font-medium text-destructive"
                            : "")
                        }
                      >
                        US$ {r.est_cost_usd.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3">
                        <BudgetCell
                          org={r}
                          onSaved={() =>
                            queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
                          }
                        />
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {r.last_activity
                          ? new Date(r.last_activity).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {data.orgs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Nenhuma organização ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
