import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  Globe,
  Star,
  Flame,
  Users,
  MessageCircle,
  Calendar,
  FileText,
  Trophy,
  Wallet,
} from "lucide-react";
import type { ValueProof } from "@/lib/value-proof";
import { valueProofSummary } from "@/lib/value-proof";
import { formatBRL } from "@/lib/format";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** "Prova de valor" — um resumo real, fundamentado nos números do funil, que o
 * profissional pode mostrar a um prospecto (ou copiar) para justificar o próprio
 * serviço. Nenhum número estimado: só o que de fato foi mapeado e feito.
 * Fase 4.2: recebe o ValueProof já mapeado do bloco `allTime` da
 * get_dashboard_overview (servidor, carteira inteira) — não agrega arrays. */
export function ValueProofView({ vp: inputVp }: { vp: ValueProof }) {
  const vp = useMemo(() => inputVp, [inputVp]);
  const summary = useMemo(() => valueProofSummary(vp), [vp]);
  const [copied, setCopied] = useState(false);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success("Resumo copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar — selecione o texto manualmente.");
    }
  }

  if (vp.totalFound === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Ainda não há dados para provar valor"
        description="Faça buscas e mova leads pelo funil. Aqui você vai encontrar um resumo real, pronto para mostrar."
      />
    );
  }

  const market = [
    { icon: Building2, label: "Negócios mapeados", value: vp.totalFound },
    { icon: Globe, label: "Sem site próprio", value: vp.withoutWebsite },
    { icon: Star, label: "Sem avaliações", value: vp.noReviews },
    { icon: Star, label: "Nota abaixo de 4,0", value: vp.lowRating },
    { icon: Flame, label: "Oportunidades quentes", value: vp.hot },
  ];

  const funnel = [
    { icon: Users, label: "Contatados", value: vp.contacted },
    { icon: MessageCircle, label: "Respostas", value: vp.responded },
    { icon: Calendar, label: "Reuniões", value: vp.meetings },
    { icon: FileText, label: "Propostas", value: vp.proposals },
    { icon: Trophy, label: "Ganhos", value: vp.won },
    { icon: Wallet, label: "Receita", value: formatBRL(vp.revenue) },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold">Prova de valor</h2>
        <p className="text-[12.5px] text-muted-foreground">
          Números reais do seu funil, prontos para mostrar — sem promessa, só o que aconteceu.
        </p>
      </div>

      {/* Resumo copiável */}
      <div className="rounded-xl border border-primary/30 bg-primary-subtle p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14px] leading-relaxed text-foreground">{summary}</p>
          <Button
            size="sm"
            onClick={copySummary}
            className="shrink-0 gap-1.5"
            variant={copied ? "outline" : "default"}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar resumo"}
          </Button>
        </div>
        {vp.cities.length > 0 && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Cidades no funil: {vp.cities.join(", ")}
          </p>
        )}
      </div>

      {/* Mercado */}
      <div>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          O que encontramos
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {market.map((m) => (
            <MetricCard key={m.label} icon={m.icon} label={m.label} value={m.value} />
          ))}
        </div>
      </div>

      {/* Funil */}
      <div>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          O que já fizemos
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {funnel.map((f) => (
            <MetricCard key={f.label} icon={f.icon} label={f.label} value={f.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-none tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
