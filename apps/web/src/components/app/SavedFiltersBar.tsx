import { Plus, X } from "lucide-react";
import { useLeadsStore } from "@/stores";
import type { SavedFilter } from "@/types";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SavedFiltersBar() {
  const filters = useLeadsStore((s) => s.filters);
  const savedFilters = useLeadsStore((s) => s.savedFilters);
  const replaceFilters = useLeadsStore((s) => s.replaceFilters);
  const clearFilters = useLeadsStore((s) => s.clearFilters);
  const saveFilterSet = useLeadsStore((s) => s.saveFilterSet);
  const deleteFilterSet = useLeadsStore((s) => s.deleteFilterSet);

  const activeSaved = savedFilters.find((sf) => deepEqual(sf.filters, filters));
  const isDefault = !activeSaved;

  function handleSave() {
    const name = window.prompt("Nome do filtro salvo:");
    if (name && name.trim()) {
      saveFilterSet(name.trim());
    }
  }

  function handleDelete(sf: SavedFilter) {
    const wasActive = activeSaved?.id === sf.id;
    deleteFilterSet(sf.id);
    if (wasActive) clearFilters();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => clearFilters()}
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
          isDefault
            ? "border-primary bg-primary-soft text-primary"
            : "border-border bg-surface text-muted-foreground hover:border-border"
        }`}
      >
        Todos
      </button>
      {savedFilters.map((sf) => {
        const active = activeSaved?.id === sf.id;
        return (
          <div key={sf.id} className="group inline-flex items-center">
            <button
              onClick={() => replaceFilters(sf.filters)}
              className={`inline-flex items-center gap-1 rounded-l-full border py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium transition-colors ${
                active
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-muted-foreground hover:border-border"
              }`}
            >
              {sf.name}
            </button>
            <div
              className={`flex rounded-r-full border border-l-0 ${
                active ? "border-primary bg-primary-soft" : "border-border bg-surface"
              }`}
            >
              <button
                aria-label={`Remover filtro ${sf.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(sf);
                }}
                className="grid h-[26px] w-6 place-items-center rounded-r-full text-muted-foreground hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={handleSave}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="h-3 w-3" /> Salvar filtro atual
      </button>
    </div>
  );
}
