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
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = useCallback(() => setOpen(false), []);

  return (
    <header
      className={cn(
        "fixed left-1/2 top-3 z-50 w-[calc(100%-24px)] max-w-[1100px] -translate-x-1/2 rounded-2xl border transition-all duration-350",
        scrolled
          ? "border-border/60 bg-white/92 shadow-elevated backdrop-blur-lg"
          : "border-border/40 bg-white/85 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-[50px] items-center justify-between px-4 md:px-5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Prospeca — Início">
          <LogoMark className="h-5 w-5 text-primary" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Prospeca</span>
        </Link>

        {/* Desktop nav — centered */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) =>
            "to" in item && item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-full px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        {/* Desktop buttons */}
        <div className="hidden items-center gap-1.5 md:flex">
          {isAuthenticated ? (
            <Button variant="ghost" size="sm" className="h-8 text-[13px]" asChild>
              <Link to="/app/mapa">Ir para o app</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-8 text-[13px]" asChild>
                <Link to="/login">Entrar</Link>
              </Button>
              <Button
                size="sm"
                className="h-8 px-4 text-[13px]"
                asChild
                onClick={() => track("hero_cta_clicked", { location: "header" })}
              >
                <Link to="/cadastro">Criar conta grátis</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "overflow-hidden rounded-b-2xl border-t border-border bg-white transition-all duration-300 md:hidden",
          open ? "max-h-[480px]" : "max-h-0 border-transparent",
        )}
      >
        <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Navegação mobile">
          {NAV_ITEMS.map((item) =>
            "to" in item && item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-lg px-3 py-2.5 text-[14px] text-foreground hover:bg-surface-hover"
                onClick={handleNavClick}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-[14px] text-foreground hover:bg-surface-hover"
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
              className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-primary hover:bg-surface-hover"
              onClick={handleNavClick}
            >
              Ir para o aplicativo
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2.5 text-[14px] text-foreground hover:bg-surface-hover"
                onClick={handleNavClick}
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                className="mt-1 flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover"
                onClick={() => {
                  handleNavClick();
                  track("hero_cta_clicked", { location: "header_mobile" });
                }}
              >
                Criar conta grátis
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
