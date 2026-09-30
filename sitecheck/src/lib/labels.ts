import type { AnalysisField, PhotoAnalysis } from "./schema";
import type { PhotoStatus, SetupType, SurveyorDecision } from "./types";

export const SETUP_LABELS: Record<SetupType, string> = {
  separate_meter_and_panel_outdoors: "Meter and separate breaker box, both outdoors",
  combo_meter_main_unit: "All-in-one meter and main breaker unit",
  panel_indoors: "Breaker box indoors",
  unknown: "Not determined yet",
};

export const DECISION_LABELS: Record<SurveyorDecision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  needs_site_visit: "Needs site visit",
};

export const PHOTO_STATUS_LABELS: Record<PhotoStatus | "pending", string> = {
  accepted: "Accepted",
  retake: "Retake requested",
  check_failed: "Automatic check failed",
  accepted_after_max_attempts: "Kept for review",
  pending: "Not taken yet",
};

/** Shown instead of "Kept for review" once the surveyor corrected a reading on the photo. */
export const CONFIRMED_BY_SURVEYOR = "Confirmed by surveyor";

export const FIELD_LABELS: Record<AnalysisField, string> = {
  photo_matches_request: "Matches request",
  usable: "Usable",
  retake_reason: "Retake reason",
  retake_instruction: "Retake tip",
  confidence: "Confidence",
  setup_type: "Setup",
  amp_rating: "Amp rating",
  amp_rating_legible: "Amp rating legible",
  meter_number_legible: "Meter numbers legible",
  meter_in_locked_cabinet: "Meter in locked cabinet",
  location: "Breaker box location",
  damage_visible: "Damage visible",
  gas_meter_near: "Gas meter near",
  window_near: "Window near",
  ac_unit_near: "A/C unit near",
  fence_present: "Fence present",
  clutter_blocking: "Clutter blocking",
  clear_ground_space: "Clear ground space",
  multiple_panels_visible: "Multiple panels",
  meter_count: "Meters visible",
  meter_can_edges_visible: "Whole meter box in frame",
  ground_visible: "Ground visible",
  enough_wall_shown: "Enough wall shown",
  panel_context_visible: "Surroundings visible",
  panel_brand: "Breaker box brand",
  panel_label_legible: "Label legible",
  heavy_rust: "Heavy rust",
  notes: "Notes",
};

export function formatField(field: AnalysisField, analysis: PhotoAnalysis): string {
  const value = analysis[field];
  if (value === undefined) return "Not checked";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "amp_rating") return value ? `${value}A` : "Not read";
  if (field === "confidence") return `${value}%`;
  return String(value).replace(/_/g, " ") || "None";
}

/** Booleans where "Yes" is a problem, used to color the readout. */
export const HAZARD_FIELDS: AnalysisField[] = [
  "damage_visible",
  "gas_meter_near",
  "window_near",
  "ac_unit_near",
  "clutter_blocking",
  "multiple_panels_visible",
  "heavy_rust",
];

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(iso));
}
