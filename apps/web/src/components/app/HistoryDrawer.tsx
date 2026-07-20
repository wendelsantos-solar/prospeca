import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useLeadsStore } from "@/stores";
import { formatDate, formatNumber } from "@/lib/format";
import { History, RotateCcw, Trash2, Eye } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useNavigate } from "@tanstack/react-router";
import type { Search } from "@/types";
import type { SuggestSearchDetail } from "./SearchForm";
import { toast } from "sonner";

export function HistoryDrawer() {
  const history = useLeadsStore((s) => s.history);
  const removeSearch = useLeadsStore((s) => s.removeSearch);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const rerun = (h: Search) => {
    const detail: SuggestSearchDetail = {
      niche: h.niche === "Todas as categorias" ? "" : h.niche,
      location: h.location,
      lat: h.latitude,
      lng: h.longitude,
      presence: h.presence,
      radiusKm: h.radiusKm,
    };
    window.dispatchEvent(new CustomEvent("suggest-search", { detail }));
    setOpen(false);
    toast.info(`Repetindo busca: ${h.niche} em ${h.location}`);
  };

  const view = (h: Search) => {
    if (currentSearch?.id === h.id) {
      setOpen(false);
      navigate({ to: "/app/mapa" });
      return;
    }
    rerun(h);
    navigate({ to: "/app/mapa" });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start gap-2 w-full text-xs h-8">
          <History className="h-3.5 w-3.5" />
          Buscas anteriores
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Buscas anteriores</SheetTitle>
          <SheetDescription>Histórico das últimas buscas realizadas.</SheetDescription>
        </SheetHeader>
        <div className="p-4 space-y-2">
          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhuma busca ainda"
              description="Faça a primeira busca para começar a construir seu histórico."
            />
          ) : (
            history.map((h) => (
              <div key={h.id} className="rounded-lg border bg-surface p-3 shadow-elegant">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{h.niche}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {h.location} • {h.radiusKm} km •{" "}
                      {h.presence === "no-website"
                        ? "Sem site"
                        : h.presence === "with-website"
                          ? "Com site"
                          : "Todos"}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDate(h.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Repetir busca"
                      onClick={() => rerun(h)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Ver resultados"
                      onClick={() => view(h)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:text-destructive"
                      aria-label="Excluir busca"
                      onClick={() => {
                        removeSearch(h.id);
                        toast.success("Busca removida do histórico");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    <b className="text-foreground tabular-nums">{formatNumber(h.totalFound)}</b>{" "}
                    empresas
                  </span>
                  <span>
                    <b className="text-foreground tabular-nums">{formatNumber(h.contactsFound)}</b>{" "}
                    contatos
                  </span>
                  <span>
                    <b className="text-foreground tabular-nums">
                      {formatNumber(h.addedToPipeline)}
                    </b>{" "}
                    no funil
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
