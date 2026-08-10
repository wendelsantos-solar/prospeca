/**
 * Schema.org JSON-LD for rich snippets in Google Search.
 */
export function SoftwareApplicationSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Prospeca",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Encontre empresas por nicho e região, entenda o score de oportunidade e organize o próximo contato com você no controle.",
    url: "https://prospeca.com.br",
    offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export function FAQSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "A Prospeca envia mensagens automaticamente?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Não. Ela prepara a mensagem com os dados do lead e você revisa e envia pelo seu próprio WhatsApp — nada sai sem sua confirmação.",
        },
      },
      {
        "@type": "Question",
        name: "Os dados são atualizados?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "As informações vêm do Google e são atualizadas quando você busca ou atualiza os detalhes de um lead.",
        },
      },
      {
        "@type": "Question",
        name: "Preciso de cartão de crédito para testar?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Não. Você pode começar gratuitamente sem cartão de crédito e fazer suas primeiras buscas em poucos minutos.",
        },
      },
      {
        "@type": "Question",
        name: "Posso buscar qualquer tipo de empresa?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim, qualquer nicho pesquisável no Google (ex: barbearia, clínica, restaurante), dentro da região e raio que você escolher.",
        },
      },
      {
        "@type": "Question",
        name: "Posso cancelar quando quiser?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. Durante o piloto, a ativação e o cancelamento são tratados diretamente com você, sem contratação automática ou multa.",
        },
      },
    ],
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
