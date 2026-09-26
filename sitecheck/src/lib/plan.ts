import type { PhotoAnalysis } from "./schema";
import { STEP_IDS, type StepId } from "./steps";
import type { PanelSameWallAnswer, PhotoStatus, SetupType } from "./types";

export type PlanHome = {
  setup_type: SetupType;
  panel_same_wall_answer: PanelSameWallAnswer;
};

export type PlanPhoto = {
  step: string;
  status: PhotoStatus;
  analysis: PhotoAnalysis | null;
  attempt?: number;
};

export type NextStep = StepId | "question_5" | null;

const FINISHED: PhotoStatus[] = ["accepted", "check_failed", "accepted_after_max_attempts"];
const FENCE_SOURCE_STEPS: string[] = ["meter_area_wide", "left_of_meter", "right_of_meter"];
const PANEL_WIDE_SETUPS: SetupType[] = [
  "separate_meter_and_panel_outdoors",
  "panel_indoors",
  "unknown",
];

/** Highest attempt wins; on ties (or no attempt numbers) the later array item wins. */
export function latestPhotoByStep<T extends PlanPhoto>(photos: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const photo of photos) {
    const current = latest.get(photo.step);
    if (!current || (photo.attempt ?? 0) >= (current.attempt ?? 0)) latest.set(photo.step, photo);
  }
  return latest;
}

/** Latest photo per step whose status is not "retake". Steps with only retakes are absent. */
export function latestFinishedByStep<T extends PlanPhoto>(photos: T[]): Map<string, T> {
  return latestPhotoByStep(photos.filter((p) => p.status !== "retake"));
}

export function isFinished(status: PhotoStatus | undefined): boolean {
  return status !== undefined && FINISHED.includes(status);
}

/** Setup type comes from the finished meter_area_wide photo; only an accepted one is trusted. */
export function deriveSetupType(photos: PlanPhoto[]): SetupType {
  const photo = latestFinishedByStep(photos).get("meter_area_wide");
  if (!photo || photo.status !== "accepted" || !photo.analysis) return "unknown";
  switch (photo.analysis.setup_type) {
    case "separate_meter_and_panel_outdoors":
      return "separate_meter_and_panel_outdoors";
    case "combo_meter_main_unit":
      return "combo_meter_main_unit";
    case "panel_not_visible":
      return "panel_indoors";
    default:
      return "unknown";
  }
}

export function planSteps(home: PlanHome, photos: PlanPhoto[]): StepId[] {
  const fenceSeen = photos.some(
    (p) => p.status === "accepted" && FENCE_SOURCE_STEPS.includes(p.step) && p.analysis?.fence_present,
  );
  return STEP_IDS.filter((id) => {
    if (id === "behind_fence") return fenceSeen;
    if (id === "panel_wide") return PANEL_WIDE_SETUPS.includes(home.setup_type);
    return true;
  });
}

export function nextStep(home: PlanHome, photos: PlanPhoto[]): NextStep {
  const latest = latestPhotoByStep(photos);
  for (const id of planSteps(home, photos)) {
    if (
      id === "panel_wide" &&
      home.setup_type === "panel_indoors" &&
      home.panel_same_wall_answer === "not_asked"
    ) {
      return "question_5";
    }
    if (!isFinished(latest.get(id)?.status)) return id;
  }
  return null;
}
