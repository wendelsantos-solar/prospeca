import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form"; import { zodResolver } from "@hookform/resolvers/zod"; import { z } from "zod"; import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout"; import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton"; import { AuthDivider } from "@/components/auth/AuthDivider"; import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Label } from "@/components/ui/label"; import { Checkbox } from "@/components/ui/checkbox";
import { signIn, consumeReturnTo } from "@/hooks/useAuth"; import { track } from "@/lib/analytics"; import { isDemoMode } from "@/lib/env";

export const Route = createFileRoute("/login")({ validateSearch: (s: Record<string,unknown>) => ({ ...(typeof s.returnTo==="string"?{returnTo:s.returnTo}:{}) }), component: LoginPage });

const schema = z.object({ email: z.string().min(1,"Informe seu e-mail").email("E-mail inválido"), password: z.string().min(1,"Informe sua senha"), rememberMe: z.boolean().optional() });
type FormData = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate(); const [submitting, setSubmitting] = useState(false); const [googleLoading, setGoogleLoading] = useState(false);
  const { register, handleSubmit, formState:{errors} } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues:{rememberMe:true} });

  if (isDemoMode) return <AuthLayout title="Modo demonstração" description="Autenticação desativada em modo demo."><Button className="w-full h-11" onClick={()=>navigate({to:"/app/mapa"})}>Entrar no modo demo</Button></AuthLayout>;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true); track("email_login_started");
    try { await signIn(data.email, data.password); track("email_login_completed"); navigate({ to: consumeReturnTo() ?? "/app/mapa" }); }
    catch(err) { track("email_login_failed",{error_category:err instanceof Error?"credentials":"unknown"}); toast.error(err instanceof Error?err.message:"Falha ao entrar."); }
    finally { setSubmitting(false); }
  });

  return (<AuthLayout title="Entre na sua conta" description="Continue sua prospecção e acompanhe suas oportunidades." footer={<span>Ainda não possui uma conta?{" "}<Link to="/cadastro" className="font-medium text-primary hover:text-primary-hover underline underline-offset-2 transition-colors">Criar conta gratuita</Link></span>}>
    <div className="space-y-5">
      <GoogleAuthButton onStart={()=>setGoogleLoading(true)} /><AuthDivider />
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email" className="text-body-sm">E-mail</Label><Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" disabled={submitting||googleLoading} {...register("email")}/>{errors.email&&<p className="text-caption text-destructive">{errors.email.message}</p>}</div>
        <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="password" className="text-body-sm">Senha</Label><Link to="/recuperar-senha" className="text-caption text-primary hover:text-primary-hover underline underline-offset-2 transition-colors">Esqueci minha senha</Link></div><PasswordInput id="password" autoComplete="current-password" placeholder="Sua senha" disabled={submitting||googleLoading} {...register("password")} error={errors.password?.message}/></div>
        <div className="flex items-center gap-2"><Checkbox id="rememberMe" disabled={submitting||googleLoading} {...register("rememberMe")}/><Label htmlFor="rememberMe" className="text-body-sm font-normal text-muted-foreground cursor-pointer">Manter conectado</Label></div>
        <Button type="submit" className="w-full h-11" disabled={submitting||googleLoading}>{submitting?"Entrando…":"Entrar"}</Button>
      </form>
    </div>
  </AuthLayout>);
}
