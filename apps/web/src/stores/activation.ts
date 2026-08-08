import { create } from "zustand";
import type { ActivationMilestones } from "@/lib/account";
import { track } from "@/lib/analytics";

export type ActivationMilestone = keyof ActivationMilestones;

export const EMPTY_ACTIVATION_MILESTONES: ActivationMilestones = {
  firstSearch: false,
  firstLeadViewed: false,
  firstLeadAdded: false,
  firstMessagePrepared: false,
};

const EVENT_BY_MILESTONE: Record<ActivationMilestone, Parameters<typeof track>[0]> = {
  firstSearch: "first_search_completed",
  firstLeadViewed: "first_lead_viewed",
  firstLeadAdded: "first_lead_added_to_pipeline",
  firstMessagePrepared: "first_message_prepared",
};

interface ActivationState {
  milestones: ActivationMilestones;
  hydrated: boolean;
  persist: ((milestones: ActivationMilestones) => void) | null;
  configure: (
    milestones: Partial<ActivationMilestones> | undefined,
    persist: (milestones: ActivationMilestones) => void,
  ) => void;
  mark: (milestone: ActivationMilestone, metadata?: Record<string, unknown>) => void;
}

export const useActivationStore = create<ActivationState>()((set, get) => ({
  milestones: EMPTY_ACTIVATION_MILESTONES,
  hydrated: false,
  persist: null,
  configure: (milestones, persist) =>
    set((state) => ({
      hydrated: true,
      persist,
      milestones: {
        firstSearch: state.milestones.firstSearch || !!milestones?.firstSearch,
        firstLeadViewed: state.milestones.firstLeadViewed || !!milestones?.firstLeadViewed,
        firstLeadAdded: state.milestones.firstLeadAdded || !!milestones?.firstLeadAdded,
        firstMessagePrepared:
          state.milestones.firstMessagePrepared || !!milestones?.firstMessagePrepared,
      },
    })),
  mark: (milestone, metadata) => {
    const state = get();
    if (state.milestones[milestone]) return;
    const milestones = { ...state.milestones, [milestone]: true };
    set({ milestones });
    track(EVENT_BY_MILESTONE[milestone], metadata);
    state.persist?.(milestones);
  },
}));
