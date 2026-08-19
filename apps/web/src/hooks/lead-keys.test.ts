// P1-a (gate Fase 4b): colisão de query key entre useQuery e useInfiniteQuery.
// Antes, os dois hooks compartilhavam ["leads","list",filters,sort] — o
// TanStack tratava como UMA entrada de cache e o shape paginado sobrescrevia o
// de páginas (ou vice-versa). Este teste fixa a separação como invariante.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { leadKeys } from "./useLeadsQuery";
import type { LeadFilters } from "@/types";

describe("leadKeys (sem colisão de cache entre useQuery e useInfiniteQuery)", () => {
  const filters: LeadFilters = { quick: [], stages: ["new"], minScore: 50 };

  test("chaves de list (useQuery) e infiniteList (useInfiniteQuery) são distintas", () => {
    const listKey = JSON.stringify(leadKeys.list(filters, "recent"));
    const infiniteKey = JSON.stringify(leadKeys.infiniteList(filters, "recent"));
    expect(listKey).not.toBe(infiniteKey);
  });

  test("nenhuma outra chave colide com infiniteList para os mesmos filtros", () => {
    const keys = new Set([
      JSON.stringify(leadKeys.list(filters, "recent")),
      JSON.stringify(leadKeys.infiniteList(filters, "recent")),
      JSON.stringify(leadKeys.stageCounts),
      JSON.stringify(leadKeys.todayCounts),
      JSON.stringify(leadKeys.all),
    ]);
    expect(keys.size).toBe(5);
  });

  test("infiniteList preserva filtro e sort na chave (invalidação correta)", () => {
    const a = JSON.stringify(leadKeys.infiniteList(filters, "recent"));
    const b = JSON.stringify(leadKeys.infiniteList(filters, "score-desc"));
    const c = JSON.stringify(leadKeys.infiniteList({ quick: [] }, "recent"));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  test("nenhum uso legado de ['leads','list'] resta nos hooks (P1 da Fase 4c)", () => {
    // A 4b deu chave própria ao infinite, mas 9 invalidações continuaram na
    // chave legada — o Kanban parou de atualizar. Este teste varre os arquivos
    // de hooks por QUALQUER uso literal da chave legada (a definição em
    // leadKeys.list usa o literal com sufixo `filters, sort` e não casa).
    const files = [
      resolve(__dirname, "./useLeadsQuery.ts"),
      resolve(__dirname, "./useSearchMutation.ts"),
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line: string, i: number) => {
        // Uso literal como queryKey (não a definição com `filters, sort`).
        if (/\["leads", "list"\]/.test(line) && !/filters/.test(line)) {
          offenders.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
