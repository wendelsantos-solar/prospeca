import { Component, type ReactNode, type ErrorInfo } from "react";
import { captureClientError } from "@/lib/error-capture";

interface Props {
  children: ReactNode;
  /** Component tree identifier — helps locate the error in the dashboard. */
  location?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * React Error Boundary — captura erros de renderização e os reporta
 * para `error_events` via Supabase (anon key, RLS com policy de INSERT).
 *
 * O fallback é mínimo e não interativo de propósito: se a árvore quebrou,
 * renderizar UI complexa pode quebrar de novo. Só oferece reload.
 *
 * NÃO captura erros em:
 *   - Event handlers (onClick, onSubmit, etc.)
 *   - Código assíncrono (setTimeout, Promises)
 *   - Server-side rendering
 * Para esses, use `captureClientError()` diretamente.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || "Erro inesperado",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? undefined;

    captureClientError(error, {
      location: this.props.location ?? "ErrorBoundary",
      context: {
        componentStack: componentStack?.split("\n").slice(0, 8).join("\n"),
      },
    });

    // Também loga no console para debugging local.
    console.error("[ErrorBoundary]", error, componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback message={this.state.errorMessage} />;
    }

    return this.props.children;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">Algo deu errado</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Um erro inesperado aconteceu nesta seção. O restante da aplicação continua funcional.
        </p>
        {message && (
          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface p-2 text-left text-xs text-muted-foreground">
              {message}
            </pre>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}
