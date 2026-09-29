import { isExtraStepId, isStepId, PHASE_COUNT, phaseOf, type Phase } from "./steps";
import type { PhotoStatus } from "./types";

const FINISHED: Array<PhotoStatus | "pending"> = ["accepted", "check_failed", "accepted_after_max_attempts"];

/**
 * The photos planned for a phase at the moment it starts: the regular steps that phase has in the
 * home's current plan. Freeze the result when the phase starts, so a step that only shows up later
 * (like behind_fence) never changes the count.
 */
export function plannedForPhase(planStepIds: string[], phase: Phase): string[] {
  return planStepIds.filter((id) => isStepId(id) && phaseOf(id) === phase);
}

export type PhaseProgress = {
  phase: Phase;
  part: number;
  partCount: number;
  /** Position within the planned photos. An extra photo keeps the last position, so it never passes photoCount. */
  photo: number;
  photoCount: number;
  /** A photo that was not planned when the phase started. */
  extra: boolean;
  /** One fill value from 0 to 1 per phase. Only ever grows as the homeowner moves forward. */
  segments: number[];
};

export function phaseProgress(
  stepId: string,
  planned: string[],
  statusOf: (id: string) => PhotoStatus | "pending",
  redo = false,
): PhaseProgress {
  const phase = phaseOf(stepId);
  const index = planned.indexOf(stepId);
  const extra = index === -1;
  const photoCount = planned.length;
  const finished = planned.filter((id) => FINISHED.includes(statusOf(id))).length;
  const segments = Array.from({ length: PHASE_COUNT }, (_, i) => {
    const number = i + 1;
    if (redo || number < phase) return 1;
    if (number > phase) return 0;
    return photoCount === 0 ? 0 : Math.min(finished, photoCount) / photoCount;
  });
  return {
    phase,
    part: phase,
    partCount: PHASE_COUNT,
    photo: extra ? photoCount : index + 1,
    photoCount,
    extra,
    segments,
  };
}

/** What to call a step on the capture page. Photos that were not planned are labeled as extras. */
export function stepLabel(stepId: string, title: string, extra: boolean): string {
  if (!extra) return title;
  return isExtraStepId(stepId) ? "One extra photo" : `One extra photo: ${title}`;
}
