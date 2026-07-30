import { Section, SectionHeading } from "./Section";
import { track } from "@/lib/analytics";

const FAQS: { q: string; a: string }[] = [
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
    q: "O Radar Local substitui um CRM?",
    a: "Ele cobre o essencial de organizar prospecção (Pipeline, notas, atividades) focado em negócios locais — não é um CRM completo pra operações de vendas complexas.",
  },
  {
    q: "Como os dados são obtidos?",
    a: "A partir de fontes públicas do Google (Places/Maps) sobre estabelecimentos comerciais.",
  },
  {
    q: "Como funciona a privacidade?",
    a: "Seguimos a LGPD — dados de contato têm origem pública e você pode solicitar remoção a qualquer momento pelo canal de contato do site.",
  },
];

export function FAQSection() {
  return (
    <Section id="perguntas">
      <SectionHeading title="Perguntas frequentes" center />
      <div className="mx-auto mt-10 max-w-2xl divide-y divide-border">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group py-4"
            onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open) track("faq_opened", { question: item.q });
            }}
          >
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
