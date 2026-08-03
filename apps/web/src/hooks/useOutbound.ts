import { useCallback } from "react";
import { toast } from "sonner";
import { planWhatsApp, WHATSAPP_REFUSAL_MESSAGE, type OutboundContact } from "@/lib/outbound";
import {
  useSuppressionHashes,
  useAddToFunnelMutation,
  useRecordContactMutation,
} from "./useLeadsQuery";
import { currentCadenceStep, CADENCE_STEPS } from "@/lib/cadence";

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
  const { mutateAsync: addToFunnel } = useAddToFunnelMutation();
  const { mutateAsync: recordContact } = useRecordContactMutation();

  // Stable across renders except when the opt-out set changes — imperative map
  // callers keep it in effect dependency lists, where `suppressed` used to sit.
  const openWhatsApp = useCallback(
    async (
      contact: OutboundContact,
      opts?: {
        message?: string;
        materialize?: { searchId: string; placeId: string };
        cadenceStepId?: string;
      },
    ): Promise<boolean> => {
      const plan = await planWhatsApp(contact, suppressed, opts?.message);
      if (!plan.ok) {
        toast.error(WHATSAPP_REFUSAL_MESSAGE[plan.reason]);
        return false;
      }
      window.open(plan.url, "_blank");

      let leadId = contact.id ?? contact.importedLeadId ?? undefined;
      if (!leadId && opts?.materialize) {
        try {
          const result = await addToFunnel({ ...opts.materialize, stage: "new" });
          leadId = result.leadIds[0];
        } catch {
          toast.warning("WhatsApp aberto, mas não foi possível adicionar o lead ao Pipeline.");
          return true;
        }
      }

      if (leadId) {
        const inferredStep =
          contact.stage === "contacted" && contact.cadenceStartedAt
            ? currentCadenceStep({
                stage: contact.stage,
                cadenceStartedAt: contact.cadenceStartedAt,
                cadenceStep: contact.cadenceStep,
                cadenceCompletedAt: contact.cadenceCompletedAt,
              })?.id
            : undefined;
        const cadenceStepId = opts?.cadenceStepId ?? inferredStep;
        const cadenceLabel = CADENCE_STEPS.find((step) => step.id === cadenceStepId)?.label;
        const targetLeadId = leadId;
        toast("WhatsApp aberto — confirme somente depois de enviar.", {
          duration: 12_000,
          action: {
            label: "Marcar como enviada",
            onClick: () => {
              void recordContact({
                leadId: targetLeadId,
                input: {
                  channel: "whatsapp",
                  title: cadenceLabel ? `${cadenceLabel} enviado` : "Primeiro contato enviado",
                  outcome: "sent",
                  occurredAt: new Date().toISOString(),
                  cadenceStepId,
                },
              })
                .then(() => toast.success("Contato registrado e próximo passo atualizado."))
                .catch(() => toast.error("Não foi possível registrar o contato."));
            },
          },
        });
      }
      return true;
    },
    [suppressed, addToFunnel, recordContact],
  );

  return { openWhatsApp };
}
