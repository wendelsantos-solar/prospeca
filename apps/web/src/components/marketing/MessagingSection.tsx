import { Check } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { BrowserFrame } from "./BrowserFrame";
import { DEMO_LEADS } from "@/marketing/demo-data";
import { WhatsAppIcon } from "./brand-icons";

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
              eyebrow="Aborde e converta"
              title={
                <>
                  Mensagens prontas,
                  <br />
                  abordagem com contexto
                </>
              }
              description="Nome do dono, dor do negócio e oportunidade detectada — tudo preenchido automaticamente. Você revisa, confirma e envia."
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
          <BrowserFrame url="whatsapp">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <div className="grid h-6 w-6 place-items-center rounded bg-primary-soft text-primary">
                <WhatsAppIcon className="h-3.5 w-3.5" />
              </div>
              Pré-visualização WhatsApp
            </div>
            <div className="rounded-lg bg-[oklch(0.86_0.13_140)] p-3 text-[13px] leading-relaxed text-foreground">
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
          </BrowserFrame>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
