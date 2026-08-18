// Testa mutateLeadCaches — o helper que toda mutação otimista usa — contra os
// DOIS shapes de cache: paginado (useLeadsList) e infinite
// (useLeadsListInfinite). A regressão da 4b (invalidações na chave legada que
// não alcançavam o Kanban) não pode voltar: aqui o contrato é de cache REAL
// (QueryClient do TanStack), não de mock.

import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { mutateLeadCaches, leadKeys } from "./useLeadsQuery";
import type { Lead } from "@/types";

const lead = (id: string, stage: string) =>
  ({
    id,
    stage,
    companyName: `Lead ${id}`,
    category: "",
    city: "",
    score: 50,
    temperature: "warm",
    hasWebsite: false,
    discoveredAt: new Date().toISOString(),
    notes: [],
    activities: [],
    timeline: [],
  }) as unknown as Lead;

describe("mutateLeadCaches (otimismo nos dois shapes)", () => {
  test("shape paginado ({ items }) é atualizado", () => {
    const qc = new QueryClient();
    qc.setQueryData(leadKeys.list({ quick: [] }, "recent"), {
      items: [lead("a", "new")],
      total: 1,
      page: 1,
      pageSize: 50,
      hasMore: false,
    });
    mutateLeadCaches(qc, (items) =>
      items?.map((l) => (l.id === "a" ? { ...l, stage: "qualified" } : l)),
    );
    const cached = qc.getQueryData(leadKeys.list({ quick: [] }, "recent")) as {
      items: Lead[];
    };
    expect(cached.items[0].stage).toBe("qualified");
  });

  test("shape infinite ({ pages[].items }) é atualizado em todas as páginas", () => {
    const qc = new QueryClient();
    qc.setQueryData(leadKeys.infiniteList({ quick: [] }, "recent"), {
      pages: [
        { items: [lead("a", "new"), lead("b", "qualified")], page: 1 },
        { items: [lead("c", "new")], page: 2 },
      ],
      pageParams: [1, 2],
    });
    mutateLeadCaches(qc, (items) =>
      items?.map((l) => (l.id === "a" ? { ...l, stage: "contacted" } : l)),
    );
    const cached = qc.getQueryData(leadKeys.infiniteList({ quick: [] }, "recent")) as {
      pages: Array<{ items: Lead[] }>;
    };
    expect(cached.pages[0].items[0].stage).toBe("contacted");
    // Outras páginas intactas (mesma referência por página preservada).
    expect(cached.pages[1].items[0].stage).toBe("new");
  });

  test("prepend (addToFunnel) insere na primeira página do infinite", () => {
    const qc = new QueryClient();
    qc.setQueryData(leadKeys.infiniteList({ quick: [] }, "recent"), {
      pages: [{ items: [lead("a", "new")], page: 1 }],
      pageParams: [1],
    });
    const optimistic = lead("optimistic-p1", "new");
    mutateLeadCaches(qc, (items) => (items ? [optimistic, ...items] : items));
    const cached = qc.getQueryData(leadKeys.infiniteList({ quick: [] }, "recent")) as {
      pages: Array<{ items: Lead[] }>;
    };
    expect(cached.pages[0].items[0].id).toBe("optimistic-p1");
  });

  test("invalidação por leadKeys.all alcança o infinite (prefix match)", () => {
    // O que a 4b quebrou: invalidate com a chave legada não alcança o shape
    // infinite. leadKeys.all é prefixo de ambos.
    const qc = new QueryClient();
    qc.setQueryData(leadKeys.infiniteList({ quick: [] }, "recent"), {
      pages: [{ items: [lead("a", "new")], page: 1 }],
      pageParams: [1],
    });
    void qc.invalidateQueries({ queryKey: leadKeys.all });
    const state = qc.getQueryState(leadKeys.infiniteList({ quick: [] }, "recent"));
    // invalidated (isInvalidated true) → refetch iminente; a CHAVE foi alcançada.
    expect(state?.isInvalidated).toBe(true);
  });
});
