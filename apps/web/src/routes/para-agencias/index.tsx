import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingSection,
  MarketingContainer,
  SectionHeading,
} from "@/components/marketing/MarketingLayout";
import { AgencySection } from "@/components/marketing/AgencySection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export const Route = createFileRoute("/para-agencias/")({
  head: () => ({
    meta: [
      { title: "Para Agências — Radar Local" },
      {
        name: "description",
        content:
          "Radar Local para agências: múltiplos usuários, pipelines colaborativos, relatórios por usuário e gestão de equipe para prospecção de negócios locais.",
      },
      { property: "og:title", content: "Para Agências — Radar Local" },
      {
        property: "og:description",
        content: "Prospecção local em equipe com Pipeline colaborativo e gestão de leads.",
      },
    ],
    links: [{ rel: "canonical", href: "/para-agencias" }],
  }),
  component: AgenciasPage,
});

function AgenciasPage() {
  return (
    <MarketingPage>
      <MarketingSection spacing="sm" className="pt-24 md:pt-28">
        <MarketingContainer width="default">
          <SectionHeading
            eyebrow="Para agências"
            title="Prospecção local em equipe, com Pipeline colaborativo e dados centralizados"
            description="Para agências e consultorias que prospectam para múltiplos clientes ou gerenciam equipes de prospecção."
            center
          />
        </MarketingContainer>
      </MarketingSection>
      <AgencySection />
      <MarketingSection spacing="md">
        <MarketingContainer width="narrow">
          <SectionHeading title="Como equipes usam o Radar Local" center />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Agências de marketing",
                description:
                  "Encontram empresas sem presença digital para oferecer sites, redes sociais e tráfego pago. Cada consultor gerencia sua própria carteira de leads.",
              },
              {
                title: "Consultorias comerciais",
                description:
                  "Montam listas qualificadas por região e nicho, distribuem entre vendedores e acompanham conversões em pipelines separados.",
              },
              {
                title: "Empresas de software",
                description:
                  "Identificam negócios locais com potencial para adotar sua solução, qualificam pelo score e abordam com contexto.",
              },
              {
                title: "Franqueadoras",
                description:
                  "Monitoram regiões inteiras em busca de empresas com perfil para expansão, comparando bairros e raios de cobertura.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-surface p-5">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>
      <FAQSection />
      <FinalCTA />
    </MarketingPage>
  );
}
