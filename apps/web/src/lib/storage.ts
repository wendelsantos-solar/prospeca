import { STORAGE_KEY } from "./constants";

export function clearAllState() {
  if (typeof window === "undefined") return;
  const prefix = `${STORAGE_KEY}:`;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => window.localStorage.removeItem(k));
}
