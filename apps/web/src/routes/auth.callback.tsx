import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase"; import { consumeReturnTo } from "@/hooks/useAuth"; import { track } from "@/lib/analytics"; import { isDemoMode } from "@/lib/env";
import { LoaderCircle, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallbackPage });

function AuthCallbackPage() {
  const navigate = useNavigate(); const [state, setState] = useState<"processing"|"success"|"error">("processing"); const [errorMsg, setErrorMsg] = useState(""); const done = useRef(false);

  useEffect(() => { if (done.current||isDemoMode) return; done.current=true;
    void(async()=>{try{
      const s=getSupabase(); const{data,error}=await s.auth.getSession();
      if(error){setState("error");setErrorMsg("Não foi possível concluir a autenticação.");track("auth_callback_failed",{error_category:"session_resolution",method:"google"});return;}
      if(!data.session){setState("error");setErrorMsg("Sessão não encontrada.");track("auth_callback_failed",{error_category:"no_session",method:"google"});return;}
      setState("success"); track("google_auth_completed"); await ensureProvisioning();
      setTimeout(()=>navigate({to:consumeReturnTo()??"/app/mapa"}),600);
    }catch(err){setState("error");setErrorMsg("Erro inesperado.");track("auth_callback_failed",{error_category:"unexpected",method:"google"});console.error("[auth/callback]",err);}})();
  },[navigate]);

  return (<div className="flex min-h-dvh items-center justify-center bg-background px-4"><div className="flex flex-col items-center text-center max-w-sm">
    {state==="processing"&&<><div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft"><LoaderCircle className="h-6 w-6 animate-spin text-primary" strokeWidth={2}/></div><h1 className="mt-4 text-page-title font-semibold text-foreground tracking-tight">Conectando sua conta</h1><p className="mt-2 text-body-sm text-muted-foreground">Preparando seu workspace…</p></>}
    {state==="success"&&<><div className="grid h-12 w-12 place-items-center rounded-full bg-success-soft"><CheckCircle2 className="h-6 w-6 text-success" strokeWidth={2}/></div><h1 className="mt-4 text-page-title font-semibold text-foreground tracking-tight">Tudo pronto!</h1><p className="mt-2 text-body-sm text-muted-foreground">Redirecionando…</p></>}
    {state==="error"&&<><div className="grid h-12 w-12 place-items-center rounded-full bg-destructive-soft"><XCircle className="h-6 w-6 text-destructive" strokeWidth={2}/></div><h1 className="mt-4 text-page-title font-semibold text-foreground tracking-tight">Não foi possível entrar</h1><p className="mt-2 text-body-sm text-muted-foreground">{errorMsg}</p><button onClick={()=>navigate({to:"/login"})} className="mt-6 inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover">Voltar para o login</button></>}
  </div></div>);
}

async function ensureProvisioning() { try{
  track("workspace_provisioning_started",{method:"google"}); const s=getSupabase(); const{data:ud}=await s.auth.getUser(); const u=ud.user; if(!u)return;
  const{data:pf}=await s.from("profiles").select("id").eq("id",u.id).maybeSingle();
  if(!pf){const fn=(u.user_metadata?.full_name as string)||(u.user_metadata?.name as string)||"";await s.from("profiles").upsert({id:u.id,full_name:fn});}
  const{data:mb}=await s.from("organization_members").select("organization_id").eq("user_id",u.id).limit(1);
  if(!mb||mb.length===0){const cn=(u.user_metadata?.company_name as string)||"Minha organização";const{data:org}=await s.from("organizations").insert({name:cn,owner_user_id:u.id}).select("id").single();
    if(org){await s.from("organization_members").insert({organization_id:org.id,user_id:u.id,role:"owner"});const{data:pl}=await s.from("billing_plans").select("id").eq("code","free").single();if(pl)await s.from("subscriptions").insert({organization_id:org.id,plan_id:pl.id,status:"free"});}}
  track("workspace_provisioning_completed",{method:"google"});
}catch(err){track("workspace_provisioning_failed",{method:"google",error_category:err instanceof Error?err.message:"unknown"});console.error("[ensureProvisioning]",err);}
}
