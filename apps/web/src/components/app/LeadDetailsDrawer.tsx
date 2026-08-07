import { useLeadsStore } from "@/stores";
import {
  useLeadDetail,
  useAddNoteMutation,
  useRemoveNoteMutation,
  useUpdateNoteMutation,
  useToggleNotePinMutation,
  useAddActivityMutation,
  useAddToFunnelMutation,
  useRemoveLeadMutation,
  useSuppressMutation,
  useRecordContactMutation,
} from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";
import { suppressionEntriesFor } from "@/lib/suppression";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScorePill } from "@/components/shared/Badges";
import { formatBRL, formatDate, formatDateTime, formatDistance } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/constants";
import { categoryLabel } from "@/lib/category";
import { discoveryToPreviewLead } from "@/lib/discovery-preview";
import { whatsappDisplay } from "@/lib/whatsapp";
import { hasRealWebsite } from "@leads/domain";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NbaCard } from "@/components/app/NbaCard";
import { PrepareMessageDialog } from "@/components/app/PrepareMessageDialog";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import {
  MessageCircle,
  Phone,
  Mail,
  Instagram,
  Globe,
  MapPin,
  Info,
  Star,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  PlusCircle,
  MinusCircle,
  Ban,
  Navigation,
  Building2,
  Clock,
  CalendarDays,
  Banknote,
  GitBranch,
  Search as SearchIcon,
  TrendingUp,
  MessageSquareReply,
  PhoneMissed,
  CalendarCheck,
  FileCheck2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { LoaderCircle } from "lucide-react";
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
import type { ActivityType, ContactOutcome, Lead } from "@/types";

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
  const [prepareOpen, setPrepareOpen] = useState(false);
  // Removing from the pipeline is destructive, so the button asks once first.
  const [confirmRemove, setConfirmRemove] = useState(false);
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

  // Score breakdown comes from the DB (single source of truth — C3).
  const breakdown = lead?.scoreBreakdown?.items ?? [];

  const suppressMut = useSuppressMutation();
  const removeLeadMut = useRemoveLeadMutation();
  const { openWhatsApp } = useOutbound();

  const openWhats = () => {
    if (!lead) return;
    void openWhatsApp(lead);
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
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {isLoading ? (
          <>
            <SheetTitle className="sr-only">Carregando lead…</SheetTitle>
            <SheetDescription className="sr-only">
              Os detalhes da oportunidade estão sendo carregados.
            </SheetDescription>
            <div className="flex items-center justify-center h-64">
              <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : lead ? (
          <>
            <div className="border-b p-5">
              <SheetHeader className="p-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-[13px] font-bold text-primary"
                      aria-hidden
                    >
                      {leadInitials(lead.companyName)}
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-[17px] font-bold leading-tight">
                        {lead.companyName}
                      </SheetTitle>
                      <SheetDescription className="text-[13px] text-muted-foreground">
                        {[
                          categoryLabel(lead.category).toLowerCase(),
                          [lead.neighborhood, lead.city].filter(Boolean).join(", "),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </SheetDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pr-6">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="cursor-pointer rounded-full"
                          aria-label="Composição do score"
                        >
                          <ScorePill score={lead.score} temperature={lead.temperature} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72">
                        <p className="mb-2 flex items-center gap-1 text-xs font-semibold">
                          <Info className="h-3 w-3 text-muted-foreground" />
                          Composição do score
                        </p>
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
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {readOnly && (
                  <ActionBtn
                    primary
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
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Adicionar ao funil
                  </ActionBtn>
                )}
                <ActionBtn primary={!readOnly} onClick={openWhats}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </ActionBtn>
                {lead.phone && (
                  <ActionBtn onClick={() => window.open(`tel:${lead.phone}`)}>
                    <Phone className="h-3.5 w-3.5" />
                    Ligar
                  </ActionBtn>
                )}
                <ActionBtn onClick={() => setPrepareOpen(true)}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  Preparar mensagem
                </ActionBtn>
                {!readOnly && (
                  <ActionBtn
                    tone={confirmRemove ? "danger" : undefined}
                    disabled={removeLeadMut.isPending}
                    title="Remover este lead do pipeline"
                    onClick={() => {
                      if (!confirmRemove) return setConfirmRemove(true);
                      removeLeadMut.mutate(lead.id, {
                        onSuccess: () => {
                          toast.success("Removido do pipeline");
                          setConfirmRemove(false);
                          setDetails(null);
                        },
                        onError: () => toast.error("Falha ao remover."),
                      });
                    }}
                  >
                    <MinusCircle className="h-3.5 w-3.5" />
                    {confirmRemove ? "Confirmar remoção" : "Remover do pipeline"}
                  </ActionBtn>
                )}
                {(lead.phone || lead.email) && (
                  <ActionBtn
                    tone="danger"
                    onClick={handleSuppress}
                    disabled={suppressMut.isPending}
                    title="Marcar como não contatar (LGPD opt-out)"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Não contatar
                  </ActionBtn>
                )}
              </div>
            </div>

            <PrepareMessageDialog
              lead={lead}
              open={prepareOpen}
              onOpenChange={setPrepareOpen}
              materialize={
                readOnly && currentSearch && preview
                  ? { searchId: currentSearch.id, placeId: preview.placeId }
                  : undefined
              }
            />

            <Tabs defaultValue="info" className="p-5">
              <TabsList className="grid h-10 w-full grid-cols-5">
                <TabsTrigger value="info">Visão geral</TabsTrigger>
                <TabsTrigger value="opportunity">Oportunidade</TabsTrigger>
                <TabsTrigger value="notes">Notas</TabsTrigger>
                <TabsTrigger value="activities">Atividades</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="opportunity" className="mt-4">
                {!readOnly && <NbaCard lead={lead} />}
                {!readOnly && <ContactOutcomeBar lead={lead} />}
                <OpportunitySummaryCard lead={lead} />
              </TabsContent>

              <TabsContent value="info" className="mt-4">
                <Section title="Contato">
                  <DataRow
                    icon={Phone}
                    label="Telefone"
                    value={lead.phone}
                    href={lead.phone ? `tel:${lead.phone}` : undefined}
                  />
                  <DataRow
                    icon={MessageCircle}
                    label="WhatsApp"
                    value={(() => {
                      const wa = whatsappDisplay(lead.whatsapp, lead.phone);
                      if (!wa) return null;
                      return (
                        <>
                          {wa.value}
                          {wa.probable && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              (provável)
                            </span>
                          )}
                        </>
                      );
                    })()}
                    onClick={openWhats}
                  />
                  <DataRow
                    icon={Mail}
                    label="E-mail"
                    value={lead.email}
                    href={lead.email ? `mailto:${lead.email}` : undefined}
                  />
                  <DataRow
                    icon={Globe}
                    label="Site"
                    value={hasRealWebsite(lead.website) ? lead.website : undefined}
                    href={hasRealWebsite(lead.website) ? lead.website : undefined}
                    external
                  />
                  <DataRow
                    icon={Instagram}
                    label="Instagram"
                    value={lead.instagram}
                    href={
                      lead.instagram
                        ? `https://instagram.com/${lead.instagram.replace("@", "")}`
                        : undefined
                    }
                    external
                  />
                </Section>

                <Section title="Localização">
                  {(() => {
                    const addressText = [lead.address, lead.neighborhood]
                      .filter(Boolean)
                      .join(", ");
                    if (addressText) {
                      return <DataRow icon={MapPin} label="Endereço" value={addressText} />;
                    }
                    // No formatted address from Google — fall back to the pin
                    // location we do have, rather than a bare "Não encontrado".
                    const hasCoords = Boolean(lead.latitude && lead.longitude);
                    return (
                      <DataRow
                        icon={MapPin}
                        label="Endereço"
                        value={hasCoords ? "Ver no mapa" : undefined}
                        href={
                          hasCoords
                            ? `https://www.google.com/maps?q=${lead.latitude},${lead.longitude}`
                            : undefined
                        }
                        external
                      />
                    );
                  })()}
                  <DataRow
                    icon={Navigation}
                    label="Distância"
                    value={formatDistance(lead.distanceKm)}
                  />
                  <DataRow
                    icon={Building2}
                    label="Cidade"
                    value={[lead.city, lead.state].filter(Boolean).join(" - ")}
                  />
                </Section>

                <Section title="Reputação">
                  <DataRow
                    icon={Star}
                    label="Avaliação"
                    value={lead.rating != null ? `${lead.rating.toFixed(1)} ★` : null}
                  />
                  <DataRow
                    icon={Star}
                    label="Avaliações"
                    value={lead.reviewCount != null ? String(lead.reviewCount) : null}
                  />
                </Section>

                <Section title="Comercial">
                  <DataRow
                    icon={GitBranch}
                    label="Estágio"
                    value={readOnly ? "Não está no funil" : STAGE_LABELS[lead.stage]}
                  />
                  <DataRow
                    icon={Banknote}
                    label="Valor estimado"
                    value={lead.estimatedValue != null ? formatBRL(lead.estimatedValue) : null}
                  />
                  <DataRow
                    icon={CalendarDays}
                    label="Descoberto em"
                    value={readOnly ? null : formatDate(lead.discoveredAt)}
                  />
                </Section>

                {lead.openingHours && lead.openingHours.length > 0 && (
                  <Section title="Horário de funcionamento">
                    {lead.openingHours.map((h) => (
                      <DataRow key={h} icon={Clock} label="" value={h} />
                    ))}
                  </Section>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 mt-4">
                {readOnly ? (
                  <FunnelGate feature="notas" />
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Textarea
                        className="bg-surface"
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
                          className="h-8 bg-surface pl-7 text-xs"
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
                          <SelectTrigger className="h-8 bg-surface">
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
                          className="h-8 bg-surface"
                          value={act.date}
                          onChange={(e) => setAct({ ...act, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Horário</Label>
                        <Input
                          type="time"
                          className="h-8 bg-surface"
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
                          <SelectTrigger className="h-8 bg-surface">
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
                          className="h-8 bg-surface"
                          value={act.title}
                          onChange={(e) => setAct({ ...act, title: e.target.value })}
                          placeholder="Ex.: Retorno inicial"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Observação</Label>
                        <Textarea
                          className="bg-surface"
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
          <>
            <SheetTitle className="sr-only">Lead não encontrado</SheetTitle>
            <SheetDescription className="sr-only">
              Não foi possível localizar os detalhes desta oportunidade.
            </SheetDescription>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Uppercase-titled group of `DataRow`s — CONTATO, LOCALIZAÇÃO, etc. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h4 className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
        {title}
      </h4>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {children}
      </div>
    </section>
  );
}

/**
 * One label/value line. A missing value renders the "Não encontrado"
 * placeholder instead of an empty cell; `href`/`onClick` make the value
 * actionable (the drawer header no longer carries e-mail/site/Instagram
 * buttons — the value itself is the link).
 */
function DataRow({
  icon: Icon,
  label,
  value,
  href,
  external,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value?: React.ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const empty = value == null || value === "";
  const body = empty ? (
    <span className="text-subtle-foreground">Não encontrado</span>
  ) : href ? (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="truncate hover:text-primary hover:underline"
    >
      {value}
    </a>
  ) : onClick ? (
    <button type="button" onClick={onClick} className="truncate hover:text-primary hover:underline">
      {value}
    </button>
  ) : (
    <span className="truncate">{value}</span>
  );

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {label && <span className="w-[108px] shrink-0 text-muted-foreground">{label}</span>}
      <div className="flex min-w-0 flex-1 items-center text-foreground">{body}</div>
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

/** Initials avatar for the drawer header — first letters of the first two
 * words of the company name (e.g. "Padaria São José" → "PS"). */
function leadInitials(companyName: string): string {
  return companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Styled action button matching the reference design. Purely presentational
 * — every button keeps its own onClick/disabled/title passed through. */
function ActionBtn({
  children,
  onClick,
  primary,
  tone,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  tone?: "danger";
  disabled?: boolean;
  title?: string;
}) {
  const cls = primary
    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
    : tone === "danger"
      ? "border border-border bg-surface text-muted-foreground hover:border-destructive/40 hover:text-destructive"
      : "border border-border bg-surface text-foreground hover:border-border-strong";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-caption font-medium transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

/** "Resumo da oportunidade" card — shown in both funnel and readOnly preview
 * modes, derived purely from lead fields (no mutations). */
function OpportunitySummaryCard({ lead }: { lead: Lead }) {
  const reviewCount = lead.reviewCount ?? 0;
  const rating = lead.rating;
  const scoreItems = lead.scoreBreakdown?.items.filter((item) => item.points > 0) ?? [];
  return (
    <div className="mb-4 rounded-xl border border-border bg-primary-subtle p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="text-micro font-semibold uppercase tracking-wide text-primary">
          Resumo da oportunidade
        </span>
      </div>
      <p className="text-body-sm text-foreground">
        Score <b>{lead.score}</b>. Empresa {lead.hasWebsite ? "com" : "sem"} presença online,{" "}
        {reviewCount > 100 ? "alta" : "baixa"} visibilidade em avaliações (
        {rating?.toFixed(1) ?? "—"}★ · {reviewCount} reviews) e localização em{" "}
        {lead.neighborhood ?? lead.city}.
      </p>
      {scoreItems.length > 0 && (
        <div className="mt-3 rounded-lg border border-primary/15 bg-surface p-3">
          <p className="text-micro font-semibold uppercase tracking-wide text-primary">
            Por que está priorizada
          </p>
          <div className="mt-2 space-y-2">
            {scoreItems.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-caption font-medium text-foreground">{item.label}</p>
                  <p className="text-micro text-muted-foreground">{item.reason}</p>
                </div>
                <span className="shrink-0 rounded bg-primary-soft px-1.5 py-0.5 text-micro font-semibold tabular-nums text-primary">
                  +{item.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
        <StrengthBlock
          title="Pontos fortes"
          items={[
            rating != null
              ? rating >= 4.5
                ? "Reputação excelente"
                : rating >= 4
                  ? "Boa reputação"
                  : "Reputação em construção"
              : "Reputação ainda sem avaliações",
            lead.whatsapp ? "Contato via WhatsApp disponível" : "Telefone comercial ativo",
            reviewCount > 100 ? "Volume relevante de reviews" : "Base emergente",
          ]}
        />
        <StrengthBlock
          title="Oportunidades"
          negative
          items={[
            !lead.hasWebsite ? "Não tem site (alta oportunidade)" : null,
            !lead.email ? "E-mail não localizado" : null,
            !lead.instagram ? "Sem Instagram mapeado" : null,
          ].filter((v): v is string => !!v)}
        />
      </div>
    </div>
  );
}

const OUTCOME_ACTIONS: Array<{
  outcome: ContactOutcome;
  label: string;
  icon: React.ElementType;
}> = [
  { outcome: "answered", label: "Resposta recebida", icon: MessageSquareReply },
  { outcome: "no_answer", label: "Sem resposta", icon: PhoneMissed },
  { outcome: "meeting", label: "Reunião marcada", icon: CalendarCheck },
  { outcome: "proposal", label: "Proposta enviada", icon: FileCheck2 },
];

function ContactOutcomeBar({ lead }: { lead: Lead }) {
  const mutation = useRecordContactMutation();
  const channel = lead.whatsapp ? "whatsapp" : lead.phone ? "call" : "email";

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4">
      <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
        Registrar resultado real
      </p>
      <p className="mt-1 text-caption text-muted-foreground">
        Use somente depois que a ação acontecer. Isso encerra lembretes quando houver resposta.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OUTCOME_ACTIONS.map(({ outcome, label, icon: Icon }) => (
          <Button
            key={outcome}
            size="sm"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                {
                  leadId: lead.id,
                  input: {
                    channel,
                    title: label,
                    outcome,
                    occurredAt: new Date().toISOString(),
                  },
                },
                {
                  onSuccess: () => toast.success("Resultado comercial registrado."),
                  onError: () => toast.error("Não foi possível registrar o resultado."),
                },
              )
            }
          >
            <Icon className="mr-1 h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function StrengthBlock({
  title,
  items,
  negative,
}: {
  title: string;
  items: string[];
  negative?: boolean;
}) {
  return (
    <div className="rounded-md bg-surface p-2.5">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1 text-[11.5px] text-foreground">
            <span
              className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${negative ? "bg-warning" : "bg-primary"}`}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
