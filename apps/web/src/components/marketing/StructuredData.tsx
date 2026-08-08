/**
 * StructuredData — injects Schema.org JSON-LD into the document <head>.
 * Renders nothing visible; must be placed inside a React tree that
 * reaches the <head> (e.g. via TanStack Start's Head component).
 *
 * If your router doesn't support head injection, move the JSON-LD
 * strings to a static <script> in your root index.html instead.
 */

export function SoftwareApplicationSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Prospeca",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Prospecção B2B, Geração de Leads, Inteligência Comercial",
    operatingSystem: "Web",
    description:
      "Plataforma de prospecção comercial local. Pesquise empresas por nicho e região, veja scores de oportunidade e organize seu pipeline — da descoberta ao fechamento.",
    url: "https://www.prospeca.com.br",
    featureList:
      "Busca de empresas por nicho e região, Score de oportunidade de 0 a 100, Pipeline de prospecção, Mensagens personalizadas, Mapa interativo, Follow-up organizado",
    offers: [
      {
        "@type": "Offer",
        name: "Grátis",
        price: "0",
        priceCurrency: "BRL",
        description: "50 leads/mês, pipeline básico, 1 usuário",
      },
      {
        "@type": "Offer",
        name: "Profissional",
        price: "97",
        priceCurrency: "BRL",
        description: "200 leads/mês, pipeline completo, mensagens, 2 usuários",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "O que é o Prospeca?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O Prospeca é uma plataforma de prospecção comercial local. Ele ajuda profissionais que vendem para negócios locais a encontrar empresas por nicho e região, ver scores de oportunidade e organizar toda a prospecção em um pipeline — da descoberta ao fechamento.",
        },
      },
      {
        "@type": "Question",
        name: "Como funciona o score de oportunidade?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O score avalia cada empresa de 0 a 100 com base em 6 fatores: se possui site, telefone válido, WhatsApp disponível, avaliações no Google, distância até você e presença no Instagram. Empresas com score alto são as que mais precisam do seu serviço.",
        },
      },
      {
        "@type": "Question",
        name: "De onde vêm os dados das empresas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Os dados vêm de fontes públicas brasileiras e do Google Maps. O Prospeca cruza informações de CNPJ, presença digital e avaliações para dar uma visão completa de cada empresa. Tudo em conformidade com a LGPD.",
        },
      },
      {
        "@type": "Question",
        name: "Preciso de cartão de crédito para testar?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Não. Você pode começar gratuitamente sem cartão de crédito e configurar sua primeira busca em poucos minutos. O plano gratuito oferece 50 leads por mês.",
        },
      },
      {
        "@type": "Question",
        name: "Consigo usar em qualquer cidade do Brasil?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. O Prospeca cobre todo o território nacional. Basta escolher o nicho e a região desejada — a plataforma encontra empresas em qualquer cidade brasileira.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
