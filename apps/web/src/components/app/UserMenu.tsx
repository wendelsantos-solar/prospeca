import { LogOut, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  className?: string;
}

/** Account avatar + dropdown: shows the signed-in e-mail, links to
 * Configurações, and is the only place a user can sign out. */
export function UserMenu({ className }: UserMenuProps) {
  const { user } = useAuth();
  const email = user?.email ?? null;
  const initial = email ? email[0]!.toUpperCase() : "?";

  const handleSignOut = async () => {
    if (!isDemoMode) {
      await getSupabase().auth.signOut();
    }
    window.location.href = "/";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-info-soft text-body-sm font-semibold text-info transition-colors hover:bg-info-soft/80",
          className,
        )}
        aria-label="Menu da conta"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {email && (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/app/configuracoes" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
