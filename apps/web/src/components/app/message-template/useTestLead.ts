import { useState } from "react";
import { useLeadsStore, useSettingsStore } from "@/stores";
import { categoryLabel } from "@/lib/category";

type Lead = ReturnType<typeof useLeadsStore.getState>["leads"][number];

const LEAD_SKELETON_MS = 220;

function resolveFromLead(name: string, lead: Lead | null): string | null {
  switch (name) {
    case "empresa":
      return lead?.companyName ?? null;
    case "categoria":
      return lead?.category ? categoryLabel(lead.category) : null;
    case "cidade":
      return lead?.city ?? null;
    case "bairro":
      return lead?.neighborhood ?? null;
    case "telefone":
      return lead?.phone ?? null;
    case "instagram":
      return lead?.instagram ?? null;
    case "website":
      return lead?.website ?? null;
    default:
      return null;
  }
}

const FALLBACKS: Record<string, string> = {
  empresa: "Clínica Nova Vida",
  categoria: "Clínica médica",
  cidade: "Porto Alegre",
  bairro: "Moinhos de Vento",
  telefone: "(51) 99999-0000",
  instagram: "@clinicanovavida",
  website: "clinicanovavida.com.br",
  responsavel: "Carla",
  meu_nome: "João",
  minha_empresa: "Radar Local",
  telefone_remetente: "(51) 3333-4444",
  site_remetente: "radarlocal.com.br",
  assinatura: "Radar Local — leads qualificados todos os dias.",
};

export function useTestLead() {
  const leads = useLeadsStore((s) => s.leads);
  const userName = useSettingsStore((s) => s.userName);
  const companyName = useSettingsStore((s) => s.companyName);
  const signature = useSettingsStore((s) => s.signature);
  const [testLeadIndex, setTestLeadIndexRaw] = useState(0);
  const [dataMode, setDataMode] = useState<"real" | "missing">("real");
  const [switching, setSwitching] = useState(false);

  const testLead = leads.length > 0 ? leads[testLeadIndex % leads.length] : null;

  const setTestLeadIndex = (updater: number | ((i: number) => number)) => {
    setSwitching(true);
    setTestLeadIndexRaw(updater);
    window.setTimeout(() => setSwitching(false), LEAD_SKELETON_MS);
  };

  const resolveVar = (name: string): { value: string; hasRealData: boolean } => {
    if (name === "meu_nome") {
      const v = userName.trim();
      return v
        ? { value: v, hasRealData: true }
        : { value: FALLBACKS.meu_nome, hasRealData: false };
    }
    if (name === "minha_empresa") {
      const v = companyName.trim();
      return v
        ? { value: v, hasRealData: true }
        : { value: FALLBACKS.minha_empresa, hasRealData: false };
    }
    if (name === "assinatura") {
      const v = signature.trim();
      return v
        ? { value: v, hasRealData: true }
        : { value: FALLBACKS.assinatura, hasRealData: false };
    }
    const real = resolveFromLead(name, testLead);
    if (real) return { value: real, hasRealData: true };
    return { value: FALLBACKS[name] ?? `{{${name}}}`, hasRealData: false };
  };

  return {
    leads,
    testLead,
    testLeadIndex,
    setTestLeadIndex,
    dataMode,
    setDataMode,
    switching,
    resolveVar,
  };
}
