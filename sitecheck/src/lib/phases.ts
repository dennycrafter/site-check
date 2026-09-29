import { isExtraStepId, isStepId, PHASE_COUNT, phaseOf, type Phase } from "./steps";
import type { PhotoStatus } from "./types";

/** "sent" is a photo taken inside a phase whose check has not come back yet. It counts as done for the bar. */
export type ShotStatus = PhotoStatus | "pending" | "sent";

const DONE: ShotStatus[] = ["accepted", "check_failed", "accepted_after_max_attempts", "sent"];

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

/** The bar: earlier phases full, the current one filled by its done planned photos over Z, later ones empty. */
export function phaseSegments(
  phase: Phase,
  planned: string[],
  statusOf: (id: string) => ShotStatus,
  redo = false,
): number[] {
  const done = planned.filter((id) => DONE.includes(statusOf(id))).length;
  return Array.from({ length: PHASE_COUNT }, (_, i) => {
    const number = i + 1;
    if (redo || number < phase) return 1;
    if (number > phase) return 0;
    return planned.length === 0 ? 0 : Math.min(done, planned.length) / planned.length;
  });
}

export function phaseProgress(
  stepId: string,
  planned: string[],
  statusOf: (id: string) => ShotStatus,
  redo = false,
): PhaseProgress {
  const phase = phaseOf(stepId);
  const index = planned.indexOf(stepId);
  const extra = index === -1;
  const photoCount = planned.length;
  const segments = phaseSegments(phase, planned, statusOf, redo);
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
