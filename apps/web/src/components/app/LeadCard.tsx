import { memo } from "react";
import type { Lead } from "@/types";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TemperatureBadge, ScoreBadge } from "@/components/shared/Badges";
import { formatDistance, formatBRL, formatRelative, formatDate, digitsOnly } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/constants";
import {
  MessageCircle,
  Phone,
  Instagram,
  Mail,
  Globe,
  GlobeLock,
  Star,
  MapPin,
  MoreVertical,
  ExternalLink,
  CalendarClock,
  Crosshair,
  PlusCircle,
} from "lucide-react";
import { useLeadsStore, useSettingsStore } from "@/stores";
import { useMoveLeadMutation, useRemoveLeadMutation } from "@/hooks/useLeadsQuery";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Props {
  lead: Lead;
  bulk?: boolean;
  compact?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export const LeadCard = memo(function LeadCard({
  lead,
  bulk,
  compact,
  isSelected: isSelectedProp,
  isFocused: isFocusedProp,
}: Props) {
  const setFocused = useLeadsStore((s) => s.setFocused);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const toggleSelect = useLeadsStore((s) => s.toggleSelect);
  const setPendingWin = useLeadsStore((s) => s.setPendingWin);
  const setPendingDiscard = useLeadsStore((s) => s.setPendingDiscard);
  const bulkLimit = useSettingsStore((s) => s.bulkLimit);

  // Fallback to store if props not provided (backward compat)
  const storeSelectedIds = useLeadsStore((s) => (isSelectedProp == null ? s.selectedIds : null));
  const storeFocusedId = useLeadsStore((s) => (isFocusedProp == null ? s.focusedId : null));
  const isSelected = isSelectedProp ?? storeSelectedIds?.includes(lead.id) ?? false;
  const isFocused = isFocusedProp ?? storeFocusedId === lead.id;

  const moveMutation = useMoveLeadMutation();
  const removeLeadMut = useRemoveLeadMutation();
  const navigate = useNavigate();

  const openWhats = () => {
    const num = digitsOnly(lead.whatsapp ?? lead.phone);
    if (!num) return toast.error("Sem WhatsApp/telefone");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const centerOnMap = () => {
    setFocused(lead.id);
    navigate({ to: "/app/mapa" });
  };

  const onToggleSelect = () => {
    const result = toggleSelect(lead.id, bulkLimit);
    if (result === "limit") toast.warning(`Limite de ${bulkLimit} leads selecionados atingido`);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <Card
      onClick={() => setFocused(lead.id)}
      className={cn(
        "lead-list-item group relative cursor-pointer border-border/70 shadow-elegant transition-all hover:border-primary/50 hover:shadow-elevated",
        isFocused && "border-info ring-1 ring-info/40",
        compact ? "p-2.5" : "p-3",
      )}
    >
      <div className="flex items-start gap-2">
        {bulk && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Selecionar ${lead.companyName}`}
            className="mt-0.5"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3
                  className={cn(
                    "truncate font-semibold text-foreground",
                    compact ? "text-[13px]" : "text-sm",
                  )}
                >
                  {lead.companyName}
                </h3>
                {lead.hasWebsite ? (
                  <Globe
                    className="h-3 w-3 text-muted-foreground/60 shrink-0"
                    aria-label="Com site"
                  />
                ) : (
                  <GlobeLock className="h-3 w-3 text-hot shrink-0" aria-label="Sem site" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{lead.category}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <TemperatureBadge temperature={lead.temperature} size="xs" />
              <ScoreBadge score={lead.score} />
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{lead.neighborhood ?? lead.city}</span>
            <span>•</span>
            <span className="tabular-nums">{formatDistance(lead.distanceKm)}</span>
            {lead.rating != null && (
              <>
                <span>•</span>
                <Star className="h-3 w-3 fill-warm text-warm" />
                <span className="tabular-nums font-medium text-foreground">
                  {lead.rating.toFixed(1)}
                </span>
                <span>({lead.reviewCount})</span>
              </>
            )}
          </div>

          {!compact && lead.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
              <Phone className="h-3 w-3" />
              {lead.phone}
            </p>
          )}

          {!compact && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                {lead.whatsapp && (
                  <MessageCircle
                    className="h-3.5 w-3.5 text-success"
                    aria-label="WhatsApp disponível"
                  />
                )}
                {lead.phone && <Phone className="h-3.5 w-3.5" aria-label="Telefone disponível" />}
                {lead.instagram && (
                  <Instagram className="h-3.5 w-3.5" aria-label="Instagram disponível" />
                )}
                {lead.email && <Mail className="h-3.5 w-3.5" aria-label="E-mail disponível" />}
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {STAGE_LABELS[lead.stage]}
                </span>
                {lead.estimatedValue != null && (
                  <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground tabular-nums">
                    {formatBRL(lead.estimatedValue)}
                  </span>
                )}
              </div>
            </div>
          )}

          {!compact && lead.nextActivity && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-info">
              <CalendarClock className="h-3 w-3" />
              {lead.nextActivity.title} — {formatDate(lead.nextActivity.date)}
            </p>
          )}

          {lead.lastInteractionAt && !compact && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Última interação: {formatRelative(lead.lastInteractionAt)}
            </p>
          )}

          {!compact && (
            <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openWhats();
                }}
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetails(lead.id);
                }}
              >
                <ExternalLink className="h-3 w-3" /> Detalhes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                aria-label="Centralizar no mapa"
                onClick={(e) => {
                  e.stopPropagation();
                  centerOnMap();
                }}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </Button>
              {lead.stage === "new" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  aria-label="Adicionar ao funil"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveMutation.mutate({ id: lead.id, input: { toStage: "qualified" } });
                    toast.success("Lead adicionado ao funil como Qualificado");
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      aria-label="Mais opções"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => {
                        moveMutation.mutate({ id: lead.id, input: { toStage: "new" } });
                        toast.success("Movido para Novo");
                      }}
                    >
                      Mover para Novo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        moveMutation.mutate({ id: lead.id, input: { toStage: "qualified" } });
                        toast.success("Movido para Qualificado");
                      }}
                    >
                      Mover para Qualificado
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        moveMutation.mutate({ id: lead.id, input: { toStage: "contacted" } });
                        toast.success("Marcado como Contatado");
                      }}
                    >
                      Marcar como Contatado
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPendingWin(lead.id)}>
                      Marcar como Ganho
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setPendingDiscard(lead.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      Descartar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDetails(lead.id)}>
                      Adicionar nota
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDetails(lead.id)}>
                      Criar atividade
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {lead.phone && (
                      <DropdownMenuItem onClick={() => copy(lead.phone!, "Telefone")}>
                        Copiar telefone
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => copy(`${lead.address}, ${lead.city}`, "Endereço")}
                    >
                      Copiar endereço
                    </DropdownMenuItem>
                    {lead.email && (
                      <DropdownMenuItem onClick={() => copy(lead.email!, "E-mail")}>
                        Copiar e-mail
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        window.open(
                          `https://www.openstreetmap.org/?mlat=${lead.latitude}&mlon=${lead.longitude}#map=17/${lead.latitude}/${lead.longitude}`,
                          "_blank",
                        )
                      }
                    >
                      Abrir localização
                    </DropdownMenuItem>
                    {lead.instagram && (
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://instagram.com/${lead.instagram!.replace("@", "")}`,
                            "_blank",
                          )
                        }
                      >
                        Abrir Instagram
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        removeLeadMut.mutate(lead.id);
                        toast.success("Lead removido da lista");
                      }}
                    >
                      Remover da lista
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});
