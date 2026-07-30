import { MessageCircle, Check } from "lucide-react";
import { Section, SectionHeading } from "./Section";

const HIGHLIGHTS = [
  "Variáveis preenchidas com dados reais do lead",
  "Modelos salvos, reutilizáveis a qualquer hora",
  "Pré-visualização antes de enviar",
  "Aviso quando um campo do lead está ausente",
  "Você revisa e confirma — o envio é sempre seu",
];

export function MessagingSection() {
  return (
    <Section muted>
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Mensagens"
            title="Abordagens personalizadas sem começar do zero."
          />
          <ul className="mt-5 space-y-2.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {h}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-primary" /> Pré-visualização WhatsApp
          </div>
          <div className="rounded-lg bg-surface-2 p-3 text-sm text-foreground">
            Oi, {"{nome_contato}"}! Vi que a {"{empresa}"} ainda não tem site — trabalho com isso na
            região e queria entender se faz sentido pra vocês. Posso te mandar uns exemplos?
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Você confirma e envia pelo seu WhatsApp — nada sai sem sua revisão.
          </p>
        </div>
      </div>
    </Section>
  );
}
