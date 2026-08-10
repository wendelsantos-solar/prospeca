// Hook to manage onboarding state in the app.
// Separated from the component to avoid fast-refresh warnings.
//
// Real mode: persisted on the user's profile row (survives across devices).
// Demo mode: localStorage only — there's no backend to write to.
import { useEffect, useRef, useState, useCallback } from "react";
import { isDemoMode } from "@/lib/env";
import {
  fetchOnboardingProgress,
  mergeOnboardingProgress,
  saveOnboardingProgress as saveOnboardingProgressRemote,
  type OnboardingProgress,
} from "@/lib/account";

export type { OnboardingProgress };

const STORAGE_KEY = "rl-onboarding-progress";

function loadLocal(): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocal(progress: OnboardingProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // best-effort
  }
}

export function useOnboarding() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(() =>
    isDemoMode ? loadLocal() : null,
  );
  // Demo mode reads localStorage synchronously — nothing to await.
  const [loaded, setLoaded] = useState(isDemoMode);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;
    fetchOnboardingProgress()
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((next: OnboardingProgress) => {
    const current = progressRef.current;
    const merged = mergeOnboardingProgress(current, next);
    progressRef.current = merged;
    setProgress(merged);
    if (isDemoMode) saveLocal(merged);
    else void saveOnboardingProgressRemote(merged);
  }, []);

  return {
    progress,
    /** False until real-mode's initial fetch resolves — gate rendering the
     * wizard on this so a not-yet-loaded state doesn't flash it open. */
    loaded,
    isCompleted: progress?.completed ?? false,
    save,
  };
}
