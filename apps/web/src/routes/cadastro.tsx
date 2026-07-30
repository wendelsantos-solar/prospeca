import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/hooks/useAuth";
import { readUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";

const PAID_PLAN_NAMES: Record<string, string> = {
  solo: "Solo",
  professional: "Profissional",
  agency: "Agência",
  team: "Equipe",
};

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    ...(typeof search.plan === "string" ? { plan: search.plan } : {}),
  }),
  component: SignUpPage,
});

const schema = z
  .object({
    fullName: z.string().min(2, "Informe seu nome"),
    companyName: z.string().min(2, "Informe o nome da empresa"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Mínimo de 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

function SignUpPage() {
  const navigate = useNavigate();
  const { plan } = Route.useSearch();
  const [submitting, setSubmitting] = useState(false);
  const [createdWithPlan, setCreatedWithPlan] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    track("signup_started", { plan: plan ?? "free" });
    try {
      await signUp(data.email, data.password, data.fullName, data.companyName, {
        intended_plan: plan ?? null,
        utm: readUtm() ?? undefined,
      });
      track("signup_completed", { plan: plan ?? "free" });
      if (plan && plan !== "free") {
        setCreatedWithPlan(plan);
      } else {
        toast.success("Conta criada. Verifique seu e-mail para confirmar.");
        navigate({ to: "/login" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar conta.");
    } finally {
      setSubmitting(false);
    }
  });

  if (createdWithPlan) {
    return (
      <AuthCard title="Conta criada" description="Verifique seu e-mail para confirmar o acesso.">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-primary-soft">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-foreground">
            Você escolheu o plano {PAID_PLAN_NAMES[createdWithPlan] ?? createdWithPlan}. Pagamentos
            ainda não estão abertos — sua conta já está ativa no Descobrir e a gente avisa assim que
            puder migrar.
          </p>
          <Button className="mt-5 w-full" onClick={() => navigate({ to: "/login" })}>
            Ir para o login
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      description="Comece a prospectar negócios locais."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" autoComplete="name" {...register("fullName")} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Empresa</Label>
          <Input id="companyName" autoComplete="organization" {...register("companyName")} />
          {errors.companyName && (
            <p className="text-xs text-destructive">{errors.companyName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Criando..." : "Criar conta"}
        </Button>
      </form>
    </AuthCard>
  );
}
