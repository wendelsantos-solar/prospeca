// Hook to manage onboarding state in the app.
// Separated from the component to avoid fast-refresh warnings.

const STORAGE_KEY = "rl-onboarding-progress";

export interface OnboardingProgress {
  step: number;
  completed: boolean;
  skippedSteps: string[];
}

export function loadOnboardingProgress(): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(progress: OnboardingProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // best-effort
  }
}

export function useOnboarding() {
  const progress = loadOnboardingProgress();
  return {
    progress,
    isCompleted: progress?.completed ?? false,
    currentStep: progress?.step ?? 0,
    /** Clear onboarding progress (for testing). */
    reset: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // best-effort
      }
    },
  };
}
