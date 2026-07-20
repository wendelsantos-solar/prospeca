import { STORAGE_KEY } from "./constants";

const VERSION = 1;

export function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${key}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { v: number; data: T };
    if (parsed.v !== VERSION) return fallback;
    return parsed.data;
  } catch {
    return fallback;
  }
}

export function saveState<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${key}`, JSON.stringify({ v: VERSION, data }));
  } catch {
    /* ignore */
  }
}

export function clearAllState() {
  if (typeof window === "undefined") return;
  const prefix = `${STORAGE_KEY}:`;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => window.localStorage.removeItem(k));
}
