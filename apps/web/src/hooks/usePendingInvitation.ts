// Consome o convite pendente guardado no cadastro.
//
// Por que existe: o link de convite (`/cadastro?invitation=<token>`) só guardava
// o token em `user_metadata.invitation_token`. Nada nunca chamava a edge
// function `accept-invitation`, então quem entrava por convite ficava apenas com
// a organização Free criada automaticamente por `handle_new_user()` e nunca
// entrava na organização que o convidou — o fluxo de piloto não fechava.
//
// Por que aqui e não no cadastro: o cadastro exige confirmação de e-mail, então
// no momento do submit ainda não há sessão para autenticar a chamada. O aceite
// tem de acontecer no primeiro carregamento autenticado.

import { useEffect, useRef } from "react";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { setActiveOrganizationId, useRefreshTenant } from "@/lib/tenant";
import { isDemoMode } from "@/lib/env";
import { track } from "@/lib/analytics";

interface AcceptInvitationResponse {
  success: boolean;
  organizationId: string;
  role?: string;
  alreadyMember?: boolean;
}

/**
 * Aceita o convite pendente uma única vez por sessão de página.
 * Silencioso por design: convite expirado ou já usado não deve bloquear o app —
 * o usuário segue na organização Free e o time vê o evento no analytics.
 */
export function usePendingInvitation(): void {
  const refreshTenant = useRefreshTenant();
  // Guarda contra o duplo-invoke do StrictMode e contra re-render.
  const attempted = useRef(false);

  useEffect(() => {
    if (isDemoMode || attempted.current) return;
    attempted.current = true;

    void (async () => {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const token = user.user_metadata?.invitation_token;
      if (!token || typeof token !== "string") return;

      try {
        const result = await invokeFunction<AcceptInvitationResponse>("accept-invitation", {
          token,
        });

        if (result?.organizationId) {
          // Fixa a organização do convite como ativa, senão a resolução
          // determinística escolheria a Free (membership mais antiga).
          setActiveOrganizationId(result.organizationId);
          refreshTenant();
          track("invitation_accepted", { organizationId: result.organizationId });
        }
      } catch (err) {
        track("invitation_accept_failed", {
          reason: err instanceof Error ? err.message : "unknown",
        });
      } finally {
        // Limpa o token em qualquer desfecho: token de uso único não deve ficar
        // no metadata do usuário sendo retentado a cada carregamento.
        await supabase.auth.updateUser({ data: { invitation_token: null } });
      }
    })();
  }, [refreshTenant]);
}
