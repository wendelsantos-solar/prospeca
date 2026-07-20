import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { integrationStatuses, isRealMode } from "@/lib/env";
import { invokeFunction, supabaseAvailable, getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/configuracoes")({
  component: SettingsPage,
});

interface TestResult {
  name: string;
  ok: boolean;
  latencyMs: number;
  message: string;
}

function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const statuses = integrationStatuses();

  async function runTests() {
    if (!supabaseAvailable()) {
      toast.error("Supabase não configurado — testes indisponíveis em modo demo.");
      return;
    }
    setTesting(true);
    const out: TestResult[] = [];

    // Auth + database
    const t0 = performance.now();
    try {
      const { error } = await getSupabase().from("organization_members").select("id").limit(1);
      out.push({
        name: "Banco de dados (RLS)",
        ok: !error,
        latencyMs: Math.round(performance.now() - t0),
        message: error ? "Falha na consulta" : "Conectado",
      });
    } catch {
      out.push({
        name: "Banco de dados (RLS)",
        ok: false,
        latencyMs: Math.round(performance.now() - t0),
        message: "Sem conexão",
      });
    }

    // Geocoding via edge function
    const t1 = performance.now();
    try {
      await invokeFunction("geocode-location", { query: "São Paulo, SP" });
      out.push({
        name: "Geocodificação (Edge Function)",
        ok: true,
        latencyMs: Math.round(performance.now() - t1),
        message: "OK",
      });
    } catch (err) {
      out.push({
        name: "Geocodificação (Edge Function)",
        ok: false,
        latencyMs: Math.round(performance.now() - t1),
        message: err instanceof Error ? err.message : "Falha",
      });
    }

    setResults(out);
    setTesting(false);
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Configurações — Integrações</h1>
          <p className="text-sm text-muted-foreground">
            Status das integrações externas. Chaves nunca são exibidas.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das integrações</CardTitle>
            <CardDescription>Configuração detectada no ambiente atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statuses.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {s.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <Badge variant={s.configured ? "secondary" : "destructive"}>{s.detail}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Testar conexões</CardTitle>
            <CardDescription>
              Executa verificações reais (banco e geocodificação de teste).
              {!isRealMode && " Disponível apenas em modo real."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={runTests} disabled={testing || !isRealMode}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar conexão
            </Button>
            {results.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {r.name}
                </div>
                <span className="text-muted-foreground">
                  {r.message} · {r.latencyMs}ms
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
