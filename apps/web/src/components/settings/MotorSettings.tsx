import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RADIUS_OPTIONS, SORT_OPTIONS, type SortValue } from "@/lib/constants";
import type { PresenceFilter } from "@/types";
import { useSettingsStore, useMessageStore } from "@/stores";

const SCORE_RULE_VERSION = "v3.0.0";
const SCORE_CRITERIA = [
  { label: "Sem site", points: 30, reason: "Sem presença digital — alta oportunidade" },
  { label: "Reputação fraca (nota < 3,5)", points: 15, reason: "Oportunidade de melhoria" },
  { label: "Pouca tração (< 20 avaliações)", points: 10, reason: "Baixa presença online" },
  { label: "Telefone válido", points: 20, reason: "Contato direto possível" },
  { label: "WhatsApp", points: 12, reason: "Canal de contato rápido" },
  { label: "E-mail comercial", points: 8, reason: "Canal formal disponível" },
  { label: "Instagram", points: 5, reason: "Presença em rede social" },
  { label: "Até 5 km de distância", points: 8, reason: "Muito próximo" },
  { label: "Até 15 km de distância", points: 4, reason: "Próximo" },
  { label: "Categoria identificada", points: 3, reason: "Segmento conhecido" },
];
const MAX_SCORE = SCORE_CRITERIA.reduce((s, c) => s + c.points, 0);

export function MotorSettings() {
  const settings = useSettingsStore();
  const template = useMessageStore((s) => s.template);
  const setTemplate = useMessageStore((s) => s.setTemplate);

  return (
    <div className="space-y-6">
      {/* ── Padrões de busca ── */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Padrões de busca</div>
          <div className="text-[11.5px] text-muted-foreground">
            Valores iniciais em novas prospecções.
          </div>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Seleção em massa</div>
              <div className="text-[11.5px] text-muted-foreground">
                Máximo de leads selecionáveis.
              </div>
            </div>
            <Input
              type="number"
              min={1}
              max={50}
              value={settings.bulkLimit}
              onChange={(e) =>
                settings.set({ bulkLimit: Math.max(1, Math.min(50, Number(e.target.value) || 10)) })
              }
              className="w-20 text-center"
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Presença digital</div>
              <div className="text-[11.5px] text-muted-foreground">
                Filtro padrão ao iniciar busca.
              </div>
            </div>
            <Select
              value={settings.defaultPresence}
              onValueChange={(v) => settings.set({ defaultPresence: v as PresenceFilter })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-website">Sem site</SelectItem>
                <SelectItem value="with-website">Com site</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Raio padrão</div>
              <div className="text-[11.5px] text-muted-foreground">Distância inicial no mapa.</div>
            </div>
            <Select
              value={String(settings.defaultRadius)}
              onValueChange={(v) => settings.set({ defaultRadius: Number(v) })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Ordenação padrão</div>
              <div className="text-[11.5px] text-muted-foreground">Ordem dos resultados.</div>
            </div>
            <Select
              value={settings.defaultSort}
              onValueChange={(v) => settings.set({ defaultSort: v as SortValue })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Mensagens ── */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Mensagens</div>
          <div className="text-[11.5px] text-muted-foreground">
            Modelo, remetente e assinatura padrão.
          </div>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          <div className="space-y-1.5 px-4 py-3">
            <Label htmlFor="whatsapp-tpl" className="text-[12px]">
              Modelo do WhatsApp
            </Label>
            <Textarea
              id="whatsapp-tpl"
              rows={4}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="resize-none"
              placeholder="Olá {{nome_do_lead}}, tudo bem? Meu nome é {{meu_nome}}..."
            />
            <p className="text-[11px] text-muted-foreground">
              Use{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{{nome_do_lead}}`}</code>{" "}
              e <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{{meu_nome}}`}</code>.
            </p>
          </div>
          <div className="space-y-1.5 px-4 py-3">
            <Label htmlFor="msg-sender" className="text-[12px]">
              Nome do remetente
            </Label>
            <Input
              id="msg-sender"
              placeholder="Como você se apresenta"
              value={settings.senderName}
              onChange={(e) => settings.set({ senderName: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5 px-4 py-3">
            <Label htmlFor="msg-sig" className="text-[12px]">
              Assinatura
            </Label>
            <Textarea
              id="msg-sig"
              rows={2}
              placeholder="Assinatura ao final das mensagens"
              value={settings.signature}
              onChange={(e) => settings.set({ signature: e.target.value })}
              className="resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── Score ── */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Score</div>
          <div className="text-[11.5px] text-muted-foreground">
            Critérios de priorização · regra {SCORE_RULE_VERSION} · máx. {MAX_SCORE} pts
          </div>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {SCORE_CRITERIA.map((c) => {
            const pct = (c.points / MAX_SCORE) * 100;
            return (
              <div key={c.label} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground">{c.label}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/30"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{c.reason}</span>
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">
                  +{c.points}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pesos fixos — configuração por organização em versão futura.
        </p>
      </div>
    </div>
  );
}
