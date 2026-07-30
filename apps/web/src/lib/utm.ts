// Captures UTM/referrer on the first landing hit and keeps it around for the
// rest of the session so it survives the / -> /precos -> /cadastro hop.
// No analytics provider needed for this — it's just sessionStorage.
const STORAGE_KEY = "radar-local:utm";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type UtmData = Partial<Record<(typeof UTM_PARAMS)[number], string>> & {
  referrer?: string;
};

export function captureUtm(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const found: UtmData = {};
  for (const key of UTM_PARAMS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }
  if (document.referrer && !document.referrer.includes(window.location.host)) {
    found.referrer = document.referrer;
  }
  if (Object.keys(found).length === 0) return;
  // First touch wins — don't overwrite an earlier campaign with a later
  // no-UTM internal navigation.
  if (sessionStorage.getItem(STORAGE_KEY)) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
}

export function readUtm(): UtmData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UtmData;
  } catch {
    return null;
  }
}
