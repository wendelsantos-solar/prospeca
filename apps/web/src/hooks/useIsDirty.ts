import { useSearchDraftStore, useLeadsStore } from "@/stores";
import { classifyDirty, type DirtyReason } from "@/lib/search-dirty";

export function useIsDirty(): { dirty: boolean; reason: DirtyReason } {
  const draft = useSearchDraftStore((s) => s.draft);
  const current = useLeadsStore((s) => s.currentSearch);
  const { dirty, reason } = classifyDirty(draft, current);
  return { dirty, reason };
}
