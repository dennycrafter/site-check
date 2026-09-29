import type { PhotoAnalysis } from "./schema";
import { STEP_IDS, type StepId } from "./steps";
import type { ExtraStep, PanelSameWallAnswer, PhotoStatus, SetupType, SiteCheckStatus } from "./types";

export type PlanHome = {
  setup_type: SetupType;
  panel_same_wall_answer: PanelSameWallAnswer;
  /** Missing on inputs built before the whole-site check; treated as not run with no extras. */
  site_check_status?: SiteCheckStatus;
  extra_steps?: Pick<ExtraStep, "id">[];
};

export type PlanPhoto = {
  step: string;
  status: PhotoStatus;
  analysis: PhotoAnalysis | null;
  attempt?: number;
};

/** A regular StepId or an extra_<n> id from the whole-site check. */
export type NextStep = string | "question_5" | "site_check" | null;

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

/**
 * A fingerprint of the photo rows the rules depend on. Two reads with the same fingerprint would give
 * the same verdict, so a recompute can tell whether another request changed the photos under it.
 */
export function photosFingerprint(photos: { id: string; status: PhotoStatus }[]): string {
  return photos
    .map((p) => `${p.id}:${p.status}`)
    .sort()
    .join(",");
}

export function isFinished(status: PhotoStatus | undefined): boolean {
  return status !== undefined && FINISHED.includes(status);
}

const VOTING_SETUPS = ["separate_meter_and_panel_outdoors", "combo_meter_main_unit"] as const;

/**
 * Setup type comes from the finished meter_area_wide photo; only an accepted one is trusted.
 * Without it, the other accepted photos vote; a tie or no votes is "unknown".
 */
export function deriveSetupType(photos: PlanPhoto[]): SetupType {
  const finished = latestFinishedByStep(photos);
  const photo = finished.get("meter_area_wide");
  if (!photo || photo.status !== "accepted") return setupTypeByVote(finished);
  if (!photo.analysis) return "unknown";
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

function setupTypeByVote(finished: Map<string, PlanPhoto>): SetupType {
  const votes = { separate_meter_and_panel_outdoors: 0, combo_meter_main_unit: 0 };
  for (const [step, p] of finished) {
    if (step === "meter_area_wide" || p.status !== "accepted" || !p.analysis) continue;
    const value = p.analysis.setup_type;
    if ((VOTING_SETUPS as readonly string[]).includes(value)) votes[value as keyof typeof votes] += 1;
  }
  if (votes.separate_meter_and_panel_outdoors > votes.combo_meter_main_unit) return "separate_meter_and_panel_outdoors";
  if (votes.combo_meter_main_unit > votes.separate_meter_and_panel_outdoors) return "combo_meter_main_unit";
  return "unknown";
}

/**
 * A photo the homeowner kept after a retake request still has a real reading, so a fence
 * it shows counts too. Only retake photos (replaced by a later attempt) are ignored.
 */
const FENCE_TRUSTED: PhotoStatus[] = ["accepted", "accepted_after_max_attempts"];

export function regularSteps(home: PlanHome, photos: PlanPhoto[]): StepId[] {
  const fenceSeen = photos.some(
    (p) => FENCE_TRUSTED.includes(p.status) && FENCE_SOURCE_STEPS.includes(p.step) && p.analysis?.fence_present,
  );
  return STEP_IDS.filter((id) => {
    if (id === "behind_fence") return fenceSeen;
    if (id === "panel_wide" || id === "panel_open") return PANEL_WIDE_SETUPS.includes(home.setup_type);
    return true;
  });
}

/** Regular steps, then any extra steps the whole-site check asked for. */
export function planSteps(home: PlanHome, photos: PlanPhoto[]): string[] {
  return [...regularSteps(home, photos), ...(home.extra_steps ?? []).map((e) => e.id)];
}

export function nextStep(home: PlanHome, photos: PlanPhoto[]): NextStep {
  const latest = latestPhotoByStep(photos);
  for (const id of regularSteps(home, photos)) {
    if (
      id === "panel_wide" &&
      home.setup_type === "panel_indoors" &&
      home.panel_same_wall_answer === "not_asked"
    ) {
      return "question_5";
    }
    if (!isFinished(latest.get(id)?.status)) return id;
  }
  if ((home.site_check_status ?? "not_run") === "not_run") return "site_check";
  for (const extra of home.extra_steps ?? []) {
    if (!isFinished(latest.get(extra.id)?.status)) return extra.id;
  }
  return null;
}
