import { Check, Minus } from "lucide-react";
import type { BillingPlan } from "@/lib/billing-plans";

const SUPPORT_LABEL: Record<string, string> = {
  free: "Autoatendimento",
  professional: "Onboarding assistido",
};

function formatLimit(value: number | undefined): string {
  if (value === undefined) return "—";
  return value === -1 ? "Ilimitado" : value.toLocaleString("pt-BR");
}

function BoolCell({ value }: { value: boolean | undefined }) {
  return value ? (
    <Check className="mx-auto h-4 w-4 text-primary" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
  );
}

interface Row {
  category: string;
  label: string;
  render: (plan: BillingPlan) => React.ReactNode;
}

const ROWS: Row[] = [
  {
    category: "Busca",
    label: "Buscas por mês",
    render: (p) => formatLimit(p.limits.searchesPerMonth),
  },
  {
    category: "Busca",
    label: "Filtros avançados",
    render: (p) => <BoolCell value={p.features.advanced_filters} />,
  },
  { category: "Busca", label: "Buscas salvas", render: (p) => formatLimit(p.limits.savedSearches) },
  {
    category: "Volume",
    label: "Leads processados/mês",
    render: (p) => formatLimit(p.limits.processedLeadsPerMonth),
  },
  { category: "Pipeline", label: "Pipelines", render: (p) => formatLimit(p.limits.pipelines) },
  {
    category: "Mensagens",
    label: "Modelos de mensagem",
    render: (p) =>
      p.limits.messageTemplates === 0 ? (
        <BoolCell value={false} />
      ) : (
        formatLimit(p.limits.messageTemplates)
      ),
  },
  {
    category: "Exportação",
    label: "CSV",
    render: (p) => <BoolCell value={p.features.csv_export} />,
  },
  {
    category: "Exportação",
    label: "Linhas de exportação/mês",
    render: (p) => formatLimit(p.limits.exportRowsPerMonth),
  },
  {
    category: "Suporte",
    label: "Ativação",
    render: (p) => SUPPORT_LABEL[p.code] ?? "—",
  },
];

export function PricingComparison({ plans }: { plans: BillingPlan[] }) {
  return (
    <div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3 text-left font-medium text-muted-foreground">Recurso</th>
              {plans.map((p) => (
                <th key={p.code} className="p-3 text-center font-semibold text-foreground">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              const newCategory = i === 0 || ROWS[i - 1].category !== row.category;
              return (
                <tr key={row.label} className="border-b border-border/60">
                  <td className="p-3 text-muted-foreground">
                    {newCategory && (
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                        {row.category}
                      </div>
                    )}
                    {row.label}
                  </td>
                  {plans.map((p) => (
                    <td key={p.code} className="p-3 text-center">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: accordion per plan */}
      <div className="space-y-2 md:hidden">
        {plans.map((plan) => (
          <details key={plan.code} className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              {plan.name}
            </summary>
            <dl className="mt-3 space-y-2">
              {ROWS.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd>{row.render(plan)}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </div>
  );
}
