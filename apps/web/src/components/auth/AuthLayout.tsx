import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthProductPreview } from "./AuthProductPreview";

interface AuthLayoutProps { children: ReactNode; title: string; description: string; footer?: ReactNode; topBanner?: ReactNode; className?: string; }

export function AuthLayout({ children, title, description, footer, topBanner, className }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="flex w-full flex-col justify-center px-4 py-8 md:w-[42%] md:min-w-[440px] md:max-w-[500px] md:px-10 lg:px-14">
        <div className="mb-8 flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg p-1 -ml-1 hover:bg-surface-hover transition-colors" aria-label="Voltar para página inicial">
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-card"><Radar className="h-[18px] w-[18px]" strokeWidth={2} /></div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">Radar Local</span>
          </Link>
        </div>
        <div className="w-full max-w-[400px]">
          {topBanner && <div className="mb-5">{topBanner}</div>}
          <div className={cn("rounded-[16px] border border-border bg-surface p-6 shadow-elegant sm:p-8", className)}>
            <div className="mb-6"><h1 className="text-page-title font-semibold text-foreground tracking-tight">{title}</h1><p className="mt-1.5 text-body-sm text-muted-foreground">{description}</p></div>
            {children}
          </div>
          {footer && <div className="mt-5 text-center text-body-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="mt-6 max-w-[400px] text-caption text-muted-foreground/70 text-center">
          Ao continuar, você concorda com os{" "}<a href="/termos" className="underline underline-offset-2 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">Termos de Uso</a>{" "}e a{" "}<a href="/privacidade" className="underline underline-offset-2 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
        </p>
      </div>
      <div className="hidden md:flex md:w-[58%] relative"><AuthProductPreview /></div>
    </div>
  );
}
