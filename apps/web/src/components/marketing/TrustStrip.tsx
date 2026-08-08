import { Database, Eye, ShieldCheck } from "lucide-react";
import { MarketingContainer } from "./MarketingLayout";

const GUARANTEES = [
  {
    icon: Database,
    title: "Dados com origem identificada",
    description: "CNPJ e informações públicas atualizados durante a busca.",
  },
  {
    icon: Eye,
    title: "Prioridade que você entende",
    description: "Cada ponto do score mostra o sinal comercial encontrado.",
  },
  {
    icon: ShieldCheck,
    title: "Automação sob seu controle",
    description: "A plataforma sugere; você revisa e decide o que enviar.",
  },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Garantias do produto"
      className="border-y border-border/60 bg-surface-2 py-7 md:py-9"
    >
      <MarketingContainer width="default">
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {GUARANTEES.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
                <item.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}
