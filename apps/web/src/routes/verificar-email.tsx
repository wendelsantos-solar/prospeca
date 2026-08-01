import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, CheckCircle2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";
import { consumeReturnTo } from "@/hooks/useAuth";
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
  const done = useRef(false);

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
    const t = setTimeout(() => navigate({ to: consumeReturnTo() ?? "/app/mapa" }), 1200);
    return () => clearTimeout(t);
  }, [state, navigate]);

  if (state === "checking") {
    return (
      <AuthLayout title="Verificando" description="Só um instante…">
        <div className="flex justify-center py-4">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" strokeWidth={2} />
        </div>
      </AuthLayout>
    );
  }

  if (state === "confirmed") {
    return (
      <AuthLayout title="E-mail confirmado!" description="Redirecionando…">
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
    <AuthLayout title="Verifique seu e-mail" description="Falta pouco para começar.">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft">
          <MailCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        <p className="text-body-sm text-muted-foreground">
          Enviamos um link de confirmação para o e-mail que você cadastrou. Clique nele para ativar
          sua conta.
        </p>
        <Button className="w-full h-11" variant="outline" asChild>
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
