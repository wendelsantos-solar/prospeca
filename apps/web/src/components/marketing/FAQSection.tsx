import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "A Prospeca envia mensagens automaticamente?",
    a: "Não. Ele prepara a mensagem com os dados do lead e você revisa e envia pelo seu próprio WhatsApp — nada sai sem sua confirmação.",
  },
  {
    q: "Os dados são atualizados?",
    a: "As informações vêm do Google e são atualizadas quando você busca ou atualiza os detalhes de um lead — não é um retrato ao vivo minuto a minuto.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Durante o piloto, a ativação e o cancelamento são tratados diretamente com você, sem contratação automática ou multa.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim, a interface é responsiva, mas o fluxo de trabalho completo é mais confortável no desktop.",
  },
  {
    q: "O plano gratuito exige cartão?",
    a: "Não. Você começa a usar sem informar nenhum dado de pagamento.",
  },
  {
    q: "Como funciona o score?",
    a: "Cada empresa recebe pontos por sinais comerciais (sem site, telefone encontrado, boa avaliação, proximidade, etc.) — o cálculo é transparente, não é uma caixa-preta.",
  },
  {
    q: "Como funciona a privacidade?",
    a: "Seguimos a LGPD — dados de contato têm origem pública e você pode solicitar remoção a qualquer momento pelo canal de contato do site.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => {
          const n = !open;
          setOpen(n);
          if (n) track("faq_opened", { question: q });
        }}
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
        aria-expanded={open}
      >
        <span>{q}</span>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition-transform duration-200">
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
        </div>
      </div>
    </div>
  );
}

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export function FAQSection() {
  return (
    <MarketingSection id="perguntas" spacing="lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingContainer width="narrow">
        <SectionHeading title="Perguntas frequentes" center />
        <div className="mt-10">
          {FAQS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
