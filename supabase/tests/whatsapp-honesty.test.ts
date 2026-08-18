import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Fase 6 — WhatsApp honesto. Regressão ESTÁTICA: 'verified' só pode ser gravado
// por validação real de provider externo. Enquanto WHATSAPP_VALIDATION não tiver
// provider, NENHUM caminho de scrape ou inferência pode marcar 'verified'.
//
// Limitação declarada: isto lê o TEXTO das funções, não executa. Não prova
// comportamento em runtime — prova que a regra não foi reintroduzida no código,
// que é o vetor real (foi assim que ela entrou nas duas vezes).

const read = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, "utf8");

describe("WhatsApp: 'verified' exige validação real (Fase 6)", () => {
  test("enrich-company grava 'possible' para número raspado, nunca 'verified'", () => {
    const src = read("../functions/_shared/enrich-company.ts");
    const bloco = src.slice(src.indexOf("found.whatsapp && !place.whatsapp"));
    const trecho = bloco.slice(0, 600);
    expect(trecho).toContain('whatsapp_status = "possible"');
    expect(trecho).not.toContain('whatsapp_status = "verified"');
  });

  test("import-search-results não marca 'verified' por scrape nem por móvel inferido", () => {
    const src = read("../functions/import-search-results/index.ts");
    const bloco = src.slice(src.indexOf("whatsapp_status:"));
    const trecho = bloco.slice(0, 400);
    expect(trecho).toContain('"possible"');
    expect(trecho).not.toContain('"verified"');
  });

  test("WHATSAPP_VALIDATION falha com motivo específico, não 'handler not implemented'", () => {
    const src = read("../functions/process-jobs/index.ts");
    expect(src).toContain("WHATSAPP_VALIDATION");
    expect(src).toContain("BLOCKED_EXTERNAL_CONFIGURATION");
  });

  test("o CHECK do banco continua com os 4 estados — a semântica mudou, o domínio não", () => {
    const mig = read("../migrations/20260817000021_whatsapp_possible_not_verified.sql");
    // A migration rebaixa dado histórico, mas NÃO pode estreitar o domínio:
    // 'verified' e 'invalid' seguem válidos para quando houver provider.
    expect(mig).not.toMatch(/drop\s+constraint/i);
    expect(mig).toContain("whatsapp_status = 'possible'");
  });
});
