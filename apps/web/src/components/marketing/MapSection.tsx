import { Section, SectionHeading } from "./Section";

const BENEFITS = [
  "Visualizar onde as oportunidades se concentram",
  "Priorizar por proximidade real, não só por lista",
  "Explorar regiões inteiras num só raio de busca",
  "Comparar bairros diferentes lado a lado",
  "Identificar áreas ainda pouco trabalhadas",
];

export function MapSection() {
  return (
    <Section muted>
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="order-2 md:order-1">
          <div className="relative h-56 overflow-hidden rounded-xl border border-border bg-surface md:h-72">
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:18px_18px]" />
            <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/40 md:h-40 md:w-40" />
            {[
              { top: "45%", left: "48%", t: "hot" },
              { top: "60%", left: "58%", t: "warm" },
              { top: "35%", left: "60%", t: "hot" },
              { top: "55%", left: "38%", t: "cold" },
            ].map((pin, i) => (
              <div
                key={i}
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow"
                style={{
                  top: pin.top,
                  left: pin.left,
                  background: `var(--${pin.t})`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2">
          <SectionHeading eyebrow="Mapa" title="Veja onde estão suas próximas oportunidades." />
          <ul className="mt-5 space-y-2.5">
            {BENEFITS.map((b) => (
              <li key={b} className="text-sm text-muted-foreground">
                — {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
