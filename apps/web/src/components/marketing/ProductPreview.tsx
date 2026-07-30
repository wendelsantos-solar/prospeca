import { MapPin, Star, Phone, TrendingUp, GitBranch } from "lucide-react";

/**
 * Coded composition of the real product surfaces (search, map, opportunity
 * card, pipeline) — not a screenshot. There's no product photography to use
 * honestly yet, so this mirrors actual UI structure/copy instead of faking one.
 */
export function ProductPreview() {
  return (
    <div className="relative rounded-2xl border border-border bg-surface p-3 shadow-card md:p-4">
      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        {/* Map + search panel */}
        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Barbearia · Barra da Tijuca, Rio de Janeiro · 10 km
          </div>
          <div className="relative h-40 overflow-hidden rounded-lg bg-[oklch(0.94_0.02_156)] md:h-56">
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute left-[35%] top-[40%] h-16 w-16 rounded-full border-2 border-primary/40" />
            {[
              { top: "38%", left: "42%", label: "89" },
              { top: "55%", left: "58%", label: "76" },
              { top: "30%", left: "60%", label: "64" },
            ].map((pin) => (
              <div
                key={pin.label}
                className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-hot text-[11px] font-semibold text-hot-foreground shadow"
                style={{ top: pin.top, left: pin.left }}
              >
                {pin.label}
              </div>
            ))}
          </div>
        </div>

        {/* Opportunity card + pipeline strip */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Rústica Barbearia</span>
              <span className="rounded-md bg-hot-soft px-2 py-0.5 text-xs font-semibold text-hot">
                Score 89
              </span>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-primary" /> Não possui site
              </li>
              <li className="flex items-center gap-1.5">
                <Star className="h-3 w-3 text-primary" /> Avaliação 4,9 · 234 avaliações
              </li>
              <li className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-primary" /> Telefone e WhatsApp encontrados
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GitBranch className="h-3 w-3" /> Pipeline
            </div>
            <div className="flex gap-2 text-[11px]">
              {[
                { label: "Novo", n: 12 },
                { label: "Contatado", n: 5 },
                { label: "Qualificado", n: 3 },
              ].map((stage) => (
                <div key={stage.label} className="flex-1 rounded-md bg-surface-2 p-2 text-center">
                  <div className="font-semibold text-foreground">{stage.n}</div>
                  <div className="text-muted-foreground">{stage.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
