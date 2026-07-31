import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingSection,
  MarketingContainer,
  Eyebrow,
} from "@/components/marketing/MarketingLayout";
import { SalesContactForm } from "@/components/marketing/SalesContactForm";
import { Button } from "@/components/ui/button";
import { MessageCircle, HelpCircle, Briefcase } from "lucide-react";

export const Route = createFileRoute("/contato/")({
  head: () => ({
    meta: [
      { title: "Contato — Radar Local" },
      {
        name: "description",
        content:
          "Entre em contato com o Radar Local. Dúvidas sobre planos, funcionalidades ou suporte comercial.",
      },
      { property: "og:title", content: "Contato — Radar Local" },
    ],
    links: [{ rel: "canonical", href: "/contato" }],
  }),
  component: ContatoPage,
});

const CONTACT_OPTIONS = [
  {
    icon: MessageCircle,
    title: "Falar com vendas",
    description:
      "Tem dúvidas sobre planos, recursos ou precisa de um plano personalizado para sua equipe?",
    action: "open-sales-form",
  },
  {
    icon: HelpCircle,
    title: "Suporte",
    description: "Já é cliente? Acesse a central de ajuda ou entre em contato pelo aplicativo.",
    action: "login",
  },
  {
    icon: Briefcase,
    title: "Parcerias",
    description: "Tem interesse em parcerias, integrações ou indicações? Adoramos conversar.",
    action: "open-sales-form",
  },
];

function ContatoPage() {
  return (
    <MarketingPage>
      <MarketingSection spacing="sm" className="pt-24 md:pt-28">
        <MarketingContainer width="narrow">
          <div className="text-center">
            <Eyebrow>Contato</Eyebrow>
            <h1 className="text-[2rem] leading-tight font-semibold tracking-tight text-foreground md:text-[2.5rem]">
              Como podemos ajudar?
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Escolha o canal abaixo e responderemos o mais rápido possível.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {CONTACT_OPTIONS.map((opt) => (
              <div
                key={opt.title}
                className="rounded-xl border border-border bg-surface p-5 text-center"
              >
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2 text-primary">
                  <opt.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{opt.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{opt.description}</p>
                <div className="mt-4">
                  {opt.action === "login" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/login">Acessar conta</Link>
                    </Button>
                  ) : (
                    <SalesContactForm
                      source="contact_page"
                      trigger={
                        <Button size="sm" variant="outline">
                          Enviar mensagem
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingPage>
  );
}
