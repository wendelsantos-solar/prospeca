import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, CheckCircle2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthFormAlert } from "@/components/auth/AuthFormAlert";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";
import {
  clearPendingVerificationEmail,
  consumeReturnTo,
  readPendingVerificationEmail,
  resendSignupEmail,
} from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/env";

export const Route = createFileRoute("/verificar-email")({
  component: VerificarEmailPage,
});

function VerificarEmailPage() {
  const navigate = useNavigate();
  // "waiting": no session yet — either the confirmation link hasn't been
  // clicked, or this page was reached without one (e.g. bookmarked).
  // "confirmed": the client picked up a session from the link in the URL.
  const [state, setState] = useState<"checking" | "waiting" | "confirmed">("checking");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    setPendingEmail(readPendingVerificationEmail());
  }, []);

  useEffect(() => {
    if (done.current || isDemoMode) {
      setState("waiting");
      return;
    }
    done.current = true;
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setState("confirmed");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setState("confirmed");
      else setState((s) => (s === "checking" ? "waiting" : s));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state !== "confirmed") return;
    clearPendingVerificationEmail();
    const t = setTimeout(() => navigate({ to: consumeReturnTo() ?? "/app/mapa" }), 1200);
    return () => clearTimeout(t);
  }, [state, navigate]);

  const handleResend = async () => {
    if (!pendingEmail || resending || resent) return;
    setResendError(null);
    setResending(true);
    try {
      await resendSignupEmail(pendingEmail);
      setResent(true);
    } catch (error) {
      setResendError(
        error instanceof Error ? error.message : "Não foi possível reenviar o e-mail.",
      );
    } finally {
      setResending(false);
    }
  };

  if (state === "checking") {
    return (
      <AuthLayout title="Verificando" description="Só um instante…" showLegalNotice={false}>
        <div className="flex justify-center py-4">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" strokeWidth={2} />
        </div>
      </AuthLayout>
    );
  }

  if (state === "confirmed") {
    return (
      <AuthLayout title="E-mail confirmado!" description="Redirecionando…" showLegalNotice={false}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-success-soft">
            <CheckCircle2 className="h-6 w-6 text-success" strokeWidth={2} />
          </div>
          <p className="text-body-sm text-muted-foreground">
            Sua conta foi confirmada. Preparando seu workspace…
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verifique seu e-mail"
      description="Falta pouco para começar."
      showLegalNotice={false}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft">
          <MailCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        <p className="text-body-sm text-muted-foreground">
          Enviamos um link de confirmação
          {pendingEmail ? (
            <>
              {" "}
              para <span className="font-medium text-foreground break-all">{pendingEmail}</span>
            </>
          ) : (
            " para o e-mail que você cadastrou"
          )}
          . Clique nele para ativar sua conta.
        </p>
        <p className="text-caption text-muted-foreground">
          Não encontrou? Verifique a caixa de spam ou aguarde alguns minutos.
        </p>
        <div className="w-full text-left">
          <AuthFormAlert message={resendError} />
        </div>
        {pendingEmail && (
          <Button
            className="w-full h-11"
            variant="outline"
            onClick={handleResend}
            disabled={resending || resent}
          >
            {resending ? "Reenviando…" : resent ? "E-mail reenviado" : "Reenviar e-mail"}
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-caption">
          <Link
            to="/cadastro"
            className="text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            Corrigir e-mail
          </Link>
          <Link
            to="/login"
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
