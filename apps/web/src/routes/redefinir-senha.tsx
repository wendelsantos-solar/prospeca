import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, XCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

const schema = z
  .object({
    password: z.string().min(8, "Mínimo de 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const pw = watch("password", "");

  useEffect(() => {
    if (isDemoMode) {
      setStatus("invalid");
      return;
    }
    // Supabase parses the recovery token from the URL on client init and
    // fires this event once a recovery session is established. There is no
    // synchronous way to check "is this a valid recovery link" — waiting for
    // the event (or a timeout, for expired/missing/malformed links) is the
    // documented pattern.
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });
    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 2500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await updatePassword(data.password);
      toast.success("Senha redefinida. Entre novamente para continuar.");
      await getSupabase().auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao redefinir a senha.");
    } finally {
      setSubmitting(false);
    }
  });

  if (status === "checking") {
    return (
      <AuthLayout title="Confirmando o link" description="Só um instante…">
        <div className="flex justify-center py-4">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" strokeWidth={2} />
        </div>
      </AuthLayout>
    );
  }

  if (status === "invalid") {
    return (
      <AuthLayout
        title="Link inválido ou expirado"
        description="Solicite um novo link para continuar."
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive-soft">
            <XCircle className="h-6 w-6 text-destructive" strokeWidth={2} />
          </div>
          <p className="text-body-sm text-muted-foreground">
            Este link de redefinição não é mais válido — pode já ter sido usado ou expirado.
          </p>
          <Button className="w-full h-11" asChild>
            <Link to="/recuperar-senha">Solicitar novo link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Redefinir senha" description="Escolha uma nova senha para sua conta.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-body-sm">
            Nova senha
          </Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            showRequirements
            value={pw}
            disabled={submitting}
            {...register("password")}
            error={errors.password?.message}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-body-sm">
            Confirmar senha
          </Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            disabled={submitting}
            {...register("confirmPassword")}
            error={errors.confirmPassword?.message}
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={submitting}>
          {submitting ? "Redefinindo…" : "Redefinir senha"}
        </Button>
      </form>
    </AuthLayout>
  );
}
