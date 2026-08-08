import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthFormAlert } from "@/components/auth/AuthFormAlert";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TermsGate } from "@/components/auth/TermsGate";
import { SalesContactForm } from "@/components/marketing/SalesContactForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rememberPendingVerificationEmail, signUp } from "@/hooks/useAuth";
import { readUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";
import { isDemoMode } from "@/lib/env";
import { passwordSchema } from "@/lib/password-policy";
import { Sparkles } from "lucide-react";

// Bump whenever Termos de Uso / Política de Privacidade materially change —
// stored per signup for the LGPD consent record.
const TERMS_VERSION = "2026-08-01";

const PAID: Record<string, string> = {
  solo: "Solo",
  professional: "Profissional",
  agency: "Agência",
  team: "Equipe",
};

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s: Record<string, unknown>): { plan?: string; invitation?: string } => ({
    ...(typeof s.plan === "string" ? { plan: s.plan } : {}),
    ...(typeof s.invitation === "string" ? { invitation: s.invitation } : {}),
  }),
  component: SignUpPage,
});

const schema = z.object({
  fullName: z.string().min(2, "Informe seu nome"),
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: passwordSchema,
});
type FormData = z.infer<typeof schema>;

function SignUpPage() {
  const navigate = useNavigate();
  const { plan, invitation } = Route.useSearch();
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [terms, setTerms] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selPlan, setSelPlan] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const pw = watch("password", "");
  const hasInv = !!invitation;
  const isPaid = plan && plan !== "free";

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    setSubmitting(true);
    track("signup_started", {
      plan: plan ?? (hasInv ? "pilot" : "free"),
      source: hasInv ? "invitation" : "direct",
    });
    try {
      const auth = await signUp(data.email, data.password, data.fullName, {
        intended_plan: plan ?? null,
        invitation_token: invitation ?? null,
        utm: readUtm() ?? undefined,
        // LGPD: record that consent was given, when, and for which version of
        // the legal docs — the checkbox alone (client-side, ungated by the
        // server) isn't an audit trail.
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      });
      setRegisteredEmail(data.email);
      setNeedsEmailConfirmation(!auth.session);
      if (!auth.session) rememberPendingVerificationEmail(data.email);
      track("signup_completed", { plan: plan ?? (hasInv ? "pilot" : "free") });
      if (isPaid) {
        setSelPlan(plan!);
        setSuccess(true);
      } else if (auth.session) {
        navigate({ to: "/app/mapa" });
      } else {
        navigate({ to: "/verificar-email" });
      }
    } catch (err) {
      track("signup_failed", { error_category: err instanceof Error ? "validation" : "unknown" });
      setFormError(err instanceof Error ? err.message : "Falha ao criar conta.");
    } finally {
      setSubmitting(false);
    }
  });

  if (isDemoMode)
    return (
      <AuthLayout title="Modo demonstração" description="Cadastro desativado em modo demo.">
        <Button className="w-full h-11" onClick={() => navigate({ to: "/app/mapa" })}>
          Entrar no modo demo
        </Button>
      </AuthLayout>
    );
  if (success && selPlan)
    return (
      <AuthLayout
        title="Conta criada"
        description={
          needsEmailConfirmation
            ? "Confirme seu e-mail para ativar o acesso."
            : "Agora vamos concluir a ativação do seu plano."
        }
        showLegalNotice={false}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft">
            <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-body-sm text-muted-foreground">
            {needsEmailConfirmation ? "Enviamos a confirmação para " : "Conta criada com "}
            <span className="font-medium text-foreground break-all">{registeredEmail}</span>. O
            plano <span className="font-medium text-foreground">{PAID[selPlan] ?? selPlan}</span>{" "}
            foi selecionado; fale com a gente para combinar o pagamento e a ativação.
          </p>
          <SalesContactForm
            source={`cadastro_plano_${selPlan}`}
            trigger={<Button className="w-full h-11">Falar com a gente</Button>}
          />
          {needsEmailConfirmation && (
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => navigate({ to: "/verificar-email" })}
            >
              Ver instruções do e-mail
            </Button>
          )}
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Crie sua conta gratuitamente"
      description="Encontre empresas, priorize oportunidades e organize seus próximos contatos."
      footer={
        <span>
          Já possui uma conta?{" "}
          <Link
            to="/login"
            className="font-medium text-primary hover:text-primary-hover underline underline-offset-2 transition-colors"
          >
            Entrar
          </Link>
        </span>
      }
      topBanner={
        hasInv ? (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-primary/20 bg-primary-soft px-3.5 py-3 text-body-sm">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-px" strokeWidth={1.75} />
            <span>
              <span className="font-medium text-primary">Você foi convidado!</span>{" "}
              <span className="text-muted-foreground">Acesso ao programa Pilot.</span>
            </span>
          </div>
        ) : undefined
      }
      showLegalNotice={false}
    >
      <div className="space-y-5">
        <GoogleAuthButton
          label="Cadastrar com Google"
          onStart={() => {
            setFormError(null);
            setGoogleLoading(true);
          }}
          onError={(message) => {
            setGoogleLoading(false);
            setFormError(message);
          }}
        />
        <AuthDivider label="ou cadastre-se com e-mail" />
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthFormAlert message={formError} />
          {isPaid && (
            <div className="flex items-center gap-2 rounded-[8px] bg-primary-subtle px-3 py-2 text-body-sm">
              <span className="font-medium text-primary">Plano {PAID[plan!] ?? plan}</span>
              <span className="text-muted-foreground">selecionado</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-body-sm">
              Nome
            </Label>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="Seu nome completo"
              className="h-11"
              disabled={submitting || googleLoading}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "signup-name-error" : undefined}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p id="signup-name-error" className="text-caption text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-body-sm">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className="h-11"
              disabled={submitting || googleLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="signup-email-error" className="text-caption text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-body-sm">
              Senha
            </Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              showRequirements
              value={pw}
              disabled={submitting || googleLoading}
              {...register("password")}
              error={errors.password?.message}
            />
          </div>
          <TermsGate
            accepted={terms}
            onAcceptChange={setTerms}
            disabled={submitting || googleLoading}
          />
          <Button
            type="submit"
            className="w-full h-11"
            disabled={submitting || googleLoading || !terms}
          >
            {submitting ? "Criando sua conta…" : "Criar minha conta"}
          </Button>
          <p className="-mt-1 text-center text-caption text-muted-foreground">
            Comece gratuitamente. Sem cartão de crédito.
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
