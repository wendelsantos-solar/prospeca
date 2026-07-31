import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Radar, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{ label: string; href?: string; to?: string }> = [
  { label: "Produto", href: "#produto" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Preços", to: "/precos" },
  { label: "Agências", to: "/para-agencias" },
  { label: "Perguntas", href: "#perguntas" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = useCallback(() => setOpen(false), []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors",
        scrolled
          ? "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          : "border-transparent bg-background",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Radar Local — Início">
          <Radar className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-tight text-foreground">
            Radar Local
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) =>
            "to" in item && item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/mapa">Ir para o aplicativo</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Entrar</Link>
              </Button>
              <Button
                size="sm"
                asChild
                onClick={() => track("hero_cta_clicked", { location: "header" })}
              >
                <Link to="/cadastro">Começar gratuitamente</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-background transition-all duration-200 md:hidden",
          open ? "max-h-[500px]" : "max-h-0 border-transparent",
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Navegação mobile">
          {NAV_ITEMS.map((item) =>
            "to" in item && item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-surface-hover"
                onClick={handleNavClick}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-surface-hover"
                onClick={handleNavClick}
              >
                {item.label}
              </a>
            ),
          )}
          <hr className="my-2 border-border" />
          {isAuthenticated ? (
            <Link
              to="/app/mapa"
              className="rounded-md px-3 py-2.5 text-sm font-medium text-primary hover:bg-surface-hover"
              onClick={handleNavClick}
            >
              Ir para o aplicativo
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-surface-hover"
                onClick={handleNavClick}
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                className="mt-1 flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                onClick={() => {
                  handleNavClick();
                  track("hero_cta_clicked", { location: "header_mobile" });
                }}
              >
                Começar gratuitamente
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
