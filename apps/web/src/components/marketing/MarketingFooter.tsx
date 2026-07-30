import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { SalesContactForm } from "./SalesContactForm";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold tracking-tight">Radar Local</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Inteligência comercial local para prospecção B2B.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Produto
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/#recursos" className="text-muted-foreground hover:text-foreground">
                  Recursos
                </a>
              </li>
              <li>
                <Link to="/precos" className="text-muted-foreground hover:text-foreground">
                  Preços
                </Link>
              </li>
              <li>
                <a href="/#como-funciona" className="text-muted-foreground hover:text-foreground">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="/#agencias" className="text-muted-foreground hover:text-foreground">
                  Para agências
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Empresa
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <SalesContactForm
                  source="footer"
                  trigger={
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      Contato
                    </button>
                  }
                />
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acesso
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground">
                  Entrar
                </Link>
              </li>
              <li>
                <Link to="/cadastro" className="text-muted-foreground hover:text-foreground">
                  Criar conta
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Radar Local. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
