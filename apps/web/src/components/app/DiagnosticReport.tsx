import {
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  MapPin,
  Building2,
  Target,
  MessageSquare,
  Phone,
  Mail,
  Instagram,
  Globe,
  Star,
} from "lucide-react";
import type { DiagnosticReport, PresenceStatus } from "@/lib/diagnostic-report";
import { formatDate } from "@/lib/format";

/**
 * Presentational white-label diagnostic report. Renders on a light "paper"
 * theme regardless of the app's dark mode, so the printed/saved PDF is always
 * clean and legible. Pure component — no hooks, no data access.
 */

const TEMP_STYLES: Record<"hot" | "warm" | "cold", { badge: string; bar: string }> = {
  hot: { badge: "bg-orange-50 text-orange-700 border-orange-200", bar: "bg-orange-500" },
  warm: { badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" },
  cold: { badge: "bg-sky-50 text-sky-700 border-sky-200", bar: "bg-sky-500" },
};

const PRESENCE_STYLE: Record<PresenceStatus, { icon: typeof CheckCircle2; cls: string }> = {
  ok: { icon: CheckCircle2, cls: "text-emerald-600" },
  gap: { icon: AlertCircle, cls: "text-orange-600" },
  unknown: { icon: MinusCircle, cls: "text-slate-400" },
};

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
      <Icon className="h-4 w-4" />
      {children}
    </h3>
  );
}

export function DiagnosticReportView({ report }: { report: DiagnosticReport }) {
  const temp = TEMP_STYLES[report.score.temperature] ?? TEMP_STYLES.cold;

  return (
    <div className="mx-auto max-w-[800px] bg-white text-slate-800">
      {/* ── Cabeçalho white-label ── */}
      <header className="border-b border-slate-200 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{report.brand.companyName}</p>
            <p className="text-xs text-slate-500">{report.brand.authorName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Relatório de Diagnóstico
            </p>
            <p className="text-xs text-slate-500">Auditoria de presença digital</p>
            <p className="text-[11px] text-slate-400">{formatDate(report.generatedAt)}</p>
          </div>
        </div>
      </header>

      {/* ── Empresa ── */}
      <section className="py-6">
        <h2 className="text-2xl font-bold leading-tight text-slate-900">{report.company.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {[report.company.category, report.company.location].filter(Boolean).join(" · ")}
        </p>
        {report.company.address && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" /> {report.company.address}
          </p>
        )}
      </section>

      {/* ── Score de oportunidade ── */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Índice de oportunidade
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-900">{report.score.total}</span>
              <span className="text-sm text-slate-400">/ 100</span>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${temp.badge}`}
          >
            {report.score.temperatureLabel}
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${temp.bar}`}
            style={{ width: `${Math.max(0, Math.min(100, report.score.total))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">{report.score.temperatureHint}</p>

        {report.score.breakdown.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Por que este negócio pontua assim
            </p>
            {report.score.breakdown.map((b, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <span className="font-medium text-slate-700">{b.label}</span>
                  <span className="text-slate-400"> — {b.reason}</span>
                </div>
                <span className="shrink-0 font-mono font-semibold text-slate-700">+{b.points}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Presença digital ── */}
      <section className="py-6">
        <SectionTitle icon={Globe}>Presença digital</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {report.presence.map((p) => {
            const { icon: Icon, cls } = PRESENCE_STYLE[p.status];
            return (
              <div
                key={p.label}
                className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5"
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{p.label}</p>
                  <p className="truncate text-[11px] text-slate-500" title={p.detail}>
                    {p.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Oportunidades / lacunas ── */}
      <section className="py-6">
        <SectionTitle icon={Target}>Por que esta é uma oportunidade</SectionTitle>
        <ul className="space-y-2">
          {report.gaps.map((g, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
              <span>
                <span className="font-medium">{report.company.name}</span> {g}.
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Próxima ação ── */}
      <section className="rounded-xl border border-slate-200 p-5">
        <SectionTitle icon={Target}>Próxima ação recomendada</SectionTitle>
        <p className="text-sm font-semibold text-slate-900">{report.nextAction.action}</p>
        <p className="mt-1 text-xs text-slate-500">{report.nextAction.reason}</p>
      </section>

      {/* ── Abordagem sugerida ── */}
      <section className="py-6">
        <SectionTitle icon={MessageSquare}>Abordagem sugerida</SectionTitle>
        <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {report.message}
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="mt-2 border-t border-slate-200 pt-4 pb-6 text-center text-[11px] text-slate-400">
        Gerado por {report.brand.companyName} via Prospeca · {formatDate(report.generatedAt)}
      </footer>
    </div>
  );
}
