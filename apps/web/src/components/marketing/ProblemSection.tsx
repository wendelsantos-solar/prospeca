import { X, Check } from "lucide-react";
import { Section, SectionHeading } from "./Section";

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
    <Section muted>
      <SectionHeading
        center
        title="Prospectar clientes locais não deveria depender de horas no mapa e planilhas desorganizadas."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Antes do Radar Local</h3>
          <ul className="space-y-3">
            {BEFORE.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-primary/30 bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-primary">Depois do Radar Local</h3>
          <ul className="space-y-3">
            {AFTER.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
