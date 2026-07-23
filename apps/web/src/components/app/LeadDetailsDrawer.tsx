import { useLeadsStore } from "@/stores";
import {
  useLeadDetail,
  useAddNoteMutation,
  useRemoveNoteMutation,
  useUpdateNoteMutation,
  useToggleNotePinMutation,
  useAddActivityMutation,
  useAddToFunnelMutation,
  useSuppressionHashes,
  useSuppressMutation,
} from "@/hooks/useLeadsQuery";
import { suppressionEntriesFor, isContactSuppressed } from "@/lib/suppression";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemperatureBadge, ScoreBadge } from "@/components/shared/Badges";
import { formatBRL, formatDate, formatDateTime, formatDistance, digitsOnly } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/constants";
import { categoryLabel } from "@/lib/category";
import { discoveryToPreviewLead } from "@/lib/discovery-preview";
import { whatsappDisplay } from "@/lib/whatsapp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculateScore, scoreInputFromLead } from "@/lib/score";
import {
  MessageCircle,
  Phone,
  Mail,
  Instagram,
  Globe,
  MapPin,
  Sparkles,
  Info,
  Star,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  PlusCircle,
  Ban,
  Search as SearchIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { ActivityType } from "@/types";

export function LeadDetailsDrawer() {
  const detailsId = useLeadsStore((s) => s.detailsId);
  const setDetails = useLeadsStore((s) => s.setDetails);
  // Discovery preview: a business not yet in the funnel, shown read-only.
  const preview = useLeadsStore((s) => s.preview);
  const setPreview = useLeadsStore((s) => s.setPreview);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const addToFunnel = useAddToFunnelMutation();

  // CRM real — lead data from TanStack Query (Phase 3)
  const { data: queriedLead } = useLeadDetail(detailsId);
  // Fallback: if query hasn't loaded yet, try the Zustand store directly
  const storeLead = useLeadsStore((s) =>
    detailsId ? s.leads.find((l) => l.id === detailsId) : undefined,
  );
  // In readOnly preview mode we render an adapted discovery result — never a
  // persisted lead. detailsId always wins over preview (they're exclusive).
  const previewLead = useMemo(() => (preview ? discoveryToPreviewLead(preview) : null), [preview]);
  const readOnly = !detailsId && !!preview;
  const lead = detailsId ? (queriedLead ?? storeLead) : previewLead;
  const addNoteMut = useAddNoteMutation();
  const removeNoteMut = useRemoveNoteMutation();
  const updateNoteMut = useUpdateNoteMutation();
  const toggleNotePinMut = useToggleNotePinMutation();
  const addActivityMut = useAddActivityMutation();
  const [noteText, setNoteText] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [act, setAct] = useState<{
    type: ActivityType;
    title: string;
    date: string;
    time: string;
    note: string;
    priority: "low" | "medium" | "high";
  }>({
    type: "call",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    note: "",
    priority: "medium",
  });

  // Keep Sheet mounted during fetch to avoid overlay flicker
  const isLoading = detailsId != null && !lead;

  const breakdown = lead ? calculateScore(scoreInputFromLead(lead)).items : [];
  const insights: { icon: string; text: string; level: "high" | "med" | "low" }[] = lead
    ? [
        ...(!lead.hasWebsite
          ? [
              {
                icon: "🌐",
                text: "Empresa sem site — alta oportunidade de abordagem",
                level: "high" as const,
              },
            ]
          : []),
        ...((lead.rating ?? 0) >= 4.5
          ? [{ icon: "⭐", text: "Excelentes avaliações", level: "med" as const }]
          : []),
        ...(lead.whatsapp
          ? [{ icon: "💬", text: "WhatsApp encontrado — contato direto", level: "high" as const }]
          : []),
        ...(!lead.instagram
          ? [
              {
                icon: "📷",
                text: "Sem Instagram — presença social incompleta",
                level: "med" as const,
              },
            ]
          : []),
        ...(lead.temperature === "hot"
          ? [{ icon: "🔥", text: "Lead quente — priorize o contato", level: "high" as const }]
          : []),
      ]
    : [];

  const { data: suppressed } = useSuppressionHashes();
  const suppressMut = useSuppressMutation();

  const openWhats = async () => {
    if (!lead) return;
    const num = digitsOnly(lead.whatsapp ?? lead.phone);
    if (!num) return toast.error("Sem WhatsApp/telefone");
    if (suppressed && (await isContactSuppressed(suppressed, lead))) {
      return toast.error("Contato em opt-out — não contatar (LGPD).");
    }
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const handleSuppress = async () => {
    if (!lead) return;
    const entries = await suppressionEntriesFor({
      phone: lead.phone,
      email: lead.email,
      reason: "opt-out manual",
    });
    if (!entries.length) return toast.error("Sem telefone/e-mail para suprimir.");
    suppressMut.mutate(entries, {
      onSuccess: () => toast.success("Marcado como não contatar (opt-out)."),
      onError: () => toast.error("Falha ao suprimir."),
    });
  };

  return (
    <Sheet
      open={!!detailsId || !!preview}
      onOpenChange={(v) => {
        if (!v) {
          setDetails(null);
          setPreview(null);
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {isLoading ? (
          <>
            <SheetTitle className="sr-only">Carregando lead…</SheetTitle>
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : lead ? (
          <>
            <div className="border-b p-5">
              <SheetHeader className="p-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-lg">{lead.companyName}</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground">
                      {categoryLabel(lead.category)} • {lead.neighborhood ?? ""} • {lead.city},{" "}
                      {lead.state}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <TemperatureBadge temperature={lead.temperature} />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-semibold"
                          aria-label="Composição do score"
                        >
                          <ScoreBadge score={lead.score} />
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72">
                        <p className="mb-2 text-xs font-semibold">Composição do score</p>
                        <div className="space-y-1.5">
                          {breakdown.map((b, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 text-xs">
                              <div>
                                <p className="font-medium">{b.label}</p>
                                <p className="text-muted-foreground text-[11px]">{b.reason}</p>
                              </div>
                              <span className="font-mono font-semibold text-primary">
                                +{b.points}
                              </span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {readOnly && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!currentSearch || !preview) return;
                      addToFunnel.mutate(
                        { searchId: currentSearch.id, placeId: preview.placeId, stage: "new" },
                        {
                          onSuccess: () => {
                            toast.success("Adicionado ao funil");
                            setPreview(null);
                          },
                        },
                      );
                    }}
                    disabled={addToFunnel.isPending}
                    className="gap-1.5"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Funil
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={openWhats}
                  variant={readOnly ? "outline" : "default"}
                  className="gap-1.5"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                {(lead.phone || lead.email) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={handleSuppress}
                    disabled={suppressMut.isPending}
                    title="Marcar como não contatar (LGPD opt-out)"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Não contatar
                  </Button>
                )}
                {lead.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => window.open(`tel:${lead.phone}`)}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Ligar
                  </Button>
                )}
                {lead.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => window.open(`mailto:${lead.email}`)}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    E-mail
                  </Button>
                )}
                {lead.instagram && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      window.open(
                        `https://instagram.com/${lead.instagram!.replace("@", "")}`,
                        "_blank",
                      )
                    }
                  >
                    <Instagram className="h-3.5 w-3.5" />
                    Instagram
                  </Button>
                )}
                {lead.website && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => window.open(lead.website, "_blank")}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Site
                  </Button>
                )}
              </div>
            </div>

            <Tabs defaultValue="info" className="p-5">
              <TabsList>
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="insights">Oportunidade</TabsTrigger>
                <TabsTrigger value="notes">Notas ({lead.notes.length})</TabsTrigger>
                <TabsTrigger value="activities">Atividades</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3 mt-4">
                <InfoRow icon={MapPin} label="Endereço">
                  {readOnly
                    ? "—"
                    : `${lead.address}, ${lead.neighborhood ?? ""}, ${lead.city} - ${lead.state}`}
                </InfoRow>
                <InfoRow icon={Phone} label="Telefone">
                  {lead.phone ?? "—"}
                </InfoRow>
                <InfoRow icon={MessageCircle} label="WhatsApp">
                  {(() => {
                    const wa = whatsappDisplay(lead.whatsapp, lead.phone);
                    if (!wa) return "—";
                    return (
                      <>
                        {wa.value}
                        {wa.probable && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(provável)</span>
                        )}
                      </>
                    );
                  })()}
                </InfoRow>
                <InfoRow icon={Mail} label="E-mail">
                  {lead.email ?? "—"}
                </InfoRow>
                <InfoRow icon={Instagram} label="Instagram">
                  {lead.instagram ?? "—"}
                </InfoRow>
                <InfoRow icon={Globe} label="Website">
                  {lead.website ?? "—"}
                </InfoRow>
                <InfoRow icon={Star} label="Nota / Avaliações">
                  {lead.rating?.toFixed(1) ?? "—"} ({lead.reviewCount ?? 0})
                </InfoRow>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MiniStat label="Distância" value={formatDistance(lead.distanceKm)} />
                  <MiniStat
                    label="Estágio"
                    value={readOnly ? "— (não no funil)" : STAGE_LABELS[lead.stage]}
                  />
                  <MiniStat label="Valor estimado" value={formatBRL(lead.estimatedValue)} />
                  <MiniStat
                    label="Descoberto em"
                    value={readOnly ? "—" : formatDate(lead.discoveredAt)}
                  />
                </div>
                {lead.openingHours && (
                  <div className="rounded-md border p-3 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">Horário de funcionamento</p>
                    {lead.openingHours.map((h) => (
                      <p key={h}>{h}</p>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="insights" className="space-y-2 mt-4">
                {insights.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum insight destacado.</p>
                )}
                {insights.map((i, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border bg-surface p-3"
                  >
                    <span className="text-lg">{i.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm">{i.text}</p>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${i.level === "high" ? "bg-hot/15 text-hot" : i.level === "med" ? "bg-warm/20 text-warm-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {i.level === "high"
                          ? "Alto impacto"
                          : i.level === "med"
                            ? "Médio impacto"
                            : "Baixo impacto"}
                      </span>
                    </div>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 mt-4">
                {readOnly ? (
                  <FunnelGate feature="notas" />
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Textarea
                        rows={2}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Adicionar uma nota..."
                      />
                      <Button
                        onClick={() => {
                          if (!noteText.trim()) return;
                          addNoteMut.mutate({
                            leadId: lead.id,
                            input: { content: noteText.trim() },
                          });
                          setNoteText("");
                          toast.success("Nota adicionada");
                        }}
                      >
                        Salvar
                      </Button>
                    </div>
                    {lead.notes.length > 1 && (
                      <div className="relative">
                        <SearchIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="h-8 pl-7 text-xs"
                          placeholder="Pesquisar notas..."
                          value={noteSearch}
                          onChange={(e) => setNoteSearch(e.target.value)}
                          aria-label="Pesquisar notas"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      {lead.notes.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
                      )}
                      {[...lead.notes]
                        .filter(
                          (n) =>
                            !noteSearch ||
                            n.content.toLowerCase().includes(noteSearch.toLowerCase()),
                        )
                        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
                        .map((n) => (
                          <div
                            key={n.id}
                            className={`rounded-md border bg-surface p-3 ${n.pinned ? "border-primary/50" : ""}`}
                          >
                            {editingNoteId === n.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  rows={2}
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      if (editingText.trim()) {
                                        updateNoteMut.mutate({
                                          leadId: lead.id,
                                          noteId: n.id,
                                          content: editingText.trim(),
                                        });
                                        toast.success("Nota atualizada");
                                      }
                                      setEditingNoteId(null);
                                    }}
                                  >
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => setEditingNoteId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>
                                    {formatDateTime(n.createdAt)}
                                    {n.updatedAt ? " • editada" : ""}
                                    {n.pinned ? " • fixada" : ""}
                                  </span>
                                  <div className="flex gap-1.5">
                                    <button
                                      aria-label={n.pinned ? "Desafixar nota" : "Fixar nota"}
                                      className="hover:text-foreground"
                                      onClick={() =>
                                        toggleNotePinMut.mutate({ leadId: lead.id, noteId: n.id })
                                      }
                                    >
                                      {n.pinned ? (
                                        <PinOff className="h-3 w-3" />
                                      ) : (
                                        <Pin className="h-3 w-3" />
                                      )}
                                    </button>
                                    <button
                                      aria-label="Editar nota"
                                      className="hover:text-foreground"
                                      onClick={() => {
                                        setEditingNoteId(n.id);
                                        setEditingText(n.content);
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      aria-label="Excluir nota"
                                      className="hover:text-destructive"
                                      onClick={() => {
                                        removeNoteMut.mutate({ leadId: lead.id, noteId: n.id });
                                        toast.success("Nota excluída");
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-3 mt-4">
                {readOnly ? (
                  <FunnelGate feature="atividades" />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={act.type}
                          onValueChange={(v) => setAct({ ...act, type: v as ActivityType })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              ["call", "Ligação"],
                              ["message", "Mensagem"],
                              ["meeting", "Reunião"],
                              ["followup", "Retorno"],
                              ["proposal", "Proposta"],
                              ["visit", "Visita"],
                              ["other", "Outra"],
                            ].map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Data</Label>
                        <Input
                          type="date"
                          className="h-8"
                          value={act.date}
                          onChange={(e) => setAct({ ...act, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Horário</Label>
                        <Input
                          type="time"
                          className="h-8"
                          value={act.time}
                          onChange={(e) => setAct({ ...act, time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Prioridade</Label>
                        <Select
                          value={act.priority}
                          onValueChange={(v) =>
                            setAct({ ...act, priority: v as typeof act.priority })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Título</Label>
                        <Input
                          className="h-8"
                          value={act.title}
                          onChange={(e) => setAct({ ...act, title: e.target.value })}
                          placeholder="Ex.: Retorno inicial"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Observação</Label>
                        <Textarea
                          rows={2}
                          value={act.note}
                          onChange={(e) => setAct({ ...act, note: e.target.value })}
                          placeholder="Detalhes da atividade (opcional)"
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!act.title.trim()) return toast.error("Informe um título");
                            addActivityMut.mutate({
                              leadId: lead.id,
                              input: {
                                type: act.type,
                                title: act.title,
                                date: act.date,
                                time: act.time || undefined,
                                note: act.note || undefined,
                                priority: act.priority,
                              },
                            });
                            setAct({ ...act, title: "", time: "", note: "" });
                            toast.success("Atividade criada");
                          }}
                        >
                          Criar atividade
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {lead.activities.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma atividade agendada.</p>
                      )}
                      {lead.activities.map((a) => (
                        <div key={a.id} className="rounded-md border bg-surface p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{a.title}</p>
                            {a.priority && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${a.priority === "high" ? "bg-hot/15 text-hot" : a.priority === "medium" ? "bg-warm/20 text-warm-foreground" : "bg-muted text-muted-foreground"}`}
                              >
                                {a.priority === "high"
                                  ? "Alta"
                                  : a.priority === "medium"
                                    ? "Média"
                                    : "Baixa"}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {a.type} • {formatDate(a.date)}
                            {a.time ? ` às ${a.time}` : ""}
                          </p>
                          {a.note && <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {readOnly ? (
                  <FunnelGate feature="timeline" />
                ) : (
                  <ol className="space-y-3">
                    {lead.timeline.map((t) => (
                      <li key={t.id} className="flex gap-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="text-sm">{t.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(t.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <SheetTitle className="sr-only">Lead não encontrado</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-foreground">{children}</p>
      </div>
    </div>
  );
}

/** Empty state for lead-only tabs when previewing a business not yet in the
 * funnel. The header's "+ Funil" button converts it. */
function FunnelGate({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
      <PlusCircle className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Adicione ao funil para gerenciar {feature}.</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-surface p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
