import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/hooks/useAuth";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
});

const schema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
});
type FormData = z.infer<typeof schema>;

function RecuperarSenhaPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (sent) {
    return (
      <AuthLayout title="E-mail enviado" description="Confira sua caixa de entrada.">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft">
            <Mail className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-body-sm text-muted-foreground">
            Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha em alguns
            minutos.
          </p>
          <Button className="w-full h-11" variant="outline" asChild>
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await requestPasswordReset(data.email);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar o link.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title="Recuperar senha"
      description="Informe seu e-mail para receber um link de redefinição."
      footer={
        <span>
          Lembrou sua senha?{" "}
          <Link
            to="/login"
            className="font-medium text-primary hover:text-primary-hover underline underline-offset-2 transition-colors"
          >
            Entrar
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-body-sm">
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            disabled={submitting}
            {...register("email")}
          />
          {errors.email && <p className="text-caption text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full h-11" disabled={submitting}>
          {submitting ? "Enviando…" : "Enviar link"}
        </Button>
      </form>
    </AuthLayout>
  );
}
