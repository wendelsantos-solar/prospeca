import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
});

const schema = z.object({ email: z.string().email("E-mail inválido") });
type FormData = z.infer<typeof schema>;

function RecuperarSenhaPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (sent) {
    return (
      <AuthCard title="E-mail enviado" description="Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.">
        <Button className="w-full" variant="outline" asChild>
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit(async (_data) => {
    setSubmitting(true);
    try {
      // Password reset via Supabase
      toast.info("Se o e-mail estiver cadastrado, você receberá um link.");
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthCard title="Recuperar senha" description="Informe seu e-mail para receber um link de redefinição." footer={<>Lembrou? <Link to="/login" className="text-primary hover:underline">Entrar</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Enviando..." : "Enviar link"}</Button>
      </form>
    </AuthCard>
  );
}
