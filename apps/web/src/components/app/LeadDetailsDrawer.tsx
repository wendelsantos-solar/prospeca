import { useRouterState } from "@tanstack/react-router";
import { useLeadsStore } from "@/stores";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CompanyDetailContent } from "./CompanyDetailContent";

/**
 * Detalhe de empresa como Sheet (overlay) — container MOBILE/NOTEBOOK.
 *
 * Em telas grandes (>=1280) NA ROTA DE DESCOBERTA o detalhe é renderizado no
 * painel persistente `CompanyDetailPanel` (app.mapa.tsx); aqui o Sheet se
 * suprime para não duplicar. Nas demais rotas (Kanban, Hoje, Painel…) o
 * comportamento histórico é preservado: o Sheet abre em qualquer largura.
 *
 * Todo o conteúdo (tabs, ações, enrichment progressivo, notas) vive em
 * `CompanyDetailContent`, renderizável nos dois containers.
 */
export function LeadDetailsDrawer() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isXl = useMediaQuery("(min-width: 1280px)");
  const onDiscovery = pathname === "/app/mapa";
  const detailsId = useLeadsStore((s) => s.detailsId);
  const preview = useLeadsStore((s) => s.preview);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const setPreview = useLeadsStore((s) => s.setPreview);

  // Na descoberta em telas grandes quem renderiza é o painel persistente.
  if (onDiscovery && isXl) return null;

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
        <SheetTitle className="sr-only">Detalhes da empresa</SheetTitle>
        <SheetDescription className="sr-only">
          Informações, oportunidade e ações desta empresa.
        </SheetDescription>
        {/* O X nativo do SheetContent segue responsável por fechar o overlay. */}
        <CompanyDetailContent />
      </SheetContent>
    </Sheet>
  );
}
