import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseAvailable } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";

// ── Redirect preservation ────────────────────────────────────────────────
const RETURN_TO_KEY = "radar-local:returnTo";
const REDIRECT_ALLOWLIST = [
  "/app", "/app/mapa", "/app/kanban", "/app/hoje", "/app/agenda",
  "/app/painel", "/app/historico", "/app/configuracoes", "/app/admin", "/app/onboarding",
];

function isAllowedRedirect(path: string): boolean {
  return REDIRECT_ALLOWLIST.some((a) => path === a || path.startsWith(a + "?"));
}

export function preserveReturnTo(path: string): void {
  if (typeof window === "undefined") return;
  if (!isAllowedRedirect(path)) return;
  try { sessionStorage.setItem(RETURN_TO_KEY, path); } catch { /* noop */ }
}

export function consumeReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const s = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return s && isAllowedRedirect(s) ? s : null;
  } catch { return null; }
}

// ── Auth hook ────────────────────────────────────────────────────────────
export interface AuthState {
  loading: boolean; session: Session | null; user: User | null; isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: !isDemoMode, session: null, user: null, isAuthenticated: isDemoMode,
  });
  useEffect(() => {
    if (isDemoMode || !supabaseAvailable()) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) =>
      setState({ loading: false, session: data.session, user: data.session?.user ?? null, isAuthenticated: !!data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setState({ loading: false, session, user: session?.user ?? null, isAuthenticated: !!session }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

export async function getSessionOrNull(): Promise<Session | null> {
  if (isDemoMode || !supabaseAvailable()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

// ── Email/Password ───────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(traduzErroAuth(error.message));
}

export async function signUp(email: string, password: string, fullName: string, extra?: Record<string, unknown>) {
  const { data, error } = await getSupabase().auth.signUp({
    email, password, options: { data: { full_name: fullName, ...extra } },
  });
  if (error) throw new Error(traduzErroAuth(error.message));
  return data;
}

export async function signOut() {
  if (typeof window !== "undefined") {
    try { const p = window.location.pathname + window.location.search; if (p.startsWith("/app")) preserveReturnTo(p); } catch { /* noop */ }
  }
  await getSupabase().auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
  if (error) throw new Error(traduzErroAuth(error.message));
}

export async function updatePassword(newPassword: string) {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw new Error(traduzErroAuth(error.message));
}

// ── Google OAuth ─────────────────────────────────────────────────────────
export function isGoogleAuthConfigured(): boolean {
  if (isDemoMode) return false;
  return !!import.meta.env.VITE_SUPABASE_URL;
}
export function googleAuthVisible(): boolean {
  if (isDemoMode) return false;
  const c = !!import.meta.env.VITE_GOOGLE_CLIENT_ID || isGoogleAuthConfigured();
  if (!c && import.meta.env.PROD) return false;
  return true;
}
export function googleAuthEnabled(): boolean {
  if (isDemoMode) return false;
  return !!import.meta.env.VITE_GOOGLE_CLIENT_ID || isGoogleAuthConfigured();
}
export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { access_type: "offline", prompt: "select_account" } },
  });
  if (error) throw new Error(traduzErroAuth(error.message));
}

// ── Error translation ────────────────────────────────────────────────────
export function traduzErroAuth(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Confirme seu e-mail para continuar.",
    "User already registered": "Já existe uma conta com este e-mail. Entre usando o método utilizado anteriormente.",
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
    "Signup requires a valid password": "A senha deve ter pelo menos 8 caracteres.",
    "For security purposes, you can only request this after": "Muitas tentativas. Aguarde alguns minutos.",
    "User not found": "Se existir uma conta com este e-mail, você receberá as instruções.",
    "new password should be different from the old password": "A nova senha deve ser diferente da anterior.",
    "Invalid Refresh Token": "Sua sessão expirou. Entre novamente para continuar.",
    "Refresh Token Not Found": "Sua sessão expirou. Entre novamente para continuar.",
    "Session expired": "Sua sessão expirou. Entre novamente para continuar.",
    "provider is not enabled": "O login com Google ainda não está configurado neste ambiente.",
    "OAuth provider not supported": "Provedor de autenticação não configurado.",
    "A user with this email address has already been registered": "Já existe uma conta com este e-mail.",
    "email_address_not_authorized": "Este e-mail não está autorizado.",
    cancelled: "A entrada com Google foi cancelada.",
  };
  return map[message] ?? "Não foi possível concluir o acesso. Tente novamente.";
}
