import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseAvailable } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** Demo mode has no real auth — treated as authenticated. */
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: !isDemoMode,
    session: null,
    user: null,
    isAuthenticated: isDemoMode,
  });

  useEffect(() => {
    if (isDemoMode || !supabaseAvailable()) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setState({
        loading: false,
        session: data.session,
        user: data.session?.user ?? null,
        isAuthenticated: !!data.session,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        loading: false,
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
      });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}

export async function getSessionOrNull(): Promise<Session | null> {
  if (isDemoMode || !supabaseAvailable()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(traduzErroAuth(error.message));
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  companyName: string,
) {
  const { error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, company_name: companyName } },
  });
  if (error) throw new Error(traduzErroAuth(error.message));
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) throw new Error(traduzErroAuth(error.message));
}

export async function updatePassword(newPassword: string) {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw new Error(traduzErroAuth(error.message));
}

function traduzErroAuth(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha inválidos.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
    "User already registered": "Este e-mail já está cadastrado.",
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  };
  return map[message] ?? "Falha na autenticação. Tente novamente.";
}
