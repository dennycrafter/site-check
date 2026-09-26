import type { PhotoAnalysis } from "./schema";
import type { StepId } from "./steps";

export const MESSAGES = {
  accepted: "Looks good",
  checkFailed: "Got it. We'll double-check this one.",
  maxAttempts: "Thanks, a surveyor will take a look at this one.",
} as const;

const RETAKE_FALLBACK: Record<PhotoAnalysis["retake_reason"], string> = {
  too_dark: "It's too dark. Turn on your flash or retake in daylight.",
  blurry: "The photo is blurry. Hold still and tap the screen to focus.",
  too_close: "Step back so we can see more around it.",
  too_far: "Move closer so it fills the outline.",
  wrong_subject: "This doesn't look like the right thing. Check the outline and try again.",
  lid_closed: "Lift the lid so we can see the main switch.",
  view_blocked: "Something is in the way. Clear the area if you can, then retake.",
  text_unreadable: "We can't read the number. Move closer and tap to focus.",
  none: "We couldn't use this photo. Please try again.",
};

const WALL_STEPS: string[] = ["left_of_meter", "right_of_meter", "adjacent_wall", "behind_fence"];
const GROUND_STEPS: string[] = ["meter_area_wide", ...WALL_STEPS];

/**
 * A photo is only good if a reviewer could decide this step from it alone.
 * Checked in this order; the first failure picks the fallback message.
 */
const DECIDABILITY: Array<{ applies: (step: string) => boolean; fails: (a: PhotoAnalysis) => boolean; message: string }> = [
  {
    applies: (step) => step === "meter_closeup",
    fails: (a) => !a.meter_can_edges_visible,
    message: "Step back a little so the whole meter box fits, with some wall around it.",
  },
  {
    applies: (step) => GROUND_STEPS.includes(step),
    fails: (a) => !a.ground_visible,
    message: "Tilt your phone down a little so we can see the ground by the wall.",
  },
  {
    applies: (step) => WALL_STEPS.includes(step),
    fails: (a) => !a.wall_end_visible,
    message: "Step back until you can see where this wall ends.",
  },
  {
    applies: (step) => step === "panel_wide",
    fails: (a) => !a.panel_context_visible,
    message: "Step back so we can see the room or wall around the breaker box.",
  },
];

export type PhotoDecision = { accept: true } | { accept: false; message: string };

/** Section 8.5: whether a successfully analyzed photo is usable for its step. */
export function decidePhoto(step: StepId, a: PhotoAnalysis): PhotoDecision {
  const failed = DECIDABILITY.find((check) => check.applies(step) && check.fails(a));
  const retake =
    !a.photo_matches_request ||
    !a.usable ||
    a.retake_reason !== "none" ||
    (step === "meter_closeup" && !a.meter_number_legible) ||
    (step === "main_disconnect_closeup" && !a.amp_rating_legible) ||
    failed !== undefined;
  if (!retake) return { accept: true };
  const instruction = a.retake_instruction.trim();
  return { accept: false, message: instruction || failed?.message || RETAKE_FALLBACK[a.retake_reason] };
}
