import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";

/** True se o usuário atual é super-admin de plataforma (vê o painel admin). */
export function useIsPlatformAdmin(): boolean {
  const { data } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("is_platform_admin");
      if (error) return false;
      return data === true;
    },
    enabled: isRealMode,
    staleTime: 5 * 60_000,
  });
  return data === true;
}
