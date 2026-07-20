// Centralized environment + feature flags. Components never read
// import.meta.env directly — everything flows through here.

export type DataMode = "real" | "demo";

export interface FeatureFlags {
  realSearch: boolean;
  websiteEnrichment: boolean;
  externalEnrichment: boolean;
  bulkPreparation: boolean;
  xlsxExport: boolean;
  realtimeSearchProgress: boolean;
}

interface Env {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  googleMapsBrowserKey: string | undefined;
  dataMode: DataMode;
}

function readEnv(): Env {
  const rawMode = import.meta.env.VITE_DATA_MODE as string | undefined;
  const dataMode: DataMode = rawMode === "real" ? "real" : "demo";
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
    googleMapsBrowserKey: import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined,
    dataMode,
  };
}

export const env = readEnv();

export const isRealMode = env.dataMode === "real";
export const isDemoMode = env.dataMode === "demo";

/** True when real mode is requested but required config is missing. */
export function realConfigMissing(): string[] {
  if (!isRealMode) return [];
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!env.supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  return missing;
}

export const featureFlags: FeatureFlags = {
  realSearch: isRealMode,
  websiteEnrichment: false,
  externalEnrichment: false,
  bulkPreparation: true,
  xlsxExport: false,
  realtimeSearchProgress: isRealMode,
};

export interface IntegrationStatus {
  name: string;
  configured: boolean;
  detail: string;
}

/** Non-secret configuration snapshot for the diagnostics page. */
export function integrationStatuses(): IntegrationStatus[] {
  return [
    {
      name: "Supabase",
      configured: !!env.supabaseUrl && !!env.supabaseAnonKey,
      detail: env.supabaseUrl ? "URL configurada" : "VITE_SUPABASE_URL ausente",
    },
    {
      name: "Google Maps (browser)",
      configured: !!env.googleMapsBrowserKey,
      detail: env.googleMapsBrowserKey
        ? "Chave de navegador configurada"
        : "VITE_GOOGLE_MAPS_BROWSER_KEY ausente",
    },
    {
      name: "Google Places (server)",
      configured: isRealMode,
      detail: isRealMode ? "Validado via Edge Function (teste de conexão)" : "Somente em modo real",
    },
    {
      name: "Modo de dados",
      configured: true,
      detail: env.dataMode === "real" ? "real" : "demo (dados fictícios)",
    },
  ];
}
