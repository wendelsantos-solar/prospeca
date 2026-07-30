import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Radar, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const NAV = [
  { label: "Produto", href: "#produto" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Para quem é", href: "#para-quem" },
  { label: "Preços", to: "/precos" as const },
  { label: "Recursos", href: "#recursos" },
  { label: "Perguntas", href: "#perguntas" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-tight">Radar Local</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
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
        </div>

        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md text-foreground md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV.map((item) =>
              item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-sm text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="outline" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button
              asChild
              onClick={() => track("hero_cta_clicked", { location: "header_mobile" })}
            >
              <Link to="/cadastro">Começar gratuitamente</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
