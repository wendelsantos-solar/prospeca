import type { DiscoveryResult } from "@/repositories/types";
import { categoryLabel } from "./category";
import { whatsappDisplay } from "./whatsapp";

const DISCOVERY_HEADERS = [
  "Empresa",
  "Categoria",
  "Telefone",
  "WhatsApp",
  "E-mail",
  "Instagram",
  "Website",
  "Possui site",
  "Nota",
  "Avaliações",
  "Distância (km)",
  "Temperatura",
  "Score",
  "No funil",
];

/** CSV das empresas descobertas (não são leads ainda). */
export function exportDiscoveryCSV(results: DiscoveryResult[]) {
  const row = (r: DiscoveryResult) => [
    r.name,
    categoryLabel(r.category),
    r.phone ?? "",
    whatsappDisplay(r.whatsapp, r.phone)?.value ?? "",
    r.email ?? "",
    r.instagram ?? "",
    r.website ?? "",
    r.hasWebsite ? "Sim" : "Não",
    r.rating ?? "",
    r.reviewCount ?? "",
    r.distanceKm.toFixed(1),
    r.temperature,
    r.score,
    r.importedLeadId != null ? "Sim" : "Não",
  ];
  const rows = [
    DISCOVERY_HEADERS.join(","),
    ...results.map((r) => row(r).map(csvEscape).join(",")),
  ];
  download(
    "﻿" + rows.join("\n"),
    `radar-local-descoberta-${Date.now()}.csv`,
    "text/csv;charset=utf-8;",
  );
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
