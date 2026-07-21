import { useIsDirty } from "@/hooks/useIsDirty";
import { useLeadsStore } from "@/stores";
import { Search } from "lucide-react";

const REASON_LABEL: Record<string, string> = {
  niche: "Nicho mudou",
  location: "Área mudou",
  "radius-up": "Raio aumentou",
  "presence-wider": "Filtro ampliado",
};

/** Floating pill over the map: appears when results are stale. */
export function RadarPill({ onSearch }: { onSearch: () => void }) {
  const { dirty, reason } = useIsDirty();
  const searching = useLeadsStore((s) => s.searching);
  const hasResults = useLeadsStore((s) => s.currentSearch) != null;
  if (!dirty || !hasResults || searching) return null;
  return (
    <div className="absolute left-1/2 top-3 z-[400] -translate-x-1/2">
      <button
        onClick={onSearch}
        className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-elevated hover:bg-amber-600"
      >
        <Search className="h-3.5 w-3.5" />
        Buscar nesta área
        <span className="opacity-80">· {REASON_LABEL[reason] ?? "atualizar"}</span>
      </button>
    </div>
  );
}
