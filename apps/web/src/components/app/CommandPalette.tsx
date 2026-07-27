import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Map as MapIcon,
  Sunrise,
  Kanban,
  CalendarDays,
  BarChart3,
  ShieldCheck,
  Settings,
  History,
  Search,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useSearchDraftStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { NICHES } from "@/lib/constants";

interface Destination {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
}

const DESTINATIONS: Destination[] = [
  { to: "/app/mapa", label: "Mapa", icon: MapIcon, keywords: "buscar descobrir empresas" },
  { to: "/app/hoje", label: "Hoje", icon: Sunrise, keywords: "tarefas atividades" },
  { to: "/app/kanban", label: "Pipeline", icon: Kanban, keywords: "funil kanban negocios" },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays, keywords: "calendario" },
  { to: "/app/painel", label: "Análises", icon: BarChart3, keywords: "metricas dashboard" },
  { to: "/app/historico", label: "Histórico de buscas", icon: History, keywords: "buscas" },
  {
    to: "/app/configuracoes",
    label: "Configurações",
    icon: Settings,
    keywords: "ajustes preferencias",
  },
];

/** Global command palette (⌘K). Two jobs: jump to any page, and start a niche
 * search. Picking a niche runs the search immediately when a location is already
 * set; otherwise it fills the niche and opens the Mapa so the user adds a place. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const isPlatformAdmin = useIsPlatformAdmin();
  const [query, setQuery] = useState("");

  const destinations = useMemo(
    () =>
      isPlatformAdmin
        ? [
            ...DESTINATIONS,
            {
              to: "/app/admin",
              label: "Administração",
              icon: ShieldCheck,
              keywords: "usuarios org",
            },
          ]
        : DESTINATIONS,
    [isPlatformAdmin],
  );

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  const goTo = (to: string) => {
    close();
    navigate({ to });
  };

  const searchNiche = (niche: string) => {
    const value = niche.trim();
    if (!value) return;
    close();
    const draft = useSearchDraftStore.getState().draft;
    navigate({ to: "/app/mapa" });
    const hasLocation = draft.location.trim().length > 0 && !!draft.coords;
    if (hasLocation) {
      // Location already chosen — run the search right away.
      useSearchSession.getState().suggestSearch({
        niche: value,
        location: draft.location,
        lat: draft.coords.lat,
        lng: draft.coords.lng,
        presence: draft.presence,
        radiusKm: draft.radiusKm,
      });
    } else {
      // No place yet — fill the niche and open the search field to continue.
      useSearchDraftStore.getState().setDraft({ niche: value });
      useSearchSession.getState().focusNiche();
    }
  };

  const trimmed = query.trim();
  const isKnownNiche = NICHES.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  return (
    <CommandDialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <CommandInput placeholder="Buscar páginas, nichos…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {trimmed.length > 0 && !isKnownNiche && (
          <CommandGroup heading="Buscar empresas">
            <CommandItem value={`buscar ${trimmed}`} onSelect={() => searchNiche(trimmed)}>
              <Search />
              <span>
                Buscar “<span className="font-medium text-foreground">{trimmed}</span>”
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Ir para">
          {destinations.map((d) => {
            const Icon = d.icon;
            return (
              <CommandItem
                key={d.to}
                value={`${d.label} ${d.keywords ?? ""}`}
                onSelect={() => goTo(d.to)}
              >
                <Icon />
                <span>{d.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 opacity-0 data-[selected=true]:opacity-40" />
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Buscar por nicho">
          {NICHES.map((niche) => (
            <CommandItem key={niche} value={`nicho ${niche}`} onSelect={() => searchNiche(niche)}>
              <Search />
              <span>{niche}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
