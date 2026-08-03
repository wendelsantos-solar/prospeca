const ACTIVE_ORG_STORAGE_KEY = "radar.activeOrganizationId";

export function getStoredActiveOrganizationId(): string | null {
  try {
    return globalThis.localStorage?.getItem(ACTIVE_ORG_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setActiveOrganizationId(organizationId: string): void {
  try {
    globalThis.localStorage?.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId);
  } catch {
    // The deterministic first membership remains the fallback without storage.
  }
}
