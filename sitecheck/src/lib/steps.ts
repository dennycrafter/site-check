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

export type Phase = 1 | 2 | 3;

export const PHASE_TITLES: Record<Phase, string> = {
  1: "Your meter",
  2: "The space around it",
  3: "Your breaker box",
};

export const PHASE_COUNT = 3;

export type Step = {
  /** A StepId, or extra_<n> for photos the whole-site check asked for. */
  id: string;
  phase: Phase;
  title: string;
  instruction: string;
  outline: OutlineId;
  /** What the photo is supposed to show, used in the AI prompt. */
  description: string;
  /** Analysis fields that matter for this step (prompt and surveyor readout). */
  fields: AnalysisField[];
  // External slot name used when exporting photos to another system.
  baseSlot: string;
  /** Short plain tips shown in the customer help sheet. */
  help: string[];
};

export const STEPS: Step[] = [
  {
    id: "meter_area_wide",
    phase: 1,
    help: [
      "Back up until the whole wall and the ground fit.",
      "Daylight works best. Use flash if it is dark.",
      "Stay on safe ground. A partial wall is fine if you can't go further back.",
    ],
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
    phase: 1,
    help: [
      "Stand straight in front of the meter.",
      "Get close enough to read the numbers.",
      "Keep the whole meter box in the photo, top to bottom.",
      "Is your meter in a locked box? Take a photo of the whole box. That's fine.",
    ],
    baseSlot: "electric_meter_close_up",
    title: "Meter close-up",
    instruction: "Move close so the numbers are readable. Keep the whole meter box in the photo.",
    outline: "circle_large",
    description:
      "a close-up of the electric meter with its numbers readable, showing the whole metal box that holds the meter from its top edge to its bottom edge. If the meter is inside a locked metal cabinet with a small window, so only part of the meter shows, a photo of the whole cabinet with its window is correct: set meter_in_locked_cabinet to true, and the cabinet's top and bottom edges count as the meter box edges for meter_can_edges_visible",
    fields: [
      "meter_number_legible",
      "meter_in_locked_cabinet",
      "damage_visible",
      "meter_count",
      "meter_can_edges_visible",
    ],
  },
  {
    id: "left_of_meter",
    phase: 2,
    help: [
      "Stand to the left of the meter and step back.",
      "The meter should sit at the right edge of the photo.",
      "Show the wall and the ground on that side.",
    ],
    baseSlot: "electric_meter_left",
    title: "Left of the meter",
    instruction: "Step back. Keep the meter at the right edge of the photo.",
    outline: "small_right_edge",
    description:
      "the wall and ground to the left of the electric meter, with the meter at the right edge. The meter can be a round glass meter, a digital meter, or a locked gray cabinet with a small window. Walls often have several boxes in a row, so the meter may sit next to other boxes. Only set photo_matches_request to false for the wrong side when the meter is clearly at the left edge. If it is unclear which box is the meter, do not reject the photo for its side",
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
    phase: 2,
    help: [
      "Stand to the right of the meter and step back.",
      "The meter should sit at the left edge of the photo.",
      "Show the wall and the ground on that side.",
    ],
    baseSlot: "electric_meter_right",
    title: "Right of the meter",
    instruction: "Step back. Keep the meter at the left edge of the photo.",
    outline: "small_left_edge",
    description:
      "the wall and ground to the right of the electric meter, with the meter at the left edge. The meter can be a round glass meter, a digital meter, or a locked gray cabinet with a small window. Walls often have several boxes in a row, so the meter may sit next to other boxes. Only set photo_matches_request to false for the wrong side when the meter is clearly at the right edge. If it is unclear which box is the meter, do not reject the photo for its side",
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
    phase: 2,
    help: [
      "Walk to the nearest corner of the house.",
      "Fit that whole wall, from corner to corner.",
      "Stay on safe ground. A partial wall is fine if you can't go further back.",
    ],
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
    phase: 2,
    help: [
      "Look over or through the gate if it is safe.",
      "Show the whole area, from corner to corner.",
      "Never climb the fence.",
    ],
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
    phase: 3,
    help: [
      "Step back so we can see where the box is.",
      "Show the wall, garage or closet around it.",
      "Zoomed out is better than too close.",
    ],
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
    phase: 3,
    help: [
      "Open only the hinged door.",
      "Fit all the switches in the photo.",
      "Never remove screws or the inner cover.",
    ],
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
    phase: 3,
    help: [
      "Look for the biggest switch, often at the top.",
      "Get close so the number, like 150 or 200, is readable.",
      "No big switch in the box? Check the gray box next to your meter.",
    ],
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
export const EXTRA_STEP_HELP = [
  "Stand where you can see the whole area we asked for.",
  "Daylight works best. Use flash if it is dark.",
  "Stay on safe ground. A partial view is fine if you can't go further.",
];
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
    phase: 3,
    title: EXTRA_STEP_TITLE,
    instruction: extra.instruction,
    outline: "corner_markers",
    description: `the area described in this request: "${extra.instruction}"`,
    fields: EXTRA_STEP_FIELDS,
    baseSlot: EXTRA_BASE_SLOT,
    help: EXTRA_STEP_HELP,
  };
}

export function stepTitle(id: string): string {
  if (isStepId(id)) return STEP_BY_ID[id].title;
  return isExtraStepId(id) ? EXTRA_STEP_TITLE : id;
}

/** Phase of any step id. Extra steps from the whole-site check come after everything else, so they belong to the last phase. */
export function phaseOf(id: string): Phase {
  return isStepId(id) ? STEP_BY_ID[id].phase : 3;
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
