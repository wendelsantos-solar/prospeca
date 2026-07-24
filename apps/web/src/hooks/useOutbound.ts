import { useCallback } from "react";
import { toast } from "sonner";
import { planWhatsApp, WHATSAPP_REFUSAL_MESSAGE, type OutboundContact } from "@/lib/outbound";
import { useSuppressionHashes, useAddToFunnelMutation } from "./useLeadsQuery";

/**
 * The app's only WhatsApp entry point. Binds the outbound rules (opt-out,
 * landline, number resolution) to their side effects: the pt-BR toast, the
 * discovery → funnel materialization and opening the link.
 *
 * Callers pass `materialize` when the target is a discovery result that is not
 * in the funnel yet — contacting a business promotes it to `contacted`.
 */
export function useOutbound() {
  const { data: suppressed } = useSuppressionHashes();
  const { mutate: addToFunnel } = useAddToFunnelMutation();

  // Stable across renders except when the opt-out set changes — imperative map
  // callers keep it in effect dependency lists, where `suppressed` used to sit.
  const openWhatsApp = useCallback(
    async (
      contact: OutboundContact,
      opts?: { message?: string; materialize?: { searchId: string; placeId: string } },
    ): Promise<boolean> => {
      const plan = await planWhatsApp(contact, suppressed, opts?.message);
      if (!plan.ok) {
        toast.error(WHATSAPP_REFUSAL_MESSAGE[plan.reason]);
        return false;
      }
      if (opts?.materialize) {
        addToFunnel({ ...opts.materialize, stage: "contacted" });
      }
      window.open(plan.url, "_blank");
      return true;
    },
    [suppressed, addToFunnel],
  );

  return { openWhatsApp };
}
