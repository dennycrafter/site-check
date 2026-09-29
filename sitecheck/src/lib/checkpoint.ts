import { isStepId, PHASE_TITLES, phaseOf, type Phase } from "./steps";
import type { PhotoStatus } from "./types";

/** What one row of a phase checkpoint shows. */
export type CheckpointRow =
  | { kind: "checking" }
  | { kind: "accepted"; saw: string }
  | { kind: "retake"; message: string }
  /** The request itself failed (network error, no response), or the server has no photo for the step. */
  | { kind: "failed" }
  /** check_failed or accepted_after_max_attempts: fine to send, a person looks at it. */
  | { kind: "surveyor" };

export const SENT_FAILED_MESSAGE = "This photo didn't send.";
export const SURVEYOR_MESSAGE = "A surveyor will check this one.";

export function rowFromResult(status: PhotoStatus | "pending", saw: string | undefined, message: string | undefined): CheckpointRow {
  if (status === "accepted") return { kind: "accepted", saw: saw ?? "Got it." };
  if (status === "retake") return { kind: "retake", message: message ?? "Let's try that photo again." };
  if (status === "check_failed" || status === "accepted_after_max_attempts") return { kind: "surveyor" };
  return { kind: "failed" };
}

export function needsFix(row: CheckpointRow): boolean {
  return row.kind === "retake" || row.kind === "failed";
}

export function checkpointState(phase: Phase, rows: CheckpointRow[]) {
  const pending = rows.filter((row) => row.kind === "checking").length;
  const fixes = rows.filter(needsFix).length;
  const title =
    pending > 0
      ? "Checking your photos"
      : fixes === 1
        ? "1 quick fix"
        : fixes > 1
          ? `${fixes} quick fixes`
          : `${PHASE_TITLES[phase]}: done`;
  return { pending, fixes, title, settled: pending === 0 && fixes === 0 };
}

/**
 * After a phase settles, the server's next step may still belong to that phase (behind_fence appears
 * only once a fence is seen). That step is opened from the checkpoint; anything else moves on.
 */
export function followUpStep(nextStep: string | null, phase: Phase): string | null {
  return nextStep && isStepId(nextStep) && phaseOf(nextStep) === phase ? nextStep : null;
}
