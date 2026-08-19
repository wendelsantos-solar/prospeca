import { lazy, Suspense, useEffect, useRef } from "react";
import { useLeadsStore } from "@/stores";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LoaderCircle } from "lucide-react";

// Conteúdo preguiçoso — não infla o bundle da rota de descoberta (mesma
// estratégia do LeadDetailsDrawer lazy em app.tsx).
const CompanyDetailContent = lazy(() =>
  import("./CompanyDetailContent").then((m) => ({ default: m.CompanyDetailContent })),
);

/**
 * Painel direito PERSISTENTE do detalhe de empresa (Fase 2 — Layout Shell).
 *
 * Container do CompanyDetailContent em telas grandes (>=1280) na rota de
 * descoberta. Em telas menores o mesmo conteúdo é renderizado no Sheet
 * (LeadDetailsDrawer), que se suprime nessa mesma condição.
 *
 * Sem empresa selecionada o painel desmonta por completo: o mapa recupera o
 * espaço (spec 2.3 — nunca reservar área vazia).
 *
 * A11y (o Sheet não está aqui para dar focus trap): foco inicial no botão
 * fechar, ESC fecha, região rotulada, e o foco volta para o elemento que
 * abriu o painel ao fechar.
 */
export function CompanyDetailPanel() {
  const detailsId = useLeadsStore((s) => s.detailsId);
  const preview = useLeadsStore((s) => s.preview);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const setPreview = useLeadsStore((s) => s.setPreview);
  const isXl = useMediaQuery("(min-width: 1280px)");
  const open = isXl && (detailsId != null || preview != null);

  // Foco: guarda quem abriu o painel (marker/card) e devolve ao fechar —
  // compensa a ausência do focus trap/returnFocus do Sheet (radix).
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      restoreFocusRef.current =
        (document.activeElement instanceof HTMLElement && document.activeElement) || null;
    } else if (wasOpenRef.current && restoreFocusRef.current?.isConnected) {
      restoreFocusRef.current.focus({ preventScroll: true });
    }
    wasOpenRef.current = open;
  }, [open]);

  // ESC fecha o painel (equivalente ao ESC do Sheet, que só existe no overlay).
  // Não fecha quando o ESC pertence a um diálogo aninhado (Radix consome o
  // evento antes — defaultPrevented) ou a um diálogo ainda aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      setDetails(null);
      setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setDetails, setPreview]);

  if (!open) return null;

  return (
    <aside
      aria-label="Detalhes da empresa"
      className="flex w-[400px] shrink-0 flex-col overflow-hidden border-l border-border bg-background xl:w-[450px]"
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <CompanyDetailContent
          autoFocusClose
          onClose={() => {
            setDetails(null);
            setPreview(null);
          }}
        />
      </Suspense>
    </aside>
  );
}
