import { lazy, Suspense, useState, useMemo } from "react";
import { useLeadsStore } from "@/stores";
import {
  useLeadDetail,
  useAddNoteMutation,
  useRemoveNoteMutation,
  useUpdateNoteMutation,
  useToggleNotePinMutation,
  useAddToFunnelMutation,
  useRemoveLeadMutation,
  useSuppressMutation,
  useRecordContactMutation,
  useOrganizationMembers,
  useAssignLeadMutation,
  useBusinessRegistration,
  useAddActivityMutation,
} from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";
import { suppressionEntriesFor } from "@/lib/suppression";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanyIntelligenceCard, SignalEvidenceChips } from "./CompanyIntelligenceCard";
import { IntentSignals } from "./IntentSignals";
import { BusinessRegistrySection } from "./BusinessRegistrySection";
import { CompanyTimeline } from "./CompanyTimeline";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { formatBRL, formatDate, formatDateTime, formatDistance } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/constants";
import { categoryLabel } from "@/lib/category";
import { discoveryToPreviewLead } from "@/lib/discovery-preview";
import {
  enrichmentDisplayFor,
  type EnrichmentFieldKey,
  isProvisionalScore,
  resolveEnrichmentStatus,
} from "@/lib/enrichment";
import { whatsappDisplay } from "@/lib/whatsapp";
import { hasRealWebsite, deriveIntentSignals } from "@leads/domain";
import { NbaCard } from "@/components/app/NbaCard";
import { PrepareMessageDialog } from "@/components/app/PrepareMessageDialog";
import { DiagnosticReportDialog } from "@/components/app/DiagnosticReportDialog";
import { EnrichmentStatusBadge } from "@/components/app/EnrichmentStatusBadge";
import { ScoreRing, TemperaturePill, TEMP_META } from "@/components/shared/Badges";
import { useCompanyIntelligence } from "@/hooks/useCompanyIntelligence";
import {
  MessageCircle,
  Phone,
  Mail,
  Instagram,
  Globe,
  MapPin,
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
  FileText,
  UserRound,
  MoreHorizontal,
  Share2,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { ContactOutcome, Lead, DisplayLead } from "@/types";
import { cn } from "@/lib/utils";

// Lazy tab — only downloaded when the user clicks "Atividades".
const LeadActivitiesTab = lazy(() =>
  import("./LeadActivitiesTab").then((m) => ({ default: m.LeadActivitiesTab })),
);

/** Conteúdo do detalhe de empresa — renderizável tanto no painel
 * persistente (CompanyDetailPanel, xl+) quanto no Sheet (mobile/notebook).
 * Toda a lógica (dados, tabs, ações, enrichment progressivo) vive AQUI. */
export function CompanyDetailContent({
  onClose,
  autoFocusClose = false,
}: {
  onClose?: () => void;
  /** Painel persistente (não-modal): foca o botão fechar ao abrir, compensando
   * a ausência do focus trap do Sheet. */
  autoFocusClose?: boolean;
}) {
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

  const [noteText, setNoteText] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Removing from the pipeline is destructive, so the button asks once first.
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Keep Sheet mounted during fetch to avoid overlay flicker
  const isLoading = detailsId != null && !lead;

  const suppressMut = useSuppressMutation();
  const removeLeadMut = useRemoveLeadMutation();
  const membersQ = useOrganizationMembers();
  const assignMut = useAssignLeadMutation();
  const addActivityMut = useAddActivityMutation();
  const { openWhatsApp } = useOutbound();

  const openWhats = () => {
    if (!lead) return;
    void openWhatsApp(lead);
  };

  // 'Criar tarefa de contato' — atividade followup REAL via createActivity
  // (mesma mutation do 'Nova atividade' da aba Atividades). Semântica: a
  // 'tarefa' do mockup é um follow-up de contato agendado para hoje.
  const createContactTask = () => {
    if (!lead) return;
    const today = new Date().toISOString().slice(0, 10);
    addActivityMut.mutate(
      {
        leadId: lead.id,
        input: {
          type: "followup",
          title: `Contatar ${lead.companyName}`,
          date: today,
          time: "09:00",
          priority: "medium",
        },
      },
      {
        onSuccess: () => toast.success("Tarefa de contato criada."),
        onError: () => toast.error("Não foi possível criar a tarefa."),
      },
    );
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

  if (!detailsId && !preview) return null;

  const close = () => {
    setDetails(null);
    setPreview(null);
    onClose?.();
  };

  const addToFunnelClick = (stage: "new" | "contacted" = "new") => {
    if (!currentSearch || !preview) return;
    addToFunnel.mutate(
      { searchId: currentSearch.id, placeId: preview.placeId, stage },
      {
        onSuccess: () => {
          toast.success("Adicionado ao funil");
          setPreview(null);
        },
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {isLoading ? (
        <DetailSkeleton />
      ) : lead ? (
        <>
          {/* ── HEADER: score em anel | nome | categoria • bairro, cidade | temperatura ── */}
          <div className="border-b p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ScoreRing score={lead.score} temperature={lead.temperature} />
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-bold leading-tight text-foreground">
                    {lead.companyName}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="truncate">{categoryLabel(lead.category)}</span>
                    {[lead.neighborhood, lead.city].filter(Boolean).join(", ") && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate">
                          {[lead.neighborhood, lead.city].filter(Boolean).join(", ")}
                        </span>
                      </>
                    )}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {isProvisionalScore(lead.enrichmentState) && (
                      <span className="text-[10.5px] text-muted-foreground">score provisório</span>
                    )}
                  </div>
                  <p className="sr-only">
                    Score {lead.score} de 100 · temperatura {TEMP_META[lead.temperature].label}
                  </p>
                </div>
              </div>
              <div className={cn("flex items-center gap-1.5", !onClose && "pr-6")}>
                <TemperaturePill temperature={lead.temperature} />
                {onClose && (
                  <button
                    onClick={close}
                    autoFocus={autoFocusClose}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    aria-label="Fechar detalhe da empresa"
                    title="Fechar detalhe"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── LINHA DE AÇÕES: primárias + "Mais" ── */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {readOnly && (
                <div className="inline-flex items-center overflow-hidden rounded-md bg-primary text-primary-foreground">
                  <ActionBtn
                    primary
                    onClick={() => addToFunnelClick("new")}
                    disabled={addToFunnel.isPending}
                    className="rounded-none"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Adicionar ao funil
                  </ActionBtn>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Escolher estágio de entrada no funil"
                        title="Estágio de entrada"
                        className="grid h-full w-7 shrink-0 place-items-center border-l border-primary-foreground/25 hover:bg-primary-hover"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => addToFunnelClick("new")}>
                        Adicionar como novo
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => addToFunnelClick("contacted")}>
                        Adicionar como já contatado
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
              <DropdownMenu onOpenChange={(o) => !o && setConfirmRemove(false)}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-caption font-medium text-foreground transition-colors hover:border-border-strong"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    Mais
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setPrepareOpen(true)}>
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    Preparar mensagem
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Relatório (PDF)
                  </DropdownMenuItem>
                  {!readOnly && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={removeLeadMut.isPending}
                        onSelect={(e) => {
                          // Duas etapas dentro do menu (destrutivo): primeiro
                          // clique pede confirmação, segundo executa.
                          e.preventDefault();
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
                        className={cn(
                          "text-destructive focus:text-destructive",
                          confirmRemove && "font-semibold",
                        )}
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                        {confirmRemove ? "Confirmar remoção" : "Remover do pipeline"}
                      </DropdownMenuItem>
                      {(lead.phone || lead.email) && (
                        <DropdownMenuItem
                          onSelect={() => void handleSuppress()}
                          disabled={suppressMut.isPending}
                        >
                          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                          Não contatar
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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

          <DiagnosticReportDialog
            lead={lead}
            open={reportOpen}
            onClose={() => setReportOpen(false)}
          />

          <Tabs defaultValue="info" className="p-4">
            <TabsList className="grid h-10 w-full grid-cols-5">
              <TabsTrigger value="info">Visão geral</TabsTrigger>
              <TabsTrigger value="opportunity">Oportunidade</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
              <TabsTrigger value="activities">Atividades</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            {/* ── TAB OPORTUNIDADE: o detalhamento do score (POR QUE 84) ── */}
            <TabsContent value="opportunity" className="mt-4">
              {isFeatureEnabled("discoveryV2") && (
                <CompanyIntelligenceCard lead={lead} showNba={false} />
              )}
              {!readOnly && <ContactOutcomeBar lead={lead} />}
              <OpportunitySummaryCard lead={lead} />
            </TabsContent>

            {/* ── VISÃO GERAL: cards compactos 2x2 + por quê + NBA ── */}
            <TabsContent value="info" className="mt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ContactCard lead={lead} readOnly={readOnly} openWhats={openWhats} />
                <ReputationCard lead={lead} />
                <PresenceCard lead={lead} />
                <CompanyDataCard lead={lead} />
                {!readOnly && (
                  <CommercialCard lead={lead} membersQ={membersQ} assignMut={assignMut} />
                )}
              </div>

              {/* Por que é uma oportunidade — sinais reais, zero frase decorativa */}
              <section className="mt-3 rounded-xl border border-border bg-surface p-3">
                <h4 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Por que é uma oportunidade
                </h4>
                <div className="mt-2">
                  <IntentSignals lead={lead} />
                  {!hasIntentSignals(lead) && (
                    <p className="text-[12px] text-muted-foreground">
                      Nenhum sinal de intenção identificado com os dados atuais. Os sinais aparecem
                      conforme o enriquecimento avança.
                    </p>
                  )}
                </div>
              </section>

              {/* Próxima melhor ação — engine real, só ações que existem */}
              <section className="mt-3">
                <h4 className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Próxima melhor ação
                </h4>
                {readOnly ? (
                  <div className="rounded-xl border border-primary/15 bg-primary-subtle p-3.5">
                    <p className="text-[12.5px] font-medium text-foreground">
                      Adicione ao pipeline para ativar o acompanhamento.
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      A próxima melhor ação usa o estágio e o histórico do funil.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => addToFunnelClick()}
                        disabled={addToFunnel.isPending}
                      >
                        <PlusCircle className="mr-1 h-3.5 w-3.5" />
                        Adicionar ao pipeline
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPrepareOpen(true)}>
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        Enviar mensagem sugerida
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <NbaCard lead={lead} />
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPrepareOpen(true)}>
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        Enviar mensagem sugerida
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={createContactTask}
                        disabled={addActivityMut.isPending}
                      >
                        <CalendarCheck className="mr-1 h-3.5 w-3.5" />
                        Criar tarefa de contato
                      </Button>
                    </div>
                  </>
                )}
              </section>

              {lead.openingHours && lead.openingHours.length > 0 && (
                <InfoCard title="Horário de funcionamento" className="mb-4">
                  <ul className="space-y-0.5">
                    {lead.openingHours.map((h) => (
                      <li key={h} className="flex items-center gap-1.5 text-[12px]">
                        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </InfoCard>
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
                          !noteSearch || n.content.toLowerCase().includes(noteSearch.toLowerCase()),
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

            <TabsContent value="activities" className="mt-4">
              <Suspense
                fallback={
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando…
                  </div>
                }
              >
                <LeadActivitiesTab lead={lead} readOnly={readOnly} />
              </Suspense>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              {readOnly ? (
                <FunnelGate feature="timeline" />
              ) : lead.placeId ? (
                <CompanyTimeline placeId={lead.placeId} fallback={lead.timeline} />
              ) : (
                <ol className="space-y-3">
                  {lead.timeline.map((t) => (
                    <li key={t.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm">{t.label}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(t.at)}</p>
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
          <h2 className="sr-only">Lead não encontrado</h2>
          <p className="sr-only">Não foi possível localizar os detalhes desta oportunidade.</p>
        </>
      )}
    </div>
  );
}

// ── Cards da Visão geral ──────────────────────────────────────────────────

/** Card compacto do grid 2x2 — título pequeno, conteúdo denso. */
function InfoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-3", className)}>
      <h4 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Campo compacto: rótulo pequeno em cima, valor embaixo (truncado). Estados
 * honestos de enriquecimento via emptyLabel/emptyTone (mesmo modelo do
 * EnrichmentStatusBadge). */
function MiniField({
  icon: Icon,
  label,
  children,
  emptyLabel = "Não encontrado",
  emptyTone = "muted",
}: {
  icon: React.ElementType;
  label: string;
  children?: React.ReactNode;
  emptyLabel?: string;
  emptyTone?: "muted" | "info" | "error";
}) {
  const empty = children == null || children === "";
  const emptyClass =
    emptyTone === "info"
      ? "text-primary/80"
      : emptyTone === "error"
        ? "text-destructive/80"
        : "text-subtle-foreground";
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </p>
      <div className="mt-0.5 truncate text-[12px] text-foreground">
        {empty ? <span className={emptyClass}>{emptyLabel}</span> : children}
      </div>
    </div>
  );
}

/** CONTATO — estados honestos: "não encontrado" ≠ "ainda não verificado".
 * WhatsApp usa os estados reais de whatsappDisplay (nunca trata fixo como
 * WhatsApp). "Ver todos os contatos" expande com o cadastro público. */
function ContactCard({
  lead,
  readOnly,
  openWhats,
}: {
  lead: DisplayLead;
  readOnly: boolean;
  openWhats: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const registryEnabled = isFeatureEnabled("cnaeIntelligenceEnabled") && !!lead.placeId;
  const {
    data: registration,
    isLoading: registryLoading,
    isError: registryError,
  } = useBusinessRegistration(registryEnabled ? lead.placeId : null);
  const wa = whatsappDisplay(lead.whatsapp, lead.phone);
  const registryHasContact = !!(registration?.registry_email || registration?.registry_phone);

  return (
    <InfoCard title="Contato">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <MiniField icon={Phone} label="Telefone">
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className="hover:text-primary hover:underline">
              {lead.phone}
            </a>
          ) : undefined}
        </MiniField>
        <MiniField
          icon={MessageCircle}
          label="WhatsApp"
          emptyLabel={wa ? undefined : lead.phone ? "Fixo — sem WhatsApp" : undefined}
          {...enrichmentEmpty(lead, "whatsapp", !!wa)}
        >
          {wa ? (
            <button
              type="button"
              onClick={openWhats}
              className="truncate hover:text-primary hover:underline"
            >
              {wa.value}
              {/* Fase 6: NENHUMA origem é verificada — as duas são qualificadas.
               * Antes o número raspado saía sem rótulo e lia-se como confirmado. */}
              <span className="ml-1 text-[10px] text-muted-foreground">
                {wa.source === "site" ? "(do site)" : "(provável)"}
              </span>
            </button>
          ) : undefined}
        </MiniField>
        <MiniField icon={Mail} label="E-mail" {...enrichmentEmpty(lead, "email", !!lead.email)}>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="hover:text-primary hover:underline">
              {lead.email}
            </a>
          ) : undefined}
        </MiniField>
        <MiniField
          icon={Instagram}
          label="Instagram"
          {...enrichmentEmpty(lead, "instagram", !!lead.instagram)}
        >
          {lead.instagram ? (
            <a
              href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary hover:underline"
            >
              {lead.instagram}
            </a>
          ) : undefined}
        </MiniField>
      </div>

      {registryEnabled && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", showAll && "rotate-180")} />
          Ver todos os contatos
        </button>
      )}
      {showAll && (
        <div className="mt-2 rounded-lg border border-border/60 bg-surface-2/40 p-2.5">
          {registryLoading ? (
            <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Consultando cadastro público…
            </p>
          ) : registryError ? (
            <p className="text-[11.5px] text-muted-foreground">
              Cadastro público indisponível no momento — os demais dados não são afetados.
            </p>
          ) : registryHasContact ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <MiniField icon={Mail} label="E-mail (registro)">
                {registration?.registry_email ? (
                  <a
                    href={`mailto:${registration.registry_email}`}
                    className="hover:text-primary hover:underline"
                  >
                    {registration.registry_email}
                  </a>
                ) : undefined}
              </MiniField>
              <MiniField icon={Phone} label="Telefone (registro)">
                {registration?.registry_phone ? (
                  <a
                    href={`tel:${registration.registry_phone}`}
                    className="hover:text-primary hover:underline"
                  >
                    {registration.registry_phone}
                  </a>
                ) : undefined}
              </MiniField>
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">
              Cadastro público sem contatos adicionais.
            </p>
          )}
        </div>
      )}
      {readOnly && (
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          Contatos completos após adicionar ao funil.
        </p>
      )}
    </InfoCard>
  );
}

/** REPUTAÇÃO — rating real + sinais REAIS com severidade/confiança/fonte.
 * Nunca frases inventadas ("Atendimento excelente" não existe). */
function ReputationCard({ lead }: { lead: DisplayLead }) {
  const { evidence } = useCompanyIntelligence(lead);
  const reputationSignals = evidence.filter((e) =>
    ["HIGH_RATING", "LOW_REVIEW_COUNT", "WEAK_REPUTATION"].includes(e.signal),
  );

  return (
    <InfoCard title="Reputação">
      <div className="flex items-baseline gap-2">
        {lead.rating != null ? (
          <>
            <span className="font-mono text-[20px] font-bold tabular-nums leading-none text-foreground">
              {lead.rating.toFixed(1)}
            </span>
            <Star className="h-4 w-4 fill-warning text-warning" aria-hidden />
            <span className="text-[11.5px] text-muted-foreground">
              {lead.reviewCount ?? 0} avaliações
            </span>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground">Ainda sem avaliações persistidas.</p>
        )}
      </div>
      <div className="mt-2">
        {reputationSignals.length > 0 ? (
          <SignalEvidenceChips evidence={reputationSignals} />
        ) : (
          <p className="text-[11.5px] text-muted-foreground">
            Sem sinais de reputação com os dados atuais.
          </p>
        )}
      </div>
    </InfoCard>
  );
}

/** PRESENÇA DIGITAL — derivada dos dados reais. Sem "GMB sem perfil" (decisão
 * 4); no lugar de timestamp fake, o ESTADO DE ENRICHMENT real (decisão 5). */
function PresenceCard({ lead }: { lead: DisplayLead }) {
  const socialCount = [!!lead.instagram, !!lead.whatsapp].filter(Boolean).length;
  const socialLabel =
    socialCount === 2 ? "Ativas" : socialCount === 1 ? "Parciais" : "Não encontradas";
  const enrichmentStatus = resolveEnrichmentStatus(null, lead.enrichmentState);
  const wa = whatsappDisplay(lead.whatsapp, lead.phone);

  return (
    <InfoCard title="Presença digital">
      <div className="space-y-2.5">
        <div>
          <p className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
            <Share2 className="h-3 w-3" aria-hidden />
            Redes sociais
          </p>
          <p className="mt-0.5 text-[12px] text-foreground">
            <span className="font-medium">{socialLabel}</span>
            {lead.instagram && (
              <span className="text-muted-foreground"> · @{lead.instagram.replace("@", "")}</span>
            )}
            {wa && (
              <span className="text-muted-foreground">
                {" "}
                · WhatsApp{wa.source === "site" ? " (do site)" : " (provável)"}
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
            <Globe className="h-3 w-3" aria-hidden />
            Site
          </p>
          <p className="mt-0.5 truncate text-[12px] text-foreground">
            {hasRealWebsite(lead.website) ? (
              <a
                href={lead.website ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary hover:underline"
              >
                {lead.website}
              </a>
            ) : (
              <span className="text-subtle-foreground">Não possui site</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-medium text-muted-foreground">
            Estado do enriquecimento
          </p>
          <div className="mt-1">
            {enrichmentStatus ? (
              <EnrichmentStatusBadge state={enrichmentStatus} />
            ) : (
              <span className="rounded-full border border-primary/30 bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                enriquecido
              </span>
            )}
          </div>
        </div>
      </div>
    </InfoCard>
  );
}

/** DADOS DA EMPRESA — endereço/distância + cadastro público completo (CNAE,
 * razão social, situação, porte, capital, abertura, Simples, MEI). O cadastro
 * carrega SOZINHO (progressive) — nunca bloqueia o painel. */
function CompanyDataCard({ lead }: { lead: DisplayLead }) {
  const addressText = [lead.address, lead.neighborhood].filter(Boolean).join(", ");
  const hasCoords = Boolean(lead.latitude && lead.longitude);

  return (
    <InfoCard title="Dados da empresa">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div className="col-span-2">
          <MiniField icon={MapPin} label="Endereço">
            {addressText ? (
              addressText
            ) : hasCoords ? (
              <a
                href={`https://www.google.com/maps?q=${lead.latitude},${lead.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary hover:underline"
              >
                Ver no mapa
              </a>
            ) : undefined}
          </MiniField>
        </div>
        <MiniField icon={Navigation} label="Distância">
          {lead.distanceKm != null ? formatDistance(lead.distanceKm) : undefined}
        </MiniField>
        <MiniField icon={Building2} label="Cidade">
          {[lead.city, lead.state].filter(Boolean).join(" - ") || undefined}
        </MiniField>
      </div>
      {isFeatureEnabled("cnaeIntelligenceEnabled") && lead.placeId && (
        <div className="mt-2">
          <BusinessRegistrySection placeId={lead.placeId} hasWebsite={lead.hasWebsite} />
        </div>
      )}
    </InfoCard>
  );
}

/** COMERCIAL — dados operacionais do funil (só leads, nunca preview). */
function CommercialCard({
  lead,
  membersQ,
  assignMut,
}: {
  lead: DisplayLead;
  membersQ: ReturnType<typeof useOrganizationMembers>;
  assignMut: ReturnType<typeof useAssignLeadMutation>;
}) {
  return (
    <InfoCard title="Comercial">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <MiniField icon={GitBranch} label="Estágio">
          {STAGE_LABELS[lead.stage]}
        </MiniField>
        <MiniField icon={Banknote} label="Valor estimado">
          {lead.estimatedValue != null ? formatBRL(lead.estimatedValue) : undefined}
        </MiniField>
        <MiniField icon={CalendarDays} label="Descoberto em">
          {lead.discoveredAt ? formatDate(lead.discoveredAt) : undefined}
        </MiniField>
      </div>
      <div className="mt-2.5 border-t border-border/60 pt-2">
        <span className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
          <UserRound className="h-3 w-3" /> Responsável
        </span>
        <Select
          value={lead.assignedTo ?? "none"}
          onValueChange={(v) =>
            assignMut.mutate(
              { leadId: lead.id, userId: v === "none" ? null : v },
              {
                onSuccess: () => toast.success("Responsável atualizado"),
                onError: () => toast.error("Não foi possível atribuir"),
              },
            )
          }
        >
          <SelectTrigger className="mt-1 h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">
              Sem responsável
            </SelectItem>
            {(membersQ.data ?? []).map((m) => (
              <SelectItem key={m.userId} value={m.userId} className="text-xs">
                {m.fullName ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </InfoCard>
  );
}

/** True quando há pelo menos um sinal de intenção derivado (mesma regra do
 * IntentSignals — empty state honesto no card "Por que é uma oportunidade"). */
function hasIntentSignals(lead: DisplayLead): boolean {
  return (
    deriveIntentSignals({
      hasWebsite: lead.hasWebsite,
      enrichmentState: lead.enrichmentState,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      instagram: lead.instagram,
      whatsapp: lead.whatsapp,
    }).length > 0
  );
}

/** Skeleton do painel enquanto o lead carrega — estrutura, não spinner global. */
function DetailSkeleton() {
  return (
    <div className="p-4" aria-busy="true">
      <h2 className="sr-only">Carregando lead…</h2>
      <p className="sr-only">Os detalhes da oportunidade estão sendo carregados.</p>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="space-y-1.5">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
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

/**
 * Resolve the empty-state props for an enrichment contact field, so the drawer
 * says "Ainda não verificado" instead of "Não encontrado" when the field simply
 * hasn't been checked yet.
 */
function enrichmentEmpty(
  lead: DisplayLead,
  field: EnrichmentFieldKey,
  hasValue: boolean,
): { emptyLabel?: string; emptyTone: "muted" | "info" | "error" } {
  const d = enrichmentDisplayFor(field, hasValue, lead.enrichmentState, lead.enrichmentFields);
  if (d.kind === "value") return { emptyTone: "muted" };
  return { emptyLabel: d.label, emptyTone: d.tone };
}

/** Styled action button matching the reference design. Purely presentational
 * — every button keeps its own onClick/disabled/title passed through. */
function ActionBtn({
  children,
  onClick,
  primary,
  disabled,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const cls = primary
    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
    : "border border-border bg-surface text-foreground hover:border-border-strong";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-caption font-medium transition-colors disabled:opacity-50 ${cls} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** "Resumo da oportunidade" card — shown in both funnel and readOnly preview
 * modes, derived purely from lead fields (no mutations). */
function OpportunitySummaryCard({ lead }: { lead: DisplayLead }) {
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
        Score <b>{lead.score}</b>
        {isProvisionalScore(lead.enrichmentState) && (
          <span className="text-micro text-muted-foreground"> (provisório)</span>
        )}
        . Empresa {lead.hasWebsite ? "com" : "sem"} presença online,{" "}
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

function ContactOutcomeBar({ lead }: { lead: DisplayLead }) {
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
