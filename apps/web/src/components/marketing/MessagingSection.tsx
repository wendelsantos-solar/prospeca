import { Check } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { DEMO_LEADS } from "@/marketing/demo-data";

const HIGHLIGHTS = [
  "Variáveis preenchidas com dados reais do lead",
  "Modelos salvos, reutilizáveis a qualquer hora",
  "Pré-visualização antes de enviar",
  "Aviso quando um campo do lead está ausente",
  "Você revisa e confirma — o envio é sempre seu",
];

export function MessagingSection() {
  const lead = DEMO_LEADS[0];
  return (
    <MarketingSection muted spacing="lg">
      <MarketingContainer width="default">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Mensagens"
              title="Abordagens personalizadas sem começar do zero."
            />
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <div className="grid h-6 w-6 place-items-center rounded bg-primary-soft text-primary">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              Pré-visualização WhatsApp
            </div>
            <div className="rounded-lg bg-[oklch(0.86_0.13_140)] p-3 text-sm leading-relaxed text-foreground">
              <p>
                Oi {lead.contactName}! Vi que a <strong>{lead.companyName}</strong> ainda não tem
                site — trabalho com isso aqui na região e queria entender se faz sentido pra vocês.
                Já atendi outras {lead.category.toLowerCase()}s por aqui. Posso te mandar uns
                exemplos?
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Você confirma e envia pelo seu WhatsApp — nada sai sem sua revisão.
            </p>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
