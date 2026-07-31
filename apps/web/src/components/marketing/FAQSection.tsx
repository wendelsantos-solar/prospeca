import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "O Radar Local envia mensagens automaticamente?",
    a: "Não. Ele prepara a mensagem com os dados do lead e você revisa e envia pelo seu próprio WhatsApp — nada sai sem sua confirmação.",
  },
  {
    q: "Os dados são atualizados?",
    a: "As informações vêm do Google e são atualizadas quando você busca ou atualiza os detalhes de um lead — não é um retrato ao vivo minuto a minuto.",
  },
  {
    q: "Posso buscar qualquer tipo de empresa?",
    a: "Sim, qualquer nicho pesquisável no Google (ex: barbearia, clínica, restaurante), dentro da região e raio que você escolher.",
  },
  {
    q: "O que significa lead processado?",
    a: "Cada empresa que entra na sua busca e é processada pela plataforma conta como um lead processado — é a métrica de consumo do seu plano.",
  },
  {
    q: "Os créditos acumulam?",
    a: "A franquia mensal do plano não acumula de um mês pro outro. Créditos comprados à parte seguem regra própria de validade, explicada na compra.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Você mantém acesso até o fim do período já pago — sem multa, sem letra miúda.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não, é 100% web. Funciona direto no navegador, sem instalar nada.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim, a interface é responsiva, mas o fluxo de trabalho completo é mais confortável no desktop.",
  },
  {
    q: "Posso exportar os dados?",
    a: "Sim, exportação em CSV está disponível conforme o limite do seu plano.",
  },
  {
    q: "O plano gratuito exige cartão?",
    a: "Não. Você começa a usar sem informar nenhum dado de pagamento.",
  },
  {
    q: "Posso trabalhar em equipe?",
    a: "Sim, a partir do plano Agência, com múltiplos usuários e papéis por organização.",
  },
  {
    q: "Como funciona o score?",
    a: "Cada empresa recebe pontos por sinais comerciais (sem site, telefone encontrado, boa avaliação, proximidade, etc.) — o cálculo é transparente, não é uma caixa-preta.",
  },
  {
    q: "Existe limite de buscas?",
    a: "Sim, cada plano tem uma franquia mensal de buscas e de leads processados — os limites ficam visíveis na sua conta.",
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

export function FAQSection() {
  return (
    <MarketingSection id="perguntas" spacing="lg">
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
