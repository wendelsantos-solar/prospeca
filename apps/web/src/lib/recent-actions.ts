// Tracks recent user actions in sessionStorage for feedback context.
// Import pushRecentAction in any component where a meaningful user action
// happens (search, import, export, stage change, etc.).

const STORAGE_KEY = "feedback:recent_actions";
const MAX_ACTIONS = 10;

/** Record a user action for feedback context. Call this in onSuccess handlers. */
export function pushRecentAction(action: string): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    list.push(action);
    if (list.length > MAX_ACTIONS) list.shift();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // sessionStorage unavailable — noop
  }
}

/** Get the last N user actions (most recent first). */
export function getRecentActions(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
