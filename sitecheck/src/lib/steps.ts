import type { AnalysisField } from "./schema";
import type { ExtraStep } from "./types";

export const STEP_IDS = [
  "meter_area_wide",
  "meter_closeup",
  "left_of_meter",
  "right_of_meter",
  "adjacent_wall",
  "behind_fence",
  "panel_wide",
  "panel_open",
  "main_disconnect_closeup",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type OutlineId =
  | "small_center"
  | "circle_large"
  | "small_right_edge"
  | "small_left_edge"
  | "corner_markers"
  | "medium_center"
  | "rect_large"
  | "tall_center";

export type Step = {
  /** A StepId, or extra_<n> for photos the whole-site check asked for. */
  id: string;
  title: string;
  instruction: string;
  outline: OutlineId;
  /** What the photo is supposed to show, used in the AI prompt. */
  description: string;
  /** Analysis fields that matter for this step (prompt and surveyor readout). */
  fields: AnalysisField[];
  // External slot name used when exporting photos to another system.
  baseSlot: string;
};

export const STEPS: Step[] = [
  {
    id: "meter_area_wide",
    baseSlot: "electric_meter_surroundings",
    title: "Meter and wall",
    instruction:
      "Stand about 10 steps back. Fit your meter inside the small box so we can see the whole wall around it.",
    outline: "small_center",
    description:
      "the homeowner's electric meter taken from about 10 steps back, showing the whole wall and ground around it",
    fields: [
      "setup_type",
      "gas_meter_near",
      "window_near",
      "ac_unit_near",
      "fence_present",
      "clutter_blocking",
      "clear_ground_space",
      "multiple_panels_visible",
      "meter_count",
      "ground_visible",
    ],
  },
  {
    id: "meter_closeup",
    baseSlot: "electric_meter_close_up",
    title: "Meter close-up",
    instruction: "Move close so the numbers are readable. Keep the whole meter box in the photo.",
    outline: "circle_large",
    description:
      "a close-up of the electric meter with its numbers readable, showing the whole metal box that holds the meter from its top edge to its bottom edge",
    fields: [
      "meter_number_legible",
      "damage_visible",
      "meter_count",
      "meter_can_edges_visible",
    ],
  },
  {
    id: "left_of_meter",
    baseSlot: "electric_meter_left",
    title: "Left of the meter",
    instruction: "Step back. Keep the meter at the right edge of the photo.",
    outline: "small_right_edge",
    description:
      "the wall and ground to the left of the electric meter, with the meter at the right edge. If the meter is at the left edge or in the middle, this is the wrong side: set photo_matches_request to false",
    fields: [
      "clear_ground_space",
      "gas_meter_near",
      "window_near",
      "ac_unit_near",
      "fence_present",
      "clutter_blocking",
      "ground_visible",
      "enough_wall_shown",
    ],
  },
  {
    id: "right_of_meter",
    baseSlot: "electric_meter_right",
    title: "Right of the meter",
    instruction: "Step back. Keep the meter at the left edge of the photo.",
    outline: "small_left_edge",
    description:
      "the wall and ground to the right of the electric meter, with the meter at the left edge. If the meter is at the right edge or in the middle, this is the wrong side: set photo_matches_request to false",
    fields: [
      "clear_ground_space",
      "gas_meter_near",
      "window_near",
      "ac_unit_near",
      "fence_present",
      "clutter_blocking",
      "ground_visible",
      "enough_wall_shown",
    ],
  },
  {
    id: "adjacent_wall",
    baseSlot: "electric_meter_around_corner",
    title: "Around the corner",
    instruction: "Walk to the nearest corner. Show that whole wall from corner to corner.",
    outline: "corner_markers",
    description:
      "the full neighbouring wall of the house around the nearest corner from the meter, corner to corner",
    fields: [
      "clear_ground_space",
      "gas_meter_near",
      "window_near",
      "ac_unit_near",
      "clutter_blocking",
      "ground_visible",
      "enough_wall_shown",
    ],
  },
  {
    id: "behind_fence",
    baseSlot: "electric_meter_behind_fence",
    title: "Behind the fence",
    instruction: "Show the full area behind the fence, corner to corner.",
    outline: "corner_markers",
    description: "the full area behind a fence next to the meter wall, corner to corner",
    fields: [
      "clear_ground_space",
      "gas_meter_near",
      "window_near",
      "ac_unit_near",
      "clutter_blocking",
      "ground_visible",
      "enough_wall_shown",
    ],
  },
  {
    id: "panel_wide",
    baseSlot: "main_breaker_box_wall",
    title: "Breaker box and surroundings",
    instruction: "Show your main breaker box and what is around it. Zoomed out is better.",
    outline: "medium_center",
    description:
      "the main breaker box and its surroundings, zoomed out enough to see where it is (outside wall, garage, closet)",
    fields: [
      "location",
      "multiple_panels_visible",
      "damage_visible",
      "panel_context_visible",
    ],
  },
  {
    id: "panel_open",
    baseSlot: "main_breaker_box_open",
    title: "Breaker box open",
    instruction: "Open the breaker box door. Fit all the switches inside the box.",
    outline: "tall_center",
    description:
      "the main breaker box with its door open, showing all the breakers and the label on the inside of the door",
    fields: ["panel_brand", "panel_label_legible", "heavy_rust", "damage_visible", "multiple_panels_visible"],
  },
  {
    id: "main_disconnect_closeup",
    baseSlot: "main_disconnect_switch_photo",
    title: "Main switch",
    instruction:
      "Open the lid. Fill the box with the main switch so the number (like 150 or 200) is readable. If there is no big switch at the top of your breaker box, look in the gray box next to your meter.",
    outline: "rect_large",
    description:
      "a close-up of the main disconnect switch with the lid open and the amp rating number readable",
    fields: ["amp_rating", "amp_rating_legible", "damage_visible"],
  },
];

export const STEP_BY_ID: Record<StepId, Step> = Object.fromEntries(
  STEPS.map((s) => [s.id, s]),
) as Record<StepId, Step>;

export function isStepId(value: string): value is StepId {
  return (STEP_IDS as readonly string[]).includes(value);
}

export const EXTRA_STEP_TITLE = "One more photo";
export const EXTRA_BASE_SLOT = "electric_meter_additional";
export const EXTRA_STEP_FIELDS: AnalysisField[] = [
  "clear_ground_space",
  "gas_meter_near",
  "window_near",
  "ac_unit_near",
  "clutter_blocking",
  "ground_visible",
];

export function isExtraStepId(value: string): boolean {
  return /^extra_\d+$/.test(value);
}

/** Regular steps come from the table; extra_<n> steps are built from the home's whole-site check. */
export function getStep(id: string, extraSteps: Pick<ExtraStep, "id" | "instruction">[] = []): Step | null {
  if (isStepId(id)) return STEP_BY_ID[id];
  const extra = isExtraStepId(id) ? extraSteps.find((e) => e.id === id) : undefined;
  if (!extra) return null;
  return {
    id,
    title: EXTRA_STEP_TITLE,
    instruction: extra.instruction,
    outline: "corner_markers",
    description: `the area described in this request: "${extra.instruction}"`,
    fields: EXTRA_STEP_FIELDS,
    baseSlot: EXTRA_BASE_SLOT,
  };
}

export function stepTitle(id: string): string {
  if (isStepId(id)) return STEP_BY_ID[id].title;
  return isExtraStepId(id) ? EXTRA_STEP_TITLE : id;
}

export function baseSlotFor(id: string): string {
  return isStepId(id) ? STEP_BY_ID[id].baseSlot : EXTRA_BASE_SLOT;
}

export const SPACE_STEPS: StepId[] = [
  "meter_area_wide",
  "left_of_meter",
  "right_of_meter",
  "adjacent_wall",
  "behind_fence",
];

export const MAX_ATTEMPTS = 3;
