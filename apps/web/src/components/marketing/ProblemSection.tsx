import { X, Check } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";

const BEFORE = [
  "Procurar empresas manualmente no mapa",
  "Abrir dezenas de perfis um por um",
  "Copiar telefones e sites à mão",
  "Conferir se cada empresa já tem site",
  "Perder leads em abas e anotações soltas",
  "Esquecer de retornar contatos",
  "Não saber quem priorizar primeiro",
  "Abordar sem contexto nenhum",
];
const AFTER = [
  "Buscar por nicho, cidade e raio em segundos",
  "Ver todas as empresas já organizadas numa lista",
  "Telefone, WhatsApp e site já extraídos",
  "Score mostra quem não tem site de cara",
  "Tudo centralizado no Pipeline",
  "Atividades e retornos com data e lembrete",
  "Score explica por que priorizar cada empresa",
  "Mensagem pronta com os dados do lead",
];

export function ProblemSection() {
  return (
    <MarketingSection muted spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          center
          eyebrow="O problema"
          title={
            <>
              Pare de garimpar leads
              <br />
              no mapa e na planilha
            </>
          }
          description="Horas perdidas procurando empresas uma por uma, copiando dados à mão e sem saber por onde começar. Isso acaba aqui."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="grid h-6 w-6 place-items-center rounded bg-destructive-soft text-destructive">
                <X className="h-3.5 w-3.5" />
              </span>
              Antes da Prospeca
            </h3>
            <ul className="space-y-3">
              {BEFORE.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-primary/20 bg-surface p-6">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="grid h-6 w-6 place-items-center rounded bg-primary-soft text-primary">
                <Check className="h-3.5 w-3.5" />
              </span>
              Com a Prospeca
            </h3>
            <ul className="space-y-3">
              {AFTER.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
