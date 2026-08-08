import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/shared/LogoMark";

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
        "fixed left-1/2 top-3 z-40 w-[calc(100%-24px)] max-w-7xl -translate-x-1/2 rounded-2xl border transition-all duration-300",
        scrolled
          ? "border-border bg-surface/85 shadow-elevated backdrop-blur-lg supports-[backdrop-filter]:bg-surface/75"
          : "border-border/60 bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70",
      )}
    >
      <div className="mx-auto flex h-14 items-center justify-between px-4 md:px-5">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Prospeca — Início">
          <LogoMark className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-tight text-foreground">Prospeca</span>
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
              <SalesContactForm
                source="header"
                trigger={
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Falar com vendas
                  </Button>
                }
              />
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
          "overflow-hidden rounded-b-2xl border-t border-border bg-surface transition-all duration-300 md:hidden",
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
